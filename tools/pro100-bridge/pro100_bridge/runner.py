"""Жүгіріс: тест-жинақты PRO100-да қайта құру (audit) және ашық жобаны
оқу (export-project). Тек `Pro100Driver` протоколын біледі — GUI жоқ.

Ереже: әр қадам try/except ішінде; қадамның қатесі `errors`-қа жазылады да,
жүгіріс ЖАЛҒАСАДЫ. Тек `StopRun` (лицензия терезесі, пайдаланушының
сақталмаған жобасы) бүкіл жүгірісті тоқтатады — сонда да жиналған деректер
мен салыстыру файлға жазылады.
"""
from __future__ import annotations

import json
import platform
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterator

from . import __version__
from .compare import (
    Result,
    compare_costs,
    compare_element,
    compare_hardware,
    compare_materials,
    compare_parts,
    summarize,
)
from .driver import Pro100Driver, StopRun
from .kit import Kit
from .reports import Calculation, parse_calculation, parse_elements, parse_materials, parse_parts
from .summary_ru import audit_summary_ru

AUDIT_FORMAT = "furniture-configurator.pro100-audit"
PROJECT_FORMAT = "furniture-configurator.pro100-project"
AUDIT_JSON = "pro100-audit.json"
AUDIT_TXT = "pro100-audit.txt"
PROJECT_JSON = "pro100-project.json"


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


class Recorder:
    """Қадамдар журналы, қателер және скриншоттар."""

    def __init__(self, driver: Pro100Driver, out_dir: Path, log: Callable[[str], None]) -> None:
        self.driver = driver
        self.out_dir = out_dir
        self.log = log
        self.errors: list[dict[str, str]] = []
        self.steps: list[dict[str, Any]] = []
        self.shots: list[str] = []
        self.current = ""

    @contextmanager
    def step(self, name: str) -> Iterator[None]:
        self.current = name
        started = time.monotonic()
        self.log(f"→ {name}")
        entry: dict[str, Any] = {"step": name, "ok": False}
        self.steps.append(entry)
        try:
            yield
            entry["ok"] = True
        except StopRun:
            raise
        except Exception as err:  # noqa: BLE001 — әр қадамның қатесі жазылады, жүгіріс жалғасады
            msg = f"{type(err).__name__}: {err}"
            self.errors.append({"step": name, "error": msg})
            self.log(f"  ✗ {msg}")
            self.shot(f"error-{name}")
        finally:
            entry["seconds"] = round(time.monotonic() - started, 2)

    def shot(self, name: str) -> None:
        safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in name)[:60]
        rel = f"shots/{len(self.shots) + 1:03d}-{safe}.png"
        try:
            if self.driver.screenshot(self.out_dir / rel):
                self.shots.append(rel)
        except Exception as err:  # noqa: BLE001 — скриншот жоқ болса да жұмыс тоқтамайды
            self.errors.append({"step": f"screenshot:{name}", "error": f"{type(err).__name__}: {err}"})


# ── Есеп мәтінін JSON-ға ────────────────────────────────────────────────────


def _parts_json(text: str | None) -> tuple[list[dict[str, Any]], list[str]]:
    if not text:
        return [], []
    rows, bad = parse_parts(text)
    return [{
        "name": r.name, "length": _n(r.length), "width": _n(r.width), "thickness": _n(r.thickness),
        "count": r.count, "material": r.material,
    } for r in rows], bad


def _n(v: float) -> float | int:
    return int(v) if float(v).is_integer() else v


def _calc_json(calc: Calculation | None) -> dict[str, Any] | None:
    if calc is None:
        return None
    return {
        "rows": [{
            "label": r.label, "category": r.category, "name": r.name, "qty": r.qty, "unit": r.unit,
            "price": r.price, "sumWithoutVat": r.sum_without_vat, "vatPercent": r.vat_percent,
            "vat": r.vat, "sumWithVat": r.sum_with_vat,
        } for r in calc.rows],
        "total": calc.total, "discount": calc.discount, "toPay": calc.to_pay,
        "priceListEmpty": calc.price_list_empty, "unparsed": calc.unparsed,
    }


def parse_report_texts(texts: dict[str, str]) -> dict[str, Any]:
    parts, bad_parts = _parts_json(texts.get("parts"))
    elements, bad_el = parse_elements(texts["elements"]) if texts.get("elements") else ([], [])
    materials, bad_mat = parse_materials(texts["materials"]) if texts.get("materials") else ([], [])
    calc = parse_calculation(texts["calculation"]) if texts.get("calculation") else None
    return {
        "parts": parts,
        "elements": [{"name": e.name, "count": e.count} for e in elements],
        "materials": [{"name": m.name, "qty": m.qty, "unit": m.unit} for m in materials],
        "calculation": _calc_json(calc),
        "unparsed": {"parts": bad_parts, "elements": bad_el, "materials": bad_mat},
    }


