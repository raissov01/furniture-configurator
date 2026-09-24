"""PRO100-дан оқылғанды біз күткенмен салыстыру (таза Python).

Нәтиже — жолдар тізімі, әр жол:
  {"section", "status", "where", "field"?, "expected"?, "actual"?, "delta"?, "basis"?, "hint"?}
status ∈ OK | MISMATCH | MISSING | EXTRA | SKIPPED. Өлшем шегі — `tolerance` (0.5 мм).

Бұл алгоритм TS жағындағы `src/core/export/pro100Audit.ts` `comparePro100Parts`
т.б. функциялармен БІРДЕЙ: TS audit файлдағы шикі деректен бәрін қайта
есептейді де, осы жақтың қорытындысына сенбейді.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .names import hardware_kind, normalize, part_roles
from .reports import Calculation, ElementRow, MaterialRow, PartRow

Result = dict[str, Any]
STATUSES = ("OK", "MISMATCH", "MISSING", "EXTRA", "SKIPPED")
ELEMENT_FIELDS = ("width", "height", "depth", "left", "bottom", "back")


def _num(v: float) -> float | int:
    """JSON-ға: бүтін болса int (704.0 → 704)."""
    r = round(float(v), 3)
    return int(r) if r.is_integer() else r


def summarize(results: list[Result]) -> dict[str, int]:
    out = {s: 0 for s in STATUSES}
    for r in results:
        out[r["status"]] += 1
    return out


# ── Элемент: Properties-ке енгізілгені мен қайта оқылғаны ───────────────────


def compare_element(item_id: str, requested: dict[str, Any], actual: dict[str, Any] | None, tol: float) -> list[Result]:
    where = f"{item_id} · элемент"
    if actual is None:
        return [{"section": "element", "status": "MISSING", "where": where, "expected": requested}]
    out: list[Result] = []
    name_want, name_got = requested.get("name"), actual.get("name")
    if name_want is not None and name_got is not None and normalize(str(name_got)) != normalize(str(name_want)):
        out.append({"section": "element", "status": "MISMATCH", "where": where, "field": "name",
                    "expected": name_want, "actual": name_got})
    for f in ELEMENT_FIELDS:
        want, got = requested.get(f), actual.get(f)
        if want is None:
            continue
        if not isinstance(got, (int, float)):
            out.append({"section": "element", "status": "MISMATCH", "where": where, "field": f,
                        "expected": want, "actual": got, "hint": "мәні оқылмады"})
            continue
        delta = got - want
        if abs(delta) > tol:
            r: Result = {"section": "element", "status": "MISMATCH", "where": where, "field": f,
                         "expected": want, "actual": _num(got), "delta": _num(delta)}
            if want != 0 and abs(got * 10 - want) <= tol * 10:
                r["hint"] = "значение в 10 раз меньше: в PRO100 единицы — см, а не мм?"
            out.append(r)
    if not out:
        out.append({"section": "element", "status": "OK", "where": where})
    return out


# ── Деталь тізімі ───────────────────────────────────────────────────────────


@dataclass
class _Exp:
    row: dict[str, Any]
    finished: tuple[float, float]
    cut: tuple[float, float]
    thickness: float
    remaining: int
    links: list[tuple["_Act", int, str]] = field(default_factory=list)


@dataclass
class _Act:
    row: PartRow
    roles: tuple[str, ...]
    dims: tuple[float, float]
    remaining: int


def _pair(a: float, b: float) -> tuple[float, float]:
    return (a, b) if a >= b else (b, a)


def _close(a: tuple[float, float], b: tuple[float, float], tol: float) -> bool:
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol


def compare_parts(scenario: str, expected: list[dict[str, Any]], actual: list[PartRow], tol: float) -> list[Result]:
    """Деталь тізімін салыстыру. Өлшем бағдарсыз (ұзын/қысқа жағы), сан «бюджетпен»:
    бір PRO100 жолы бірнеше біздің жолды жабуы мүмкін («крышка-дно» ×2 → Дно + Крышка)
    және керісінше (бір деталь екі жолға бөлінген).
    """
    exps = [_Exp(e, _pair(e["finishedLength"], e["finishedWidth"]), _pair(e["cutLength"], e["cutWidth"]),
                 float(e["thickness"]), int(e["qty"])) for e in expected]
    acts = [_Act(a, part_roles(a.name), _pair(a.length, a.width), a.count) for a in actual]

    def role_ok(e: _Exp, a: _Act) -> bool:
        return e.row.get("role") in a.roles

    def thick_ok(e: _Exp, a: _Act) -> bool:
        return abs(a.row.thickness - e.thickness) <= tol

    def take(e: _Exp, a: _Act, kind: str) -> None:
        n = min(e.remaining, a.remaining)
        e.remaining -= n
        a.remaining -= n
        e.links.append((a, n, kind))

    def run_pass(pred, kind: str, closest: bool = False) -> None:  # type: ignore[no-untyped-def]
        for e in exps:
            while e.remaining > 0:
                cands = [a for a in acts if a.remaining > 0 and pred(e, a)]
                if not cands:
                    break
                if closest:
                    cands.sort(key=lambda a: abs(a.dims[0] - e.finished[0]) + abs(a.dims[1] - e.finished[1])
                               + abs(a.row.thickness - e.thickness))
                take(e, cands[0], kind)

    run_pass(lambda e, a: role_ok(e, a) and thick_ok(e, a) and _close(a.dims, e.finished, tol), "finished")
    run_pass(lambda e, a: role_ok(e, a) and thick_ok(e, a) and _close(a.dims, e.cut, tol), "cut")
    run_pass(lambda e, a: thick_ok(e, a) and (_close(a.dims, e.finished, tol) or _close(a.dims, e.cut, tol)), "name")
    run_pass(role_ok, "size", closest=True)

    out: list[Result] = []
    for e in exps:
        where = f"{scenario} · деталь · {e.row['name']}"
        if not e.links:
            out.append({"section": "parts", "status": "MISSING", "where": where,
                        "expected": {"name": e.row["name"], "qty": e.row["qty"], "finished": list(e.finished),
                                     "cut": list(e.cut), "thickness": e.row["thickness"]}})
            continue
        problems: list[Result] = []
        for a, _n, kind in e.links:
            if kind == "name":
                problems.append({"section": "parts", "status": "MISMATCH", "where": where, "field": "name",
                                 "expected": e.row["name"], "actual": a.row.name})
            elif kind == "size":
                for f, want, got in (("length", e.finished[0], a.dims[0]), ("width", e.finished[1], a.dims[1]),
                                     ("thickness", e.thickness, a.row.thickness)):
                    if abs(got - want) > tol:
                        problems.append({"section": "parts", "status": "MISMATCH", "where": where, "field": f,
                                         "expected": _num(want), "actual": _num(got), "delta": _num(got - want),
                                         "pro100Name": a.row.name})
        if e.remaining > 0:
            matched = int(e.row["qty"]) - e.remaining
            problems.append({"section": "parts", "status": "MISMATCH", "where": where, "field": "qty",
                             "expected": e.row["qty"], "actual": matched, "delta": matched - int(e.row["qty"])})
        if problems:
            out.extend(problems)
        else:
            kinds = {k for _a, _n, k in e.links}
            out.append({"section": "parts", "status": "OK", "where": where,
                        "basis": "cut" if kinds == {"cut"} else ("mixed" if "cut" in kinds else "finished")})
    for a in acts:
        if a.remaining > 0:
            out.append({"section": "parts", "status": "EXTRA", "where": f"{scenario} · деталь · {a.row.name}",
                        "actual": {"name": a.row.name, "length": _num(a.row.length), "width": _num(a.row.width),
                                   "thickness": _num(a.row.thickness), "count": a.remaining,
                                   "material": a.row.material}})
    return out


# ── Фурнитура (Список элементов) ────────────────────────────────────────────


def compare_hardware(scenario: str, expected: list[dict[str, Any]], actual: list[ElementRow]) -> list[Result]:
    want: dict[str, tuple[str, float]] = {}
    for e in expected:
        name, qty = want.get(e["kind"], (e["name"], 0.0))
        want[e["kind"]] = (name, qty + float(e["qty"]))
    got: dict[str, tuple[str, float]] = {}
    unknown: list[ElementRow] = []
    for a in actual:
        kind = hardware_kind(a.name)
        if kind is None:
            unknown.append(a)
            continue
        name, qty = got.get(kind, (a.name, 0.0))
        got[kind] = (name, qty + float(a.count))
    out: list[Result] = []
    for kind, (name, qty) in want.items():
        where = f"{scenario} · фурнитура · {name}"
        if kind not in got:
            out.append({"section": "hardware", "status": "MISSING", "where": where, "field": kind, "expected": _num(qty)})
        elif abs(got[kind][1] - qty) > 1e-9:
            out.append({"section": "hardware", "status": "MISMATCH", "where": where, "field": kind,
                        "expected": _num(qty), "actual": _num(got[kind][1]), "delta": _num(got[kind][1] - qty),
                        "pro100Name": got[kind][0]})
        else:
            out.append({"section": "hardware", "status": "OK", "where": where, "field": kind})
    for kind, (name, qty) in got.items():
        if kind not in want:
            out.append({"section": "hardware", "status": "EXTRA", "where": f"{scenario} · фурнитура · {name}",
                        "field": kind, "actual": _num(qty)})
    for a in unknown:
        out.append({"section": "hardware", "status": "EXTRA", "where": f"{scenario} · фурнитура · {a.name}",
                    "actual": _num(a.count), "hint": "тип фурнитуры не распознан по названию"})
    return out


# ── Материал қажеттілігі: жалпы аудан ───────────────────────────────────────

AREA_UNITS = {"m²", "м²", "m2", "м2", "кв.м", "кв. м", "sq m"}


def compare_materials(scenario: str, expected: list[dict[str, Any]], actual: list[MaterialRow]) -> list[Result]:
    """Атаулар әр цехта әртүрлі, сондықтан тек ПАРАҚ материалының жалпы ауданы
    салыстырылады. Шек: PRO100 әр жолды 0.01 м²-ге дөңгелектейді."""
    want = sum(int(e["areaMm2"]) for e in expected) / 1_000_000
    area_rows = [a for a in actual if a.unit.strip().lower() in AREA_UNITS]
    got = sum(a.qty for a in area_rows)
    tol = 0.01 * max(1, len(area_rows)) + 0.005
    where = f"{scenario} · материалы · общая площадь, м²"
    if not area_rows:
        return [{"section": "materials", "status": "MISSING", "where": where, "expected": round(want, 3)}]
    delta = got - want
    status = "OK" if abs(delta) <= tol else "MISMATCH"
    r: Result = {"section": "materials", "status": status, "where": where, "field": "areaM2",
                 "expected": round(want, 3), "actual": round(got, 3)}
    if status == "MISMATCH":
        r["delta"] = round(delta, 3)
    return [r]


# ── Құн ─────────────────────────────────────────────────────────────────────


def compare_costs(scenario: str, expected: dict[str, Any], calc: Calculation | None) -> list[Result]:
    where = f"{scenario} · стоимость · итог"
    want = int(expected["total"]) / 100  # тиын → теңге
    if calc is None:
        return [{"section": "costs", "status": "MISSING", "where": where, "expected": want}]
    if calc.price_list_empty:
        return [{"section": "costs", "status": "SKIPPED", "where": where, "expected": want,
                 "hint": "в PRO100 не заполнен прайс-лист — суммы нулевые"}]
    got = calc.to_pay if calc.to_pay is not None else calc.total
    if got is None:
        return [{"section": "costs", "status": "MISSING", "where": where, "expected": want,
                 "hint": "строка ИТОГО/К ОПЛАТЕ не найдена"}]
    delta = got - want
    status = "OK" if abs(delta) <= 1 else "MISMATCH"
    r: Result = {"section": "costs", "status": status, "where": where, "field": "total",
                 "expected": want, "actual": got}
    if status == "MISMATCH":
        r["delta"] = round(delta, 2)
    return [r]
