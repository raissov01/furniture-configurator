#!/usr/bin/env python3
"""AisMebel database and local-file backup. Run with --help for operator options."""

import argparse
from contextlib import closing
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import subprocess
import sys
import tarfile
from urllib.parse import parse_qsl, unquote, urlparse
import tempfile

PREFIX = 'aismebel-'


def lock_exclusive(handle):
    """Non-blocking exclusive lock; fails if another backup holds it."""
    try:
        import fcntl
    except ImportError:  # Windows has no fcntl; msvcrt gives the same non-blocking lock.
        import msvcrt
        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
    else:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)


def digest(path):
    hash_ = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            hash_.update(chunk)
    return hash_.hexdigest()


def pg_environment(database_url):
    parsed = urlparse(database_url)
    if parsed.scheme not in ('postgres', 'postgresql') or not parsed.path.lstrip('/'):
        raise ValueError('DATABASE_URL PostgreSQL URI және DB атауы болуы керек')
    environment = os.environ.copy()
    for key in ('PGDATABASE', 'PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGUSER', 'PGPASSWORD',
                'PGSERVICE', 'PGSERVICEFILE', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT',
                'PGSSLKEY', 'PGCONNECT_TIMEOUT', 'PGAPPNAME', 'PGOPTIONS', 'PGTARGETSESSIONATTRS'):
        environment.pop(key, None)
    environment['PGDATABASE'] = unquote(parsed.path.lstrip('/'))
    if parsed.hostname:
        environment['PGHOST'] = unquote(parsed.hostname)
    if parsed.port:
        environment['PGPORT'] = str(parsed.port)
    if parsed.username:
        environment['PGUSER'] = unquote(parsed.username)
    if parsed.password:
        environment['PGPASSWORD'] = unquote(parsed.password)
    allowed = {
        'sslmode': 'PGSSLMODE', 'sslrootcert': 'PGSSLROOTCERT',
        'sslcert': 'PGSSLCERT', 'sslkey': 'PGSSLKEY',
        'connect_timeout': 'PGCONNECT_TIMEOUT', 'host': 'PGHOST',
        'port': 'PGPORT', 'application_name': 'PGAPPNAME',
        'options': 'PGOPTIONS', 'target_session_attrs': 'PGTARGETSESSIONATTRS',
    }
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if key not in allowed:
            raise ValueError(f'DATABASE_URL параметрі қолдау таппайды: {key}')
        environment[allowed[key]] = value
    return environment


def run(command, *, database_url=None):
    environment = pg_environment(database_url) if database_url else os.environ.copy()
    subprocess.run(command, check=True, env=environment)


def copy_local_files(data_dir, stage):
    if not data_dir.is_dir():
        raise ValueError(f'DATA_DIR табылмады: {data_dir}')
    for source in data_dir.rglob('*'):
        if source.is_symlink():
            raise ValueError(f'DATA_DIR ішінде symlink бар: {source}')
        if not source.is_file() or source.relative_to(data_dir).as_posix() in ('furniture.db', 'furniture.db-wal', 'furniture.db-shm', 'furniture.db-journal'):
            continue
        destination = stage / 'files' / source.relative_to(data_dir)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def s3_location(uri):
    parsed = urlparse(uri)
    if (parsed.scheme != 's3' or not parsed.netloc or parsed.query or parsed.fragment
            or (parsed.path and not parsed.path.endswith('/'))):
        raise ValueError('Объект қоймасы s3://bucket/префикс/ түрінде болуы керек')
    return parsed.netloc, parsed.path.lstrip('/')


def create_archive(stage, archive, mode):
    paths = sorted(p for p in stage.rglob('*') if p.is_file())
    manifest = {'version': 1, 'mode': mode, 'files': {p.relative_to(stage).as_posix(): digest(p) for p in paths}}
    (stage / 'manifest.json').write_text(json.dumps(manifest, sort_keys=True), encoding='utf8')
    with tarfile.open(archive, 'w:gz') as output:
        for path in sorted(stage.rglob('*')):
            if path.is_file():
                output.add(path, arcname=path.relative_to(stage).as_posix(), recursive=False)


