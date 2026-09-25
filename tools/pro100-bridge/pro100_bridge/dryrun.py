"""GUI-сіз драйвер: әр әрекетті журналға жазады (`--dry-run`).

Linux-та логиканы (kit → жүгіріс → салыстыру → файлдар) толық тексеруге
арналған. PRO100-ге ЕШТЕҢЕ жібермейді. Properties қайта оқу — соңғы енгізілген
мәнді қайтарады; есептер `--reports-from` қалтасынан алынады (болмаса бос).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from .driver import InsertResult, ReportTexts, UiError
from .kit import LibraryQuery
from .library import find_library_item
from .reports import decode_report, report_kind_from_title


class DryRunDriver:
    def __init__(self, *, library_listing: list[str] | None = None, reports_from: Path | None = None,
                 log: Callable[[str], None] = print) -> None:
        self.library_listing = library_listing
        self.reports_from = reports_from
        self.log = log
        self.actions: list[str] = []
        self._values: dict[str, Any] = {}
        self._notes: list[str] = []

    def _act(self, text: str) -> None:
        self.actions.append(text)
        self.log(f"    [dry-run] {text}")

    def environment(self) -> dict[str, Any]:
        return {"driver": "dry-run"}

    def start(self) -> None:
        self._act("найти окно PRO100 (процесс PRO100.exe), проверить модальные окна")

    def finish(self) -> None:
        self._act("закрыть окна, открытые мостом (Catalog/Structure/Reports)")

    def guard(self) -> None:
        self._act("проверить окна лицензии/активации")

    def new_project(self) -> None:
        self._act("File > New (menu 0/0, id 3) → Room properties → OK")

    def insert_library_item(self, query: LibraryQuery) -> InsertResult:
        path = None
        if self.library_listing is not None:
            m = find_library_item(self.library_listing, query)
            if m is None:
                raise UiError(f"в библиотеке не найден ни один из: {', '.join(query.search)}")
            path = m.path
        self._act(f"вставить из каталога: {path or ' | '.join(query.search)}")
        return InsertResult("dry-run", path, None)

    def set_properties(self, values: dict[str, Any]) -> None:
        self._act("Element > Properties (menu 3/16, id 136) → General: " + ", ".join(f"{k}={v}" for k, v in values.items()) + " → OK")
        self._values = dict(values)

    def read_properties(self) -> dict[str, Any]:
        self._act("Element > Properties → прочитать 6 полей TUnitSpinEdit → Cancel")
        return dict(self._values)

    def read_status_bar(self) -> dict[str, Any]:
        return {"selected": None, "position": None, "extent": None}

    def set_material(self, name: str) -> None:
        self._act(f"Properties > Material > Change > Select material: «{name}» → Select → OK")

    def export_reports(self, out_dir: Path, basename: str) -> ReportTexts:
        self._act(f"Tools > Reports and calculation (menu 4/15, id 148) → Save all... → {out_dir}")
        texts: dict[str, str] = {}
        files: dict[str, str] = {}
        if self.reports_from is not None:
            # Бір түрге бірнеше файл болса — атауы ең қысқасы («parts.txt» > «library-base-parts.txt»).
            for f in sorted(self.reports_from.glob("*.txt"), key=lambda p: (len(p.stem), p.name)):
                kind = report_kind_from_title(f.stem.replace("-", " ")) or _kind_from_short(f.stem)
                if kind and kind not in texts:
                    texts[kind] = decode_report(f.read_bytes())
                    files[kind] = str(f)
        return ReportTexts("dry-run", files, texts)

    def save_project_as(self, path: Path) -> None:
        self._act(f"File > Save as (menu 0/7, id 11) → {path}")

    def list_top_elements(self) -> list[str]:
        self._act("Tools > Structure (menu 4/2, id 140) → верхние узлы дерева")
        return []

    def select_top_element(self, index: int) -> None:
        self._act(f"Structure: выбрать узел {index}")

    def screenshot(self, path: Path) -> bool:
        return False

    def notes(self) -> list[str]:
        return list(self._notes)


def _kind_from_short(stem: str) -> str | None:
    s = stem.lower()
    for kind in ("parts", "elements", "materials", "calculation"):
        if kind in s:
            return kind
    return None
