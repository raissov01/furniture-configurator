#!/usr/bin/env bash
# EnvironmentFile=/etc/aismebel/backup.env supplies these values on the host.
set -euo pipefail

: "${BACKUP_MODE:?BACKUP_MODE=sqlite немесе postgres қажет}"
: "${DATA_DIR:?DATA_DIR қажет}"
: "${BACKUP_DIR:?BACKUP_DIR қажет}"

args=(backup --mode "$BACKUP_MODE" --data-dir "$DATA_DIR" --backup-dir "$BACKUP_DIR" --keep-days 14)
if [[ -n "${BACKUP_RSYNC_TARGET:-}" ]]; then
  args+=(--rsync-target "$BACKUP_RSYNC_TARGET")
fi
if [[ -n "${BACKUP_S3_TARGET:-}" ]]; then
  args+=(--s3-target "$BACKUP_S3_TARGET")
fi
if [[ -n "${OBJECT_S3_URI:-}" ]]; then
  args+=(--object-s3-uri "$OBJECT_S3_URI")
fi
if [[ -z "${BACKUP_RSYNC_TARGET:-}" && -z "${BACKUP_S3_TARGET:-}" ]]; then
  echo 'BACKUP_RSYNC_TARGET немесе BACKUP_S3_TARGET қажет' >&2
  exit 1
fi

exec python3 "$(dirname "$0")/launch_backup.py" "${args[@]}"
