"""Салыстыру (compare.py): OK / MISMATCH / MISSING / EXTRA, шегі 0.5 мм."""
from pro100_bridge.compare import (
    compare_costs,
    compare_element,
    compare_hardware,
    compare_materials,
    compare_parts,
    summarize,
)
from pro100_bridge.reports import Calculation, CalcRow, ElementRow, MaterialRow, PartRow

TOL = 0.5


def exp_part(name, role, qty, fl, fw, cl=None, cw=None, t=16):
    return {
        "name": name, "role": role, "qty": qty,
        "finishedLength": fl, "finishedWidth": fw,
        "cutLength": cl if cl is not None else fl, "cutWidth": cw if cw is not None else fw,
        "thickness": t, "material": "ЛДСП Белый",
    }


def act(name, length, width, t, count):
    return PartRow(name, length, width, t, count, "01\\Лдсп")


# ── Элемент (Properties қайта оқу) ──────────────────────────────────────────

REQ = {"name": "S1", "width": 600, "height": 720, "depth": 560, "left": 0, "bottom": 0, "back": 0}


def test_element_ok_within_tolerance():
    got = dict(REQ, width=600.4)
    res = compare_element("s1-base", REQ, got, TOL)
    assert [r["status"] for r in res] == ["OK"]


def test_element_mismatch_reports_field_expected_actual_delta():
    got = dict(REQ, depth=582, left=1)
    res = compare_element("s1-base", REQ, got, TOL)
    bad = [(r["field"], r["expected"], r["actual"], r["delta"]) for r in res if r["status"] == "MISMATCH"]
    assert bad == [("depth", 560, 582, 22), ("left", 0, 1, 1)]


def test_element_boundary_exactly_half_mm_is_ok_but_more_is_not():
    assert compare_element("x", REQ, dict(REQ, height=720.5), TOL)[0]["status"] == "OK"
    assert compare_element("x", REQ, dict(REQ, height=720.51), TOL)[0]["status"] == "MISMATCH"


def test_element_missing_when_not_read():
    res = compare_element("s1-base", REQ, None, TOL)
    assert [r["status"] for r in res] == ["MISSING"]


def test_element_units_hint_when_value_is_tenfold():
    res = compare_element("x", REQ, dict(REQ, width=60, height=72, depth=56), TOL)
    assert all("см" in r["hint"] for r in res if r["status"] == "MISMATCH")


def test_element_name_mismatch():
    res = compare_element("x", REQ, dict(REQ, name="H2 600"), TOL)
    assert [(r["field"], r["status"]) for r in res] == [("name", "MISMATCH")]


# ── Деталь тізімі ───────────────────────────────────────────────────────────

EXPECTED = [
    exp_part("Боковина", "side", 2, 720, 557),
    exp_part("Дно", "bottom", 1, 568, 557),
    exp_part("Крышка", "top", 1, 568, 557),
    exp_part("Полка", "shelf", 1, 566, 557),
    exp_part("Задняя стенка", "back", 1, 720, 600, t=3),
    exp_part("Фасад", "front", 2, 714, 295, cl=710, cw=291),
]


def clean_actual():
    return [
        act("боковина", 720, 557, 16, 2),
        act("дно", 568, 557, 16, 1),
        act("крышка", 568, 557, 16, 1),
        act("полка", 566, 557, 16, 1),
        act("задняя  стенка", 720, 600, 3, 1),
        act("дверь", 714, 295, 16, 2),
    ]


def test_parts_clean_all_ok():
    res = compare_parts("s1", EXPECTED, clean_actual(), TOL)
    assert summarize(res) == {"OK": 6, "MISMATCH": 0, "MISSING": 0, "EXTRA": 0, "SKIPPED": 0}


def test_parts_sizes_are_orientation_free():
    rows = clean_actual()
    rows[0] = act("боковина", 557, 720, 16, 2)
    assert summarize(compare_parts("s1", EXPECTED, rows, TOL))["OK"] == 6


def test_parts_cut_basis_is_ok_but_marked():
    rows = clean_actual()
    rows[5] = act("дверь", 710, 291, 16, 2)
    res = compare_parts("s1", EXPECTED, rows, TOL)
    front = [r for r in res if r["where"].endswith("Фасад")][0]
    assert front["status"] == "OK" and front["basis"] == "cut"


def test_parts_size_mismatch_gives_delta_per_field():
    rows = clean_actual()
    rows[0] = act("боковина", 704, 541, 16, 2)
    res = compare_parts("s1", EXPECTED, rows, TOL)
    bad = [(r["field"], r["expected"], r["actual"], r["delta"]) for r in res if r["status"] == "MISMATCH"]
    assert bad == [("length", 720, 704, -16), ("width", 557, 541, -16)]


def test_parts_thickness_mismatch():
    rows = clean_actual()
    rows[5] = act("дверь", 714, 295, 19, 2)
    res = compare_parts("s1", EXPECTED, rows, TOL)
    assert [(r["field"], r["delta"]) for r in res if r["status"] == "MISMATCH"] == [("thickness", 3)]


