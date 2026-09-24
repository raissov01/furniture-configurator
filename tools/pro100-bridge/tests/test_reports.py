"""PRO100 есеп файлдарын талдау (reports.py)."""
from pathlib import Path

from pro100_bridge.reports import (
    decode_report,
    parse_calculation,
    parse_elements,
    parse_materials,
    parse_number,
    parse_parts,
    report_kind_from_title,
)

FIX = Path(__file__).parent / "fixtures"


def read(rel: str) -> str:
    return decode_report((FIX / rel).read_bytes())


# ── Нақты PRO100 файлдары ───────────────────────────────────────────────────

def test_captured_parts_eight_columns():
    rows, unparsed = parse_parts(read("captured-s1/parts.txt"))
    assert unparsed == []
    assert [r.name for r in rows] == ["боковина", "дверь", "задняя  стенка", "крышка-дно", "полка", "цоколь"]
    side = rows[0]
    assert (side.length, side.width, side.thickness, side.count) == (704, 541, 16, 2)
    assert side.material == "01 Основное для КУХНИ\\Лдсп"
    assert side.edges_length == "   " and side.edges_width == "   "


def test_captured_library_parts_have_blank_names():
    rows, unparsed = parse_parts(read("captured-s1/library-base-parts.txt"))
    assert unparsed == []
    assert rows[0].name == "" and (rows[0].length, rows[0].width, rows[0].thickness) == (600, 40, 600)
    assert len(rows) == 9


def test_captured_elements_and_materials():
    elements, bad = parse_elements(read("captured-s1/elements.txt"))
    assert bad == []
    assert [(e.name, e.count) for e in elements] == [("полкодержатель", 4)]
    materials, bad = parse_materials(read("captured-s1/materials.txt"))
    assert bad == []
    assert [(m.name, m.qty, m.unit) for m in materials] == [
        ("01 Основное для КУХНИ\\Двп 4мм", 0.43, "m²"),
        ("01 Основное для КУХНИ\\Лдсп", 1.91, "m²"),
    ]


def test_captured_calculation_empty_price_list():
    calc = parse_calculation(read("captured-s1/calculation.txt"))
    assert calc.total == 0.0
    assert calc.to_pay is None
    assert [r.label for r in calc.rows][2:7] == ["materials", "elements", "assembly", "others", "TOTAL"]
    assert calc.price_list_empty is True


# ── Синтетикалық файлдар (орысша, cp1251, үтір) ─────────────────────────────

def test_synthetic_cp1251_parts_with_header():
    rows, unparsed = parse_parts(read("synthetic/parts-ru-cp1251.txt"))
    assert unparsed == []
    assert rows[0].name == "Боковина" and rows[0].length == 720 and rows[0].width == 557
    assert rows[-1].name == "Фасад" and rows[-1].count == 2


def test_synthetic_elements_and_materials_comma_decimal():
    elements, _ = parse_elements(read("synthetic/elements-ru-cp1251.txt"))
    assert [e.count for e in elements] == [4, 4, 2]
    materials, _ = parse_materials(read("synthetic/materials-ru-utf8.txt"))
    assert materials[0].qty == 1.93 and materials[0].unit == "м²"
    assert materials[2].unit == "м" and materials[2].qty == 9.6


def test_synthetic_calculation_nine_columns_totals():
    calc = parse_calculation(read("synthetic/calculation-ru-utf8.txt"))
    assert calc.total == 13401.92
    assert calc.discount == -1340.19
    assert calc.to_pay == 12061.73
    assert calc.price_list_empty is False
    assert calc.rows[0].category == "материалы" and calc.rows[0].name == "ЛДСП\\Белый W980"


# ── Көмекші функциялар ──────────────────────────────────────────────────────

def test_parse_number_variants():
    assert parse_number("1 234,50") == 1234.5
    assert parse_number("1 234.5") == 1234.5
    assert parse_number("-3") == -3
    assert parse_number("") is None
    assert parse_number("abc") is None


def test_decode_prefers_utf8_then_cp1251():
    assert decode_report("﻿полка".encode("utf-8")) == "полка"
    assert decode_report("полка".encode("cp1251")) == "полка"
    assert decode_report("полка".encode("utf-16")) == "полка"


def test_unparsed_lines_are_kept_not_dropped():
    rows, unparsed = parse_parts("боковина\tabc\t\t541\t\t16\t2\tЛдсп\r\nполка\t566\t\t541\t\t16\t1\tЛдсп")
    assert [r.name for r in rows] == ["полка"]
    assert unparsed == ["боковина\tabc\t\t541\t\t16\t2\tЛдсп"]


def test_six_column_parts_without_edge_columns():
    rows, unparsed = parse_parts("полка\t566\t541\t16\t1\tЛдсп")
    assert unparsed == [] and rows[0].width == 541 and rows[0].material == "Лдсп"


def test_report_kind_from_title_both_languages():
    assert report_kind_from_title("Save piece list") == "parts"
    assert report_kind_from_title("Save element list") == "elements"
    assert report_kind_from_title("Save material consumption") == "materials"
    assert report_kind_from_title("Save calculation") == "calculation"
    assert report_kind_from_title("Сохранение списка деталей") == "parts"
    assert report_kind_from_title("Сохранение списка элементов") == "elements"
    assert report_kind_from_title("Сохранение потребности в материалах") == "materials"
    assert report_kind_from_title("Сохранение расчёта стоимости проекта") == "calculation"
    assert report_kind_from_title("Save as") is None
