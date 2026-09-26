"""Командалық жол: `python -m pro100_bridge <command>` не `pro100-bridge.exe <command>`.

  audit <kit.json>     тест-жинақты PRO100-да қайта құрып, салыстыру
  export-project       ашық PRO100 жобасын біздің пішімге оқу

Тестерге шығатын мәтін — орысша. Шығу коды: 0 — бәрі сәйкес, 3 — айырма бар,
4 — жүгіріс тоқтатылды (лицензия терезесі т.б.), 2 — енгізу қатесі.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Callable

from . import __version__
from .driver import Pro100Driver
from .dryrun import DryRunDriver
from .kit import KitError, load_kit
from .runner import PROJECT_JSON, run_audit, run_export, write_audit


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="pro100-bridge", description="Мост PRO100 ↔ конфигуратор (UI-автоматизация).")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="command", required=True)

    def common(sp: argparse.ArgumentParser) -> None:
        sp.add_argument("--out", help="папка для результатов (по умолчанию — рядом, с датой в имени)")
        sp.add_argument("--dry-run", action="store_true", help="без PRO100: только записать, что было бы сделано")
        sp.add_argument("--exe", help="путь к PRO100.exe, если PRO100 ещё не запущен")
        sp.add_argument("--library", help="папка библиотеки мебели PRO100 (по умолчанию ищется рядом с PRO100.exe)")
        sp.add_argument("--reports-from", help="(для --dry-run) папка с готовыми отчётами *.txt")
        sp.add_argument("--slow", type=float, default=1.0, help="множитель пауз для медленного ПК (например 2)")
        sp.add_argument("--no-countdown", action="store_true", help="не ждать 5 секунд перед началом")

    a = sub.add_parser("audit", help="собрать тест-набор в PRO100 и сравнить отчёты с нашими")
    a.add_argument("kit", help="pro100-test-kit.json")
    common(a)
    e = sub.add_parser("export-project", help="прочитать открытый проект PRO100 (структура + отчёты)")
    common(e)
    return p


def _default_out(base: Path, prefix: str) -> Path:
    return base / f"{prefix}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"


def _driver(args: argparse.Namespace, log: Callable[[str], None]) -> Pro100Driver:
    if args.dry_run:
        listing = None
        if args.library:
            from .library import scan_library
            listing = scan_library(args.library)
        return DryRunDriver(library_listing=listing,
                            reports_from=Path(args.reports_from) if args.reports_from else None, log=log)
    from .ui_pro100 import Pro100UI  # pywinauto тек осында, кеш импорт
    return Pro100UI(exe=args.exe, library=args.library, slow=args.slow, log=log)


def _countdown(minutes: int, args: argparse.Namespace) -> None:
    print(f"Сейчас мост будет управлять PRO100 примерно {minutes} мин.")
    print("НЕ трогайте мышь и клавиатуру, пока не появится надпись «Готово».")
    if args.dry_run or args.no_countdown:
        return
    for i in range(5, 0, -1):
        print(f"  старт через {i}…", flush=True)
        time.sleep(1)


def main(argv: list[str] | None = None) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    args = _parser().parse_args(argv)

    def log(msg: str) -> None:
        print(msg, flush=True)

    if args.command == "audit":
        try:
            kit = load_kit(args.kit)
        except (OSError, KitError) as err:
            print(f"Файл набора не прочитан: {err}", file=sys.stderr)
            return 2
        out = Path(args.out) if args.out else _default_out(Path(args.kit).resolve().parent, "pro100-audit")
        n_items = sum(len(s.items) for s in kit.scenarios)
        _countdown(max(2, n_items + 2 * len(kit.scenarios)), args)
        audit = run_audit(kit, _driver(args, log), out, dry_run=args.dry_run, log=log)
        json_path, txt_path = write_audit(audit, out)
        s = audit["comparison"]["summary"]
        print("")
        print(f"Готово. Совпало {s['OK']}, расхождений {s['MISMATCH']}, нет {s['MISSING']}, лишних {s['EXTRA']}.")
        print(f"Отправьте файл: {json_path}")
        print(f"Кратко по-русски: {txt_path}")
        if audit["stopped"]:
            print(f"ВНИМАНИЕ: прогон остановлен — {audit['stopped']['reason']}. Подробности в {txt_path.name}.")
            return 4
        return 0 if s["MISMATCH"] + s["MISSING"] + s["EXTRA"] == 0 and not audit["errors"] else 3

    out = Path(args.out) if args.out else _default_out(Path.cwd(), "pro100-project")
    _countdown(3, args)
    project = run_export(_driver(args, log), out, dry_run=args.dry_run, log=log)
    path = out / PROJECT_JSON
    path.write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")
    print("")
    print(f"Готово. Элементов: {len(project['elements'])}, строк деталей: {len(project['parts'])}.")
    print(f"Файл проекта: {path}")
    if project["stopped"]:
        print(f"ВНИМАНИЕ: остановлено — {project['stopped']['reason']}.")
        return 4
    return 0 if not project["errors"] else 3