def test_parts_name_mismatch_when_only_size_matches():
    rows = clean_actual()
    rows[3] = act("щит", 566, 557, 16, 1)
    res = compare_parts("s1", EXPECTED, rows, TOL)
    bad = [r for r in res if r["status"] == "MISMATCH"]
    assert [(r["field"], r["expected"], r["actual"]) for r in bad] == [("name", "Полка", "щит")]


def test_parts_qty_budget_combined_top_bottom_row():
    rows = clean_actual()
    rows[1:3] = [act("крышка-дно", 568, 557, 16, 2)]
    assert summarize(compare_parts("s1", EXPECTED, rows, TOL))["OK"] == 6


def test_parts_qty_mismatch_missing_and_extra():
    rows = clean_actual()
    rows[0] = act("боковина", 720, 557, 16, 1)      # 2 орнына 1
    del rows[3]                                      # полка жоқ
    rows.append(act("цоколь", 568, 80, 16, 2))       # артық
    res = compare_parts("s1", EXPECTED, rows, TOL)
    s = summarize(res)
    assert (s["MISMATCH"], s["MISSING"], s["EXTRA"]) == (1, 1, 1)
    qty = [r for r in res if r.get("field") == "qty"][0]
    assert (qty["expected"], qty["actual"]) == (2, 1)
    extra = [r for r in res if r["status"] == "EXTRA"][0]
    assert extra["actual"]["name"] == "цоколь" and extra["actual"]["count"] == 2


def test_parts_split_rows_are_summed():
    rows = clean_actual()
    rows[5] = act("дверь", 714, 295, 16, 1)
    rows.append(act("дверь", 714, 295, 16, 1))
    assert summarize(compare_parts("s1", EXPECTED, rows, TOL))["OK"] == 6


# ── Фурнитура, материал, құн ────────────────────────────────────────────────

def test_hardware_by_kind():
    expected = [{"name": "Полкодержатель", "kind": "shelfPin", "qty": 4, "unit": "шт"},
                {"name": "Петля", "kind": "hinge", "qty": 4, "unit": "шт"}]
    actual = [ElementRow("полкодержатель", 4), ElementRow("ножка опорная под цоколь", 4)]
    res = compare_hardware("s1", expected, actual)
    assert sorted((r["status"], r["where"].split(" ")[-1]) for r in res) == [
        ("EXTRA", "цоколь"), ("MISSING", "Петля"), ("OK", "Полкодержатель"),
    ]


def test_materials_total_area():
    expected = [{"name": "ЛДСП", "thickness": 16, "areaMm2": 1_910_000},
                {"name": "ХДФ", "thickness": 3, "areaMm2": 432_000}]
    ok = compare_materials("s1", expected, [MaterialRow("Лдсп", 1.91, "m²"), MaterialRow("Двп", 0.43, "m²")])
    assert [r["status"] for r in ok] == ["OK"]
    bad = compare_materials("s1", expected, [MaterialRow("Лдсп", 2.50, "м²"), MaterialRow("Кромка", 9.6, "м")])
    assert bad[0]["status"] == "MISMATCH" and round(bad[0]["delta"], 3) == 0.158


def test_costs_skipped_when_price_list_empty():
    calc = Calculation(rows=[CalcRow("TOTAL", "TOTAL", "", 0, "pc", 0, 0, 0, 0, 0)], total=0.0)
    assert compare_costs("s1", {"total": 1_000_00, "currency": "₸"}, calc)[0]["status"] == "SKIPPED"


def test_costs_compare_to_pay_in_tenge():
    calc = Calculation(rows=[CalcRow("К ОПЛАТЕ", "", "", None, "", None, 1000, None, None, 1000)], total=1000.0, to_pay=1000.0)
    assert compare_costs("s1", {"total": 100_000, "currency": "₸"}, calc)[0]["status"] == "OK"
    res = compare_costs("s1", {"total": 90_000, "currency": "₸"}, calc)[0]
    assert res["status"] == "MISMATCH" and res["delta"] == 100


def test_costs_missing_without_report():
    assert compare_costs("s1", {"total": 1, "currency": "₸"}, None)[0]["status"] == "MISSING"


def test_hardware_accessories_are_not_merged_into_main_item():
    expected = [{"name": "Петля Blum с доводчиком", "kind": "hinge", "qty": 4, "unit": "шт"},
                {"name": "Планка ответная под петлю", "kind": "hinge", "qty": 4, "unit": "шт"},
                {"name": "Конфирмат (евровинт) 7×50", "kind": "confirmat", "qty": 12, "unit": "шт"},
                {"name": "Заглушка на конфирмат", "kind": "confirmat", "qty": 12, "unit": "шт"}]
    actual = [ElementRow("петля 110 накладная", 4), ElementRow("конфирмат", 12)]
    res = compare_hardware("s1", expected, actual)
    assert sorted((r["field"], r["status"]) for r in res) == [
        ("cap", "MISSING"), ("confirmat", "OK"), ("hinge", "OK"), ("hingePlate", "MISSING"),
    ]


def test_parts_boundary_half_mm_for_unrecognized_name():
    """Шек (0.5 мм қоса) тек өлшем бойынша жұптауда да қолданылады."""
    res = compare_parts("s1", [EXPECTED[0]], [act("щит", 720.5, 557, 16, 2)], TOL)
    assert [(r["status"], r.get("field")) for r in res] == [("MISMATCH", "name")]
