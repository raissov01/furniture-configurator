"""ui_pro100 тұрақтыларын дамппен айқастыру (GUI-сіз, Linux-та).

`fixtures/menu-raw.json` — PRO100 v7.08 мәзірінің нақты дампы
(pywinauto menu_items(), 2026-09-24, ағылшынша интерфейс).
"""
import json
from pathlib import Path

from pro100_bridge import ui_pro100 as ui

MENU = json.loads((Path(__file__).parent / "fixtures" / "menu-raw.json").read_text(encoding="utf-8"))


def test_module_imports_without_pywinauto():
    import sys
    assert "pywinauto" not in sys.modules


def test_menu_refs_match_dump_ids():
    refs = [v for v in vars(ui).values() if isinstance(v, ui.MenuRef)]
    assert len(refs) >= 7
    for ref in refs:
        item = MENU["menu_items"][ref.top]["menu_items"]["menu_items"][ref.pos]
        assert item["item_id"] == ref.recorded_id, ref.label
        assert item["item_type"] & 0x800 == 0, f"{ref.label}: бөлгіш сызыққа түсті"


def test_properties_field_order_is_h_w_d_complete():
    assert set(ui.SPIN_FIELDS_TOP_TO_BOTTOM) == {"width", "height", "depth", "left", "bottom", "back"}


def test_escape_keys():
    assert ui.escape_keys("S1 (600+2)") == "S1 {(}600{+}2{)}"