# ── Салыстыру (файлдағы шикі деректен, TS те дәл солай қайталайды) ──────────


def build_comparison(kit: Kit, items: list[dict[str, Any]], reports: list[dict[str, Any]]) -> dict[str, Any]:
    from .reports import CalcRow, ElementRow, MaterialRow, PartRow

    results: list[Result] = []
    tol = kit.tolerance
    by_scenario = {r["scenario"]: r for r in reports}
    for sc in kit.scenarios:
        for it in (i for i in items if i["scenario"] == sc.id):
            results.extend(compare_element(it["id"], it["requested"], it["actual"], tol))
        rep = by_scenario.get(sc.id)
        if rep is None:
            # Бұл сценарийге жетпей тоқтады: салыстыру жоқ, бірақ жоғалғаны көрінсін.
            results.append({"section": "reports", "status": "MISSING", "where": f"{sc.id} · отчёты"})
            continue
        parts = [PartRow(p["name"], p["length"], p["width"], p["thickness"], p["count"], p["material"])
                 for p in rep["parts"]]
        results.extend(compare_parts(sc.id, sc.expected["parts"], parts, tol))
        results.extend(compare_hardware(sc.id, sc.expected["elements"],
                                        [ElementRow(e["name"], e["count"]) for e in rep["elements"]]))
        results.extend(compare_materials(sc.id, sc.expected["materials"],
                                         [MaterialRow(m["name"], m["qty"], m["unit"]) for m in rep["materials"]]))
        cj = rep["calculation"]
        calc = None
        if cj is not None:
            calc = Calculation(
                rows=[CalcRow(r["label"], r["category"], r["name"], r["qty"], r["unit"], r["price"],
                              r["sumWithoutVat"], r["vatPercent"], r["vat"], r["sumWithVat"]) for r in cj["rows"]],
                total=cj["total"], discount=cj["discount"], to_pay=cj["toPay"])
        results.extend(compare_costs(sc.id, sc.expected["costs"], calc))
    return {"summary": summarize(results), "results": results}


# ── audit ───────────────────────────────────────────────────────────────────


def _environment(driver: Pro100Driver, dry_run: bool) -> dict[str, Any]:
    env: dict[str, Any] = {
        "bridgeVersion": __version__,
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "dryRun": dry_run,
    }
    try:
        env.update(driver.environment())
    except Exception as err:  # noqa: BLE001
        env["environmentError"] = f"{type(err).__name__}: {err}"
    return env


def run_audit(kit: Kit, driver: Pro100Driver, out_dir: Path, *, dry_run: bool = False,
              log: Callable[[str], None] = lambda _m: None) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    rec = Recorder(driver, out_dir, log)
    items: list[dict[str, Any]] = []
    reports: list[dict[str, Any]] = []
    stopped: dict[str, Any] | None = None
    run_at = _now()
    try:
        started = False
        with rec.step("start"):
            driver.start()
            started = True
        if not started:
            raise StopRun("start-failed", None, rec.errors[-1]["error"] if rec.errors else None)
        rec.shot("start")
        for sc in kit.scenarios:
            sc_dir = out_dir / sc.id
            sc_dir.mkdir(parents=True, exist_ok=True)
            with rec.step(f"{sc.id}:new-project"):
                driver.new_project()
            for item in sc.items:
                entry: dict[str, Any] = {
                    "id": item.id, "scenario": sc.id, "kind": item.kind, "requested": item.requested(),
                    "library": {"search": item.library.search, "folderHints": item.library.folder_hints},
                    "created": False, "insert": None, "actual": None, "statusBar": None,
                    "material": {"requested": item.material, "applied": False},
                }
                items.append(entry)
                with rec.step(f"{item.id}:insert"):
                    res = driver.insert_library_item(item.library)
                    entry["insert"] = {"strategy": res.strategy, "libraryPath": res.library_path,
                                       "selected": res.selected}
                    entry["created"] = True
                rec.shot(f"{item.id}-inserted")
                if not entry["created"]:
                    continue
                with rec.step(f"{item.id}:set-properties"):
                    driver.set_properties(item.requested())
                if item.material:
                    with rec.step(f"{item.id}:set-material"):
                        driver.set_material(item.material)
                        entry["material"]["applied"] = True
                with rec.step(f"{item.id}:read-back"):
                    entry["actual"] = driver.read_properties()
                    entry["statusBar"] = driver.read_status_bar()
                rec.shot(f"{item.id}-applied")
            with rec.step(f"{sc.id}:reports"):
                texts = driver.export_reports(sc_dir, sc.id)
                rep = {"scenario": sc.id, "source": texts.source,
                       "files": {k: _rel(v, out_dir) for k, v in texts.files.items()},
                       "rawText": texts.texts, **parse_report_texts(texts.texts)}
                reports.append(rep)
            rec.shot(f"{sc.id}-reports")
            with rec.step(f"{sc.id}:save-project"):
                driver.save_project_as(sc_dir / f"{sc.id}.sto")
    except StopRun as stop:
        stopped = {"reason": stop.reason, "window": stop.window, "detail": stop.detail, "step": rec.current}
        log(f"■ ОСТАНОВЛЕНО: {stop}")
        rec.shot("stopped")
    finally:
        with rec.step("finish"):
            driver.finish()
    try:
        notes = driver.notes()
    except Exception:  # noqa: BLE001
        notes = []
    return {
        "format": AUDIT_FORMAT,
        "version": 1,
        "project": kit.project,
        "runAt": run_at,
        "tolerance": kit.tolerance,
        "environment": _environment(driver, dry_run),
        "items": items,
        "reports": reports,
        "comparison": build_comparison(kit, items, reports),
        "errors": rec.errors,
        "stopped": stopped,
        "steps": rec.steps,
        "shots": rec.shots,
        "notes": notes,
        "expected": kit.raw,
    }


