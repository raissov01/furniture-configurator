"""Жүгіріс (runner.py): әр қадам try/except, қате бүкіл жүгірісті тоқтатпайды."""
import json
from pathlib import Path

import pytest

from pro100_bridge.driver import InsertResult, ReportTexts, StopRun, UiError
from pro100_bridge.kit import parse_kit
from pro100_bridge.runner import AUDIT_FORMAT, PROJECT_FORMAT, run_audit, run_export, write_audit

FIX = Path(__file__).parent / "fixtures"


def captured_texts() -> dict[str, str]:
    from pro100_bridge.reports import decode_report
    return {k: decode_report((FIX / "captured-s1" / f"{k}.txt").read_bytes())
            for k in ("parts", "elements", "materials", "calculation")}


def kit_dict(n_scenarios=2):
    def item(i):
        return {
            "id": f"s{i}-base", "kind": "base", "name": f"S{i} Base",
            "library": {"search": ["Н2 600"], "folderHints": ["560"]},
            "height": 720, "width": 600, "depth": 560,
            "position": {"left": 0, "bottom": 0, "back": 0}, "material": None,
        }
    exp = {
        "parts": [{"name": "Боковина", "role": "side", "qty": 2, "finishedLength": 704, "finishedWidth": 541,
                   "cutLength": 704, "cutWidth": 541, "thickness": 16, "material": "ЛДСП"}],
        "elements": [{"name": "Полкодержатель", "kind": "shelfPin", "qty": 4, "unit": "шт"}],
        "materials": [{"name": "ЛДСП", "thickness": 16, "areaMm2": 1_910_000}],
        "costs": {"total": 5_000_000, "currency": "₸"},
    }
    return {
        "format": "furniture-configurator.pro100-kit", "version": 1, "project": "kit", "tolerance": 0.5,
        "scenarios": [{"id": f"s{i}", "title": f"S{i}", "items": [item(i)], "expected": exp}
                      for i in range(1, n_scenarios + 1)],
    }


class FakeDriver:
    def __init__(self, fail=None, stop_at=None):
        self.fail = fail or set()
        self.stop_at = stop_at
        self.calls = []
        self.values = {}
        self.new_projects = 0

    def _hit(self, name):
        self.calls.append(name)
        if name in self.fail:
            raise UiError(f"сынақ қатесі: {name}")

    def environment(self): return {"driver": "fake"}
    def start(self): self._hit("start")
    def finish(self): self._hit("finish")
    def guard(self): pass

    def new_project(self):
        self.new_projects += 1
        if self.stop_at == self.new_projects:
            raise StopRun("license", "Лицензия", "Не обнаружен аппаратный ключ защиты.")
        self._hit("new_project")

    def insert_library_item(self, query):
        self._hit("insert")
        return InsertResult("fake", r"Нижние\560 глубина\Н2 600.meb", "Н2 600")

    def set_properties(self, values):
        self._hit("set_properties")
        self.values = dict(values)

    def read_properties(self):
        self._hit("read_properties")
        return dict(self.values)

    def read_status_bar(self): return {"selected": self.values.get("name"), "position": None, "extent": None}
    def set_material(self, name): self._hit("set_material")

    def export_reports(self, out_dir, basename):
        self._hit("export_reports")
        return ReportTexts("fake", {}, captured_texts())

    def save_project_as(self, path): self._hit("save_project_as")
    def list_top_elements(self): return ["Н2 600", "В 2дв 800"]

    def select_top_element(self, index):
        self.values = {"name": ["Н2 600", "В 2дв 800"][index], "width": 600, "height": 720, "depth": 560,
                       "left": 0, "bottom": 0, "back": 0}

    def screenshot(self, path): return False
    def notes(self): return ["заметка"]


def test_clean_audit_shape_and_summary(tmp_path):
    audit = run_audit(parse_kit(kit_dict(1)), FakeDriver(), tmp_path)
    assert audit["format"] == AUDIT_FORMAT and audit["version"] == 1
    assert audit["errors"] == [] and audit["stopped"] is None
    item = audit["items"][0]
    assert item["created"] is True and item["actual"]["width"] == 600
    assert item["insert"]["libraryPath"].endswith("Н2 600.meb")
    rep = audit["reports"][0]
    assert rep["source"] == "fake" and rep["parts"][0]["name"] == "боковина"
    assert rep["calculation"]["priceListEmpty"] is True
    s = audit["comparison"]["summary"]
    # элемент OK, боковина OK, полкодержатель OK, аудан MISMATCH (1.91+0.43 vs 1.91),
    # құн SKIPPED, қалған PRO100 деталі EXTRA
    assert s["OK"] == 3 and s["SKIPPED"] == 1 and s["EXTRA"] == 5
    assert audit["expected"]["project"] == "kit"


def test_step_error_is_recorded_and_run_continues(tmp_path):
    drv = FakeDriver(fail={"insert"})
    audit = run_audit(parse_kit(kit_dict(2)), drv, tmp_path)
    assert [e["step"] for e in audit["errors"]] == ["s1-base:insert", "s2-base:insert"]
    assert all(it["created"] is False and it["actual"] is None for it in audit["items"])
    assert drv.calls.count("export_reports") == 2  # есептер бәрібір оқылды
    assert "set_properties" not in drv.calls
    assert audit["comparison"]["summary"]["MISSING"] >= 2


def test_stop_run_records_reason_and_keeps_collected_data(tmp_path):
    drv = FakeDriver(stop_at=2)
    audit = run_audit(parse_kit(kit_dict(2)), drv, tmp_path)
    assert audit["stopped"]["reason"] == "license"
    assert audit["stopped"]["step"] == "s2:new-project"
    assert len(audit["items"]) == 1 and len(audit["reports"]) == 1
    assert drv.calls[-1] == "finish"  # ашқан терезелерін бәрібір жабады


def test_write_audit_files(tmp_path):
    audit = run_audit(parse_kit(kit_dict(1)), FakeDriver(), tmp_path)
    json_path, txt_path = write_audit(audit, tmp_path)
    data = json.loads(json_path.read_text(encoding="utf-8"))
    assert data["format"] == AUDIT_FORMAT
    txt = txt_path.read_text(encoding="utf-8")
    assert "Аудит PRO100" in txt and "pro100-audit.json" in txt


def test_export_project(tmp_path):
    project = run_export(FakeDriver(), tmp_path)
    assert project["format"] == PROJECT_FORMAT
    assert [e["name"] for e in project["elements"]] == ["Н2 600", "В 2дв 800"]
    assert project["elements"][0]["size"] == {"height": 720, "width": 600, "depth": 560}
    assert project["parts"][0] == {"name": "боковина", "length": 704, "width": 541, "thickness": 16,
                                   "count": 2, "material": "01 Основное для КУХНИ\\Лдсп"}
    assert project["costs"]["priceListEmpty"] is True
    assert project["notes"] == ["заметка"]


def test_start_failure_stops_everything_gracefully(tmp_path):
    audit = run_audit(parse_kit(kit_dict(1)), FakeDriver(fail={"start"}), tmp_path)
    assert audit["stopped"]["reason"] == "start-failed"
    assert audit["items"] == []


@pytest.mark.parametrize("bad", [{"format": "x"}, {"format": "furniture-configurator.pro100-kit", "version": 2}])
def test_bad_kit_rejected(bad):
    from pro100_bridge.kit import KitError
    with pytest.raises(KitError):
        parse_kit(bad)
