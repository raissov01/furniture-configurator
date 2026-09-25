"""Тестерге арналған қысқа ОРЫСША мәтін (`pro100-audit.txt`)."""
from __future__ import annotations

from typing import Any

STOP_REASONS_RU = {
    "license": "появилось окно лицензии/активации/регистрации PRO100 — мост ничего в нём не нажимал",
    "recover": "PRO100 предлагает восстановить проект после сбоя — ответьте сами и запустите снова",
    "unsaved": "в PRO100 открыт ваш несохранённый проект — сохраните или закройте его и запустите снова",
    "focus": "окно PRO100 потеряло фокус (мышь или клавиатура были заняты?)",
    "start-failed": "не удалось найти или запустить PRO100",
}

STATUS_RU = {"OK": "совпало", "MISMATCH": "расхождение", "MISSING": "нет в PRO100",
             "EXTRA": "лишнее в PRO100", "SKIPPED": "пропущено"}


def _fmt(v: Any) -> str:
    return "—" if v is None else str(v)


def audit_summary_ru(audit: dict[str, Any], limit: int = 25) -> str:
    s = audit["comparison"]["summary"]
    lines = [
        f"Аудит PRO100 — {audit['project']}",
        f"Запуск: {audit['runAt']}   Допуск: ±{audit['tolerance']} мм"
        + ("   [ПРОБНЫЙ ПРОГОН без PRO100]" if audit["environment"].get("dryRun") else ""),
        "",
        "Итог: " + ", ".join(f"{STATUS_RU[k]} {v}" for k, v in s.items()),
    ]
    stop = audit.get("stopped")
    if stop:
        lines += ["", f"ОСТАНОВЛЕНО на шаге «{stop['step']}»: {STOP_REASONS_RU.get(stop['reason'], stop['reason'])}"]
        if stop.get("window"):
            lines.append(f"Окно: {stop['window']}")
    errors = audit.get("errors", [])
    if errors:
        lines += ["", f"Ошибки шагов ({len(errors)}):"]
        lines += [f"  - {e['step']}: {e['error']}" for e in errors[:10]]
        if len(errors) > 10:
            lines.append(f"  … ещё {len(errors) - 10}")
    bad = [r for r in audit["comparison"]["results"] if r["status"] not in ("OK", "SKIPPED")]
    if bad:
        lines += ["", f"Расхождения (первые {min(limit, len(bad))} из {len(bad)}):"]
        for r in bad[:limit]:
            tail = ""
            if r["status"] == "MISMATCH":
                tail = f": {r.get('field')} ожидалось {_fmt(r.get('expected'))}, в PRO100 {_fmt(r.get('actual'))}"
                if r.get("delta") is not None:
                    tail += f" (Δ {r['delta']})"
            lines.append(f"  - [{STATUS_RU[r['status']]}] {r['where']}{tail}")
    lines += [
        "",
        "Что прислать: файл pro100-audit.json из этой папки (и папку shots, если не трудно).",
        "Проекты PRO100 этого прогона сохранены только в этой папке; ваши настройки и библиотека не менялись.",
    ]
    return "\n".join(lines) + "\n"
