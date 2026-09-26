"""CLI `--dry-run`: Linux-та GUI-сіз толық жүгіріс, ui_pro100 импортталмайды."""
import json
import io
import sys
from pathlib import Path

from pro100_bridge.cli import main

FIX = Path(__file__).parent / "fixtures"


def write_kit(tmp_path: Path) -> Path:
    from test_runner import kit_dict  # noqa: PLC0415
    path = tmp_path / "pro100-test-kit.json"
    path.write_text(json.dumps(kit_dict(2), ensure_ascii=False), encoding="utf-8")
    return path


def test_dry_run_audit_writes_files_without_gui(tmp_path, capsys):
    kit = write_kit(tmp_path)
    out = tmp_path / "out"
    code = main(["audit", str(kit), "--dry-run", "--out", str(out), "--reports-from", str(FIX / "captured-s1")])
    assert code == 3  # айырмалар бар (жинақ әдейі толық емес)
    audit = json.loads((out / "pro100-audit.json").read_text(encoding="utf-8"))
    assert audit["environment"]["dryRun"] is True and audit["environment"]["driver"] == "dry-run"
    assert audit["reports"][0]["parts"][0]["name"] == "боковина"
    assert (out / "pro100-audit.txt").read_text(encoding="utf-8").startswith("Аудит PRO100")
    assert "ui_pro100" not in sys.modules
    assert "[dry-run] Element > Properties" in capsys.readouterr().out


def test_main_reconfigures_cp1251_console_before_logging(tmp_path, monkeypatch):
    output = io.BytesIO()
    errors = io.BytesIO()
    monkeypatch.setattr(sys, "stdout", io.TextIOWrapper(output, encoding="cp1251", errors="strict"))
    monkeypatch.setattr(sys, "stderr", io.TextIOWrapper(errors, encoding="cp1251", errors="strict"))
    code = main(["audit", str(write_kit(tmp_path)), "--dry-run", "--out", str(tmp_path / "out")])
    assert code in (0, 3, 4)
    assert sys.stdout.encoding == "utf-8"
    assert sys.stderr.encoding == "utf-8"
    assert b"\xe2\x86\x92" in output.getvalue()


def test_dry_run_library_listing_missing_item_is_step_error(tmp_path):
    kit = write_kit(tmp_path)
    lib = tmp_path / "lib" / "Нижние"
    lib.mkdir(parents=True)
    (lib / "Н 2дв 400.meb").write_bytes(b"")
    out = tmp_path / "out"
    code = main(["audit", str(kit), "--dry-run", "--out", str(out), "--library", str(tmp_path / "lib")])
    audit = json.loads((out / "pro100-audit.json").read_text(encoding="utf-8"))
    assert code == 3
    assert audit["errors"][0]["step"] == "s1-base:insert" and "Н2 600" in audit["errors"][0]["error"]


def test_bad_kit_exit_code(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text("{}", encoding="utf-8")
    assert main(["audit", str(bad), "--dry-run"]) == 2


def test_dry_run_export_project(tmp_path):
    out = tmp_path / "proj"
    code = main(["export-project", "--dry-run", "--out", str(out), "--reports-from", str(FIX / "captured-s1")])
    assert code == 0
    project = json.loads((out / "pro100-project.json").read_text(encoding="utf-8"))
    assert project["format"] == "furniture-configurator.pro100-project"
    assert [p["name"] for p in project["parts"]][:2] == ["боковина", "дверь"]