def _rel(path: str, base: Path) -> str:
    try:
        return str(Path(path).resolve().relative_to(base.resolve()))
    except ValueError:
        return str(path)


def write_audit(audit: dict[str, Any], out_dir: Path) -> tuple[Path, Path]:
    json_path = out_dir / AUDIT_JSON
    txt_path = out_dir / AUDIT_TXT
    json_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    txt_path.write_text(audit_summary_ru(audit), encoding="utf-8")
    return json_path, txt_path


# ── export-project ──────────────────────────────────────────────────────────


def run_export(driver: Pro100Driver, out_dir: Path, *, dry_run: bool = False,
               log: Callable[[str], None] = lambda _m: None) -> dict[str, Any]:
    """Пайдаланушы АШҚАН жобаны оқу. Жоба өзгертілмейді және сақталмайды:
    тек Structure-дағы жоғарғы элементтердің Properties мәндері (Cancel-мен
    жабылады) және есептер (шығыс қалтасына) оқылады."""
    out_dir.mkdir(parents=True, exist_ok=True)
    rec = Recorder(driver, out_dir, log)
    elements: list[dict[str, Any]] = []
    report: dict[str, Any] = parse_report_texts({})
    source = "none"
    stopped = None
    try:
        started = False
        with rec.step("start"):
            driver.start()
            started = True
        if not started:
            raise StopRun("start-failed", None, rec.errors[-1]["error"] if rec.errors else None)
        rec.shot("project")
        names: list[str] = []
        with rec.step("structure"):
            names = driver.list_top_elements()
        for i, name in enumerate(names):
            with rec.step(f"element-{i}"):
                driver.select_top_element(i)
                props = driver.read_properties()
                elements.append({
                    "index": i,
                    "name": props.get("name") or name,
                    "structureName": name,
                    # Рет әрқашан H × W × D (CLAUDE.md §0.1).
                    "size": {"height": props.get("height"), "width": props.get("width"), "depth": props.get("depth")},
                    "position": {"left": props.get("left"), "bottom": props.get("bottom"), "back": props.get("back")},
                    "statusBar": driver.read_status_bar(),
                })
        with rec.step("reports"):
            texts = driver.export_reports(out_dir / "reports", "project")
            source = texts.source
            report = parse_report_texts(texts.texts)
        rec.shot("reports")
    except StopRun as stop:
        stopped = {"reason": stop.reason, "window": stop.window, "detail": stop.detail, "step": rec.current}
    finally:
        with rec.step("finish"):
            driver.finish()
    calc = report["calculation"]
    try:
        notes = driver.notes()
    except Exception:  # noqa: BLE001
        notes = []
    return {
        "format": PROJECT_FORMAT,
        "version": 1,
        "exportedAt": _now(),
        "environment": _environment(driver, dry_run),
        "reportsSource": source,
        "elements": elements,
        "parts": report["parts"],
        "hardware": report["elements"],
        "materials": report["materials"],
        "costs": {
            "total": calc["total"] if calc else None,
            "discount": calc["discount"] if calc else None,
            "toPay": calc["toPay"] if calc else None,
            "priceListEmpty": calc["priceListEmpty"] if calc else None,
            "rows": calc["rows"] if calc else [],
        },
        "unparsed": report["unparsed"],
        "errors": rec.errors,
        "stopped": stopped,
        "shots": rec.shots,
        "notes": notes,
    }
