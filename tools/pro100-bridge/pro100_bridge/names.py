"""Атау синонимдері: PRO100 деталь/фурнитура атауы → біздің рөл/түр.

PRO100-да деталь атауын кітапхана авторы өзі жазады («боковина»,
«крышка-дно», «дверь», «задняя  стенка» — нақты 1-сценарийден), сондықтан
атаудан тек РӨЛ тобы шығарылады. Бір атау бірнеше рөлге сәйкес келуі мүмкін
(«крышка-дно» → top/bottom). Рөл аттары `src/core/types.ts` `PanelRole`-мен бірдей.

Бұл кесте TS жағындағы `src/core/export/pro100Audit.ts` `PART_SYNONYMS`-пен
БІРДЕЙ болуы керек (екі жақ бір файлды қайта салыстырады).
"""
from __future__ import annotations

import re

# Ұзыны бірінші: «дно ящика» «дно»-дан бұрын тексерілуі керек.
PART_SYNONYMS: list[tuple[str, tuple[str, ...]]] = [
    ("крышка-дно", ("top", "bottom")),
    ("дно ящика", ("drawerBottom",)),
    ("задняя ящика", ("drawerBack",)),
    ("задняя стенка ящика", ("drawerBack",)),
    ("боковина ящика", ("drawerSide",)),
    ("фасад ящика", ("front",)),
    ("задняя стенка", ("back",)),
    ("стенка задняя", ("back",)),
    ("задняя", ("back",)),
    ("двп", ("back",)),
    ("хдф", ("back",)),
    ("боковина", ("side",)),
    ("бок", ("side",)),
    ("крышка", ("top",)),
    ("дно", ("bottom",)),
    ("полка", ("shelf",)),
    ("перегородка", ("divider",)),
    ("стойка", ("divider",)),
    ("дверь", ("front",)),
    ("дверка", ("front",)),
    ("фасад", ("front",)),
    ("цоколь", ("plinth",)),
    ("планка", ("rail",)),
    ("царга", ("rail",)),
    ("ящик", ("drawerSide", "drawerBack")),
]

HARDWARE_SYNONYMS: list[tuple[str, str]] = [
    ("полкодерж", "shelfPin"),
    ("петл", "hinge"),
    ("направляющ", "runner"),
    ("ручк", "handle"),
    ("ножк", "leg"),
    ("опор", "leg"),
    ("конфирмат", "confirmat"),
    ("евровинт", "confirmat"),
    ("минификс", "minifix"),
    ("эксцентрик", "minifix"),
    ("стяжк", "minifix"),
    ("шкант", "dowel"),
]

_WS = re.compile(r"\s+")


def normalize(name: str) -> str:
    """Кіші әріп, ё→е, бос орындарды біріктіру («задняя  стенка» → «задняя стенка»)."""
    return _WS.sub(" ", (name or "").lower().replace("ё", "е")).strip()


def part_roles(name: str) -> tuple[str, ...]:
    """PRO100 деталь атауының ықтимал рөлдері. Танылмаса — бос кортеж."""
    n = normalize(name)
    for syn, roles in PART_SYNONYMS:
        if syn in n:
            return roles
    return ()


def hardware_kind(name: str) -> str | None:
    n = normalize(name)
    for syn, kind in HARDWARE_SYNONYMS:
        if syn in n:
            return kind
    return None