def sync_remote(backup_dir, rsync_target, s3_target):
    if rsync_target or s3_target:
        archives = [path for path in backup_dir.glob(PREFIX + '*.tar.gz')
                    if path.is_file() and not path.is_symlink() and path.stat().st_size > 0]
        if not archives:
            raise ValueError('Сыртқы көшіру тоқтады: жергілікті бэкап архиві жоқ')
    if rsync_target:
        if rsync_target.startswith('-') or ':' not in rsync_target or not rsync_target.endswith('/'):
            raise ValueError('rsync нысанасы user@host:/арнайы/бума/ түрінде аяқталуы керек')
        if rsync_target.rsplit(':', 1)[1] in ('/', './', ''):
            raise ValueError('rsync үшін бөлек бэкап бумасын көрсетіңіз')
        run(['rsync', '-az', '--include=*.tar.gz', '--exclude=*',
             str(backup_dir) + '/', rsync_target])
    if s3_target:
        _, prefix = s3_location(s3_target)
        if not prefix:
            raise ValueError('S3 нысанасы s3://bucket/арнайы/префикс/ түрінде аяқталуы керек')
        run(['aws', 's3', 'sync', str(backup_dir), s3_target, '--exclude', '*',
             '--include', '*.tar.gz'])


def backup(args):
    data_dir = Path(args.data_dir).resolve()
    backup_dir = Path(args.backup_dir).resolve()
    if data_dir == backup_dir or backup_dir.is_relative_to(data_dir) or data_dir.is_relative_to(backup_dir):
        raise ValueError('Бэкап бумасы DATA_DIR-ден бөлек болуы керек')
    if args.mode == 'postgres' and not os.environ.get('DATABASE_URL'):
        raise ValueError('PostgreSQL үшін DATABASE_URL қажет')
    # A private archive may contain user files and database secrets.
    backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(backup_dir, 0o700)
    with (backup_dir / '.launch-backup.lock').open('w') as lock:
        lock_exclusive(lock)
        with tempfile.TemporaryDirectory(prefix='.launch-stage-', dir=backup_dir) as temp:
            stage = Path(temp)
            if args.mode == 'sqlite':
                source = data_dir / 'furniture.db'
                if not source.is_file():
                    raise ValueError(f'SQLite файлы табылмады: {source}')
                # `with connection` only commits; close explicitly so the snapshot
                # file is released before the stage directory is archived/removed.
                with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as original:
                    with closing(sqlite3.connect(stage / 'database.sqlite')) as snapshot:
                        original.backup(snapshot)
            else:
                run(['pg_dump', '--format=custom', '--file', str(stage / 'database.dump')],
                    database_url=os.environ['DATABASE_URL'])
            copy_local_files(data_dir, stage)
            if args.object_s3_uri:
                s3_location(args.object_s3_uri)
                if (stage / 'files' / 'objects').exists():
                    raise ValueError('Жергілікті objects пен S3 объектілерін бірге беру мүмкін емес')
                destination = stage / 'files' / 'objects'
                destination.mkdir(parents=True)
                run(['aws', 's3', 'sync', args.object_s3_uri, str(destination)])
            name = PREFIX + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.tar.gz'
            temporary = backup_dir / ('.' + name + '.tmp')
            try:
                create_archive(stage, temporary, args.mode)
                os.chmod(temporary, 0o600)
                temporary.rename(backup_dir / name)
            finally:
                temporary.unlink(missing_ok=True)
        cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=args.keep_days)
        for old in backup_dir.glob(PREFIX + '*.tar.gz'):
            if dt.datetime.fromtimestamp(old.stat().st_mtime, dt.timezone.utc) < cutoff:
                old.unlink()
        sync_remote(backup_dir, args.rsync_target, args.s3_target)
        print(backup_dir / name)


