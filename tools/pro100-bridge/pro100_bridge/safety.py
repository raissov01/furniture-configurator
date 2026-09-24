"""Қауіпсіздік: PRO100 диалогтарын тану және статус жолын талдау (таза Python).

Ереже: лицензия/активация/тіркеу/демо терезесі шықса — көпір ТОҚТАЙДЫ және
жазып қояды, ешқандай батырма баспайды. Кілт сөздер `PRO100.rus` ресурс
жолдарынан (№60, №63, №66, №110) және ағылшынша баламаларынан алынды.
"""
from __future__ import annotations

import re

LICENSE_WORDS = (
    "лиценз", "license", "licence", "активац", "activat", "регистрац", "registr",
    "аппаратный ключ", "hardware key", "dongle", "серийн", "serial number",
    "демо-версия", "demo version", "пробное использование", "trial",
    "полнофункциональная версия", "full version", "отсутствуют права на запуск",
)
RECOVER_WORDS = ("закрыт некорректно", "восстановить проект", "closed incorrectly", "restore project", "recover")
UNSAVED_WORDS = ("был изменён", "был изменен", "was modified", "сохранить изменения", "save changes")
OVERWRITE_WORDS = ("already exists", "уже существует", "replace it", "заменить его")
WARNING_WORDS = ("прайс-лист", "price list", "price-list", "неточность расчётов")


def classify_dialog(title: str, texts: list[str]) -> str:
    """'license' | 'recover' | 'unsaved' | 'overwrite' | 'warning' | 'unknown'."""
    blob = " ".join([title or "", *texts]).lower()
    for kind, words in (("license", LICENSE_WORDS), ("recover", RECOVER_WORDS), ("unsaved", UNSAVED_WORDS),
                        ("overwrite", OVERWRITE_WORDS), ("warning", WARNING_WORDS)):
        if any(w in blob for w in words):
            return kind
    return "unknown"


_SELECTED = re.compile(r'(?:selected element|выбран элемент)\s*:\s*"(.*)"', re.IGNORECASE)
_TRIPLE = re.compile(r"^\s*(-?\d+)\s*[xх×]\s*(-?\d+)\s*[xх×]\s*(-?\d+)\s*$")


def parse_status_bar(parts: list[str]) -> dict[str, object]:
    """Статус жолы (скриншот s1-final-dimensions-applied.png):
    ['Selected element: "S1 Base 600x720x560"', '2700 x 0 x 1709', '600 x 720 x 560'].
    Бірінші үштік — орны (Left, Bottom, Back), екіншісі — ӘЛЕМДІК осьтердегі
    габарит: бұрылған элементте ол Width/Depth-ті АУЫСТЫРАДЫ
    (scenario1-pasted.png: «582 x 720 x 600», ал Properties-те W600, D582),
    сондықтан өлшемді салыстыру үшін емес, тек дәлел ретінде сақталады.
    """
    selected = None
    triples: list[list[int]] = []
    for p in parts:
        m = _SELECTED.search(p or "")
        if m:
            selected = m.group(1)
            continue
        t = _TRIPLE.match(p or "")
        if t:
            triples.append([int(t.group(i)) for i in (1, 2, 3)])
    return {
        "selected": selected,
        "position": triples[0] if len(triples) >= 1 else None,
        "extent": triples[1] if len(triples) >= 2 else None,
    }
