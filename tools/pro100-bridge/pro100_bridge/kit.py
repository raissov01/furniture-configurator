"""Тест-жинақ (`pro100-test-kit.json`) — TS жағы `npm run pro100:kit` жазады.

Пішімі `src/core/export/pro100Kit.ts` `Pro100Kit` типімен бірдей. Мұнда тек
көпірге керегі тексеріледі; қате болса — өрістің жолы мен себебі айтылады.
Өлшемдер — бүтін мм, рет әрқашан H × W × D.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

KIT_FORMAT = "furniture-configurator.pro100-kit"
KIT_VERSION = 1
ITEM_KINDS = ("base", "wall", "drawers", "tall", "other")


class KitError(ValueError):
    """Тест-жинақ файлы дұрыс емес."""


@dataclass
class LibraryQuery:
    """PRO100 кітапханасынан элементті АТЫ бойынша табу.

    `search` — файл атауының нұсқалары (кеңейтусіз), бірінші табылғаны алынады;
    `folderHints` — жолда кездессе артықшылық беретін сөздер («Нижние», «560»).
    """

    search: list[str]
    folder_hints: list[str] = field(default_factory=list)


@dataclass
class Position:
    left: int
    bottom: int
    back: int


@dataclass
class KitItem:
    id: str
    kind: str
    name: str
    library: LibraryQuery
    height: int
    width: int
    depth: int
    position: Position
    material: str | None
    raw: dict[str, Any]

    def requested(self) -> dict[str, Any]:
        """PRO100 Properties-ке енгізілетін мәндер (General қосымшасы)."""
        return {
            "name": self.name,
            "width": self.width,
            "height": self.height,
            "depth": self.depth,
            "left": self.position.left,
            "bottom": self.position.bottom,
            "back": self.position.back,
        }


@dataclass
class Scenario:
    id: str
    title: str
    items: list[KitItem]
    expected: dict[str, Any]


@dataclass
class Kit:
    project: str
    tolerance: float
    scenarios: list[Scenario]
    raw: dict[str, Any]


def _req(obj: dict[str, Any], key: str, path: str, kind: type | tuple[type, ...]) -> Any:
    if key not in obj:
        raise KitError(f"{path}.{key}: өріс жоқ")
    value = obj[key]
    if isinstance(value, bool) or not isinstance(value, kind):
        raise KitError(f"{path}.{key}: түрі қате ({type(value).__name__})")
    return value


def _mm(obj: dict[str, Any], key: str, path: str, minimum: int = 1) -> int:
    value = _req(obj, key, path, (int, float))
    if isinstance(value, float) and not value.is_integer():
        raise KitError(f"{path}.{key}: өлшем бүтін мм болуы керек, берілгені {value}")
    if value < minimum:
        raise KitError(f"{path}.{key}: {value} < {minimum}")
    return int(value)


def parse_kit(data: Any) -> Kit:
    if not isinstance(data, dict):
        raise KitError("түбір: объект емес")
    if data.get("format") != KIT_FORMAT:
        raise KitError(f"format: '{KIT_FORMAT}' күтілген, берілгені {data.get('format')!r}")
    if data.get("version") != KIT_VERSION:
        raise KitError(f"version: {KIT_VERSION} күтілген, берілгені {data.get('version')!r}")
    tolerance = float(_req(data, "tolerance", "", (int, float)))
    scenarios_raw = _req(data, "scenarios", "", list)
    if not scenarios_raw:
        raise KitError("scenarios: бос")
    seen: set[str] = set()
    scenarios: list[Scenario] = []
    for si, s in enumerate(scenarios_raw):
        sp = f"scenarios[{si}]"
        if not isinstance(s, dict):
            raise KitError(f"{sp}: объект емес")
        sid = _req(s, "id", sp, str)
        items: list[KitItem] = []
        for ii, it in enumerate(_req(s, "items", sp, list)):
            ip = f"{sp}.items[{ii}]"
            if not isinstance(it, dict):
                raise KitError(f"{ip}: объект емес")
            iid = _req(it, "id", ip, str)
            if iid in seen:
                raise KitError(f"{ip}.id: қайталанады — {iid}")
            seen.add(iid)
            kind = _req(it, "kind", ip, str)
            if kind not in ITEM_KINDS:
                raise KitError(f"{ip}.kind: {kind!r} ∉ {ITEM_KINDS}")
            lib = _req(it, "library", ip, dict)
            search = _req(lib, "search", f"{ip}.library", list)
            if not search or not all(isinstance(x, str) and x.strip() for x in search):
                raise KitError(f"{ip}.library.search: бос емес жолдар тізімі керек")
            hints = lib.get("folderHints", [])
            if not isinstance(hints, list) or not all(isinstance(x, str) for x in hints):
                raise KitError(f"{ip}.library.folderHints: жолдар тізімі керек")
            pos = _req(it, "position", ip, dict)
            material = it.get("material")
            if material is not None and not isinstance(material, str):
                raise KitError(f"{ip}.material: жол не null керек")
            items.append(KitItem(
                id=iid,
                kind=kind,
                name=_req(it, "name", ip, str),
                library=LibraryQuery(list(search), list(hints)),
                height=_mm(it, "height", ip),
                width=_mm(it, "width", ip),
                depth=_mm(it, "depth", ip),
                position=Position(
                    _mm(pos, "left", f"{ip}.position", 0),
                    _mm(pos, "bottom", f"{ip}.position", 0),
                    _mm(pos, "back", f"{ip}.position", 0),
                ),
                material=material,
                raw=it,
            ))
        if not items:
            raise KitError(f"{sp}.items: бос")
        expected = _req(s, "expected", sp, dict)
        for key in ("parts", "elements", "materials"):
            _req(expected, key, f"{sp}.expected", list)
        _req(expected, "costs", f"{sp}.expected", dict)
        scenarios.append(Scenario(sid, str(s.get("title", sid)), items, expected))
    return Kit(project=str(data.get("project", "pro100-test-kit")), tolerance=tolerance, scenarios=scenarios, raw=data)


def load_kit(path: str | Path) -> Kit:
    text = Path(path).read_text(encoding="utf-8-sig")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as err:
        raise KitError(f"JSON оқылмады: {err}") from err
    return parse_kit(data)