def read_archive(archive, stage):
    with tarfile.open(archive, 'r:gz') as source:
        members = source.getmembers()
        names = [member.name for member in members]
        if len(names) != len(set(names)) or 'manifest.json' not in names:
            raise ValueError('Архив құрылымы жарамсыз')
        for member in members:
            name = PurePosixPath(member.name)
            if (not member.isfile() or name.is_absolute() or '..' in name.parts
                    or not (member.name in ('manifest.json', 'database.sqlite', 'database.dump')
                            or (name.parts[0] == 'files' and len(name.parts) > 1))):
                raise ValueError(f'Архив мүшесі жарамсыз: {member.name}')
            target = stage.joinpath(*name.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.extractfile(member) as input_file, target.open('wb') as output:
                shutil.copyfileobj(input_file, output)
    manifest = json.loads((stage / 'manifest.json').read_text(encoding='utf8'))
    if manifest.get('version') != 1 or manifest.get('mode') not in ('sqlite', 'postgres'):
        raise ValueError('Архив нұсқасы немесе DB түрі жарамсыз')
    actual = {p.relative_to(stage).as_posix(): digest(p) for p in stage.rglob('*') if p.is_file() and p.name != 'manifest.json'}
    if actual != manifest.get('files'):
        raise ValueError('Архив файлының SHA-256 сомасы сәйкес келмейді')
    expected_db = 'database.sqlite' if manifest['mode'] == 'sqlite' else 'database.dump'
    if expected_db not in actual:
        raise ValueError('Архивте дерекқор жоқ')
    return manifest['mode']


def restore(args):
    target = Path(args.restore_dir).resolve()
    if target.exists():
        raise ValueError(f'Қалпына келтіру бумасы бос жаңа жол болуы керек: {target}')
    if not target.parent.is_dir():
        raise ValueError(f'Нысаналы буманың ата-анасы табылмады: {target.parent}')
    with tempfile.TemporaryDirectory(prefix='.launch-restore-', dir=target.parent) as temp:
        stage = Path(temp)
        mode = read_archive(Path(args.archive), stage)
        if mode == 'postgres':
            url = os.environ.get('DATABASE_URL')
            if not url:
                raise ValueError('PostgreSQL қалпына келтіруге DATABASE_URL қажет')
            count = subprocess.check_output(
                ['psql', '--tuples-only', '--no-align', '--command',
                 "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')"],
                env=pg_environment(url), text=True).strip()
            if count != '0':
                raise ValueError('PostgreSQL нысаналы базасы бос болуы керек')
            run(['pg_restore', '--no-owner', '--no-acl', '--single-transaction', '--exit-on-error', str(stage / 'database.dump')],
                database_url=url)
        else:
            with closing(sqlite3.connect(stage / 'database.sqlite')) as database:
                if database.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise ValueError('SQLite integrity_check өтпеді')
        if args.restore_object_s3_uri:
            bucket, prefix = s3_location(args.restore_object_s3_uri)
            result = subprocess.check_output(
                ['aws', 's3api', 'list-objects-v2', '--bucket', bucket, '--prefix', prefix, '--max-keys', '1'],
                text=True)
            if json.loads(result).get('KeyCount', 0):
                raise ValueError('S3 нысаналы префиксі бос болуы керек')
        target.mkdir(parents=True)
        try:
            if mode == 'sqlite':
                shutil.copy2(stage / 'database.sqlite', target / 'furniture.db')
            files = stage / 'files'
            if files.exists():
                shutil.copytree(files, target, dirs_exist_ok=True)
            if args.restore_object_s3_uri and (target / 'objects').exists():
                run(['aws', 's3', 'sync', str(target / 'objects'), args.restore_object_s3_uri])
                shutil.rmtree(target / 'objects')
        except Exception:
            shutil.rmtree(target)
            raise
    print(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    make = commands.add_parser('backup')
    make.add_argument('--mode', choices=('sqlite', 'postgres'), required=True)
    make.add_argument('--data-dir', required=True)
    make.add_argument('--backup-dir', required=True)
    make.add_argument('--keep-days', type=int, default=14)
    make.add_argument('--rsync-target')
    make.add_argument('--s3-target')
    make.add_argument('--object-s3-uri', help='Қолданба объект қоймасының s3://bucket/префикс/ жолы')
    recover = commands.add_parser('restore')
    recover.add_argument('--archive', required=True)
    recover.add_argument('--restore-dir', required=True)
    recover.add_argument('--restore-object-s3-uri', help='Бос S3 нысаналы префиксі')
    args = parser.parse_args()
    try:
        if args.command == 'backup':
            if args.keep_days < 1:
                raise ValueError('--keep-days кемінде 1 болуы керек')
            backup(args)
        else:
            restore(args)
    except (OSError, ValueError, sqlite3.Error, subprocess.CalledProcessError, tarfile.TarError) as error:
        print(f'Қате: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
