"""PRO100-ды басқару интерфейсі (протокол). Екі іске асыруы бар:

- `ui_pro100.Pro100UI` — нақты GUI (pywinauto, тек Windows-та);
- `dryrun.DryRunDriver` — GUI-сіз, әр әрекетті журналға жазады (Linux-та тест үшін).

`runner.py` тек осы протоколды біледі.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from .kit import LibraryQuery


class StopRun(Exception):
    """Жұмысты ТОҚТАТУ керек: лицензия/активация терезесі, пайдаланушының
    сақталмаған жобасы т.б. Қадам қатесі емес — бүкіл жүгіріс тоқтайды."""

    def __init__(self, reason: str, window: str | None = None, detail: str | None = None) -> None:
        super().__init__(f"{reason}: {window or ''} {detail or ''}".strip())
        self.reason = reason
        self.window = window
        self.detail = detail


class UiError(Exception):
    """Бір қадам орындалмады (терезе табылмады, мән енгізілмеді)."""


@dataclass
class InsertResult:
    strategy: str                 # қай тәсілмен қойылды
    library_path: str | None      # кітапханадағы салыстырмалы жол
    selected: str | None          # статус жолындағы «Selected element» аты


@dataclass
class ReportTexts:
    source: str                                            # 'save-all' | 'clipboard' | 'dry-run' | 'none'
    files: dict[str, str] = field(default_factory=dict)    # түр → сақталған файл
    texts: dict[str, str] = field(default_factory=dict)    # түр → мәтін


class Pro100Driver(Protocol):
    def environment(self) -> dict[str, Any]: ...
    def start(self) -> None: ...
    def finish(self) -> None: ...
    def guard(self) -> None: ...
    def new_project(self) -> None: ...
    def insert_library_item(self, query: LibraryQuery) -> InsertResult: ...
    def set_properties(self, values: dict[str, Any]) -> None: ...
    def read_properties(self) -> dict[str, Any]: ...
    def read_status_bar(self) -> dict[str, Any]: ...
    def set_material(self, name: str) -> None: ...
    def export_reports(self, out_dir: Path, basename: str) -> ReportTexts: ...
    def save_project_as(self, path: Path) -> None: ...
    def list_top_elements(self) -> list[str]: ...
    def select_top_element(self, index: int) -> None: ...
    def screenshot(self, path: Path) -> bool: ...
    def notes(self) -> list[str]: ...
