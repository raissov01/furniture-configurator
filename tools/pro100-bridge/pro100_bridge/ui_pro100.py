"""PRO100 v7.08 GUI адаптері — көпірдің Windows-қа тиетін ЖАЛҒЫЗ модулі.

Барлық терезе атауы, басқару элементінің класы, мәзір жолы — төмендегі
АТАЛҒАН тұрақтылар, әрқайсысының қасында қай скриншоттан (не дамптан)
алынғаны жазылған. Скриншоттар: `.codex-runs/pro100-ref/ui/*.png|json`
(2026-09-24, ағылшынша интерфейс, 1920×1080). Орысша баламалары —
`PRO100.rus` ресурс жолдарынан (№ — жол нөмірі), экранда КӨРІЛМЕГЕН.

⚠ Бұл модульдегі әр идентификатор — PRO100-да бірінші нақты іске
қосылғанша БОЛЖАМ. «РАСТАЛҒАН» деп белгіленгендері ғана дамптағы нақты
класс/мәтінмен сәйкес (мысалы `scenario1-properties-controls.json`).

pywinauto/pywin32/mss тек осы модульде және тек класс ішінде (кеш) импортталады:
Linux-та тесттер бұл модульді мүлде жүктемейді.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from .driver import InsertResult, ReportTexts, StopRun, UiError
from .kit import LibraryQuery
from .library import LibraryMatch, find_library_item, normalize_library_name, scan_library
from .reports import decode_report, parse_number, report_kind_from_title
from .safety import classify_dialog, parse_status_bar

# ═══════════════════════════════════════════════════════════════════════════
# ТҰРАҚТЫЛАР (әрқайсысы — скриншоттан алынған болжам)
# ═══════════════════════════════════════════════════════════════════════════

# Бас терезе. menu-file.png: атауы «PRO100»; s1-reports-saveall.png: жоба
# ашық болса «PRO100 - C:\...\base-600.sto». Бас терезеде мәзір бар — сол
# арқылы «PRO100» атаулы хабар терезесінен (#32770) ажыратамыз.
MAIN_TITLE_PREFIX = "PRO100"
PROCESS_EXE = "PRO100.exe"
DEFAULT_EXE = r"C:\Users\trinity\PRO100\app\PRO100v7.08x64\PRO100.exe"  # тапсырмада берілген әзірлеу ПК жолы


@dataclass(frozen=True)
class MenuRef:
    """Мәзір пункті: жоғарғы мәзір индексі + пункт орны. Мәзір OWNER-DRAW,
    мәтіні WinAPI-ге бос (menu-raw.json: "text": ""), сондықтан пункт
    мәтінмен емес, ОРНЫМЕН табылады; `recorded_id` — дамптағы WM_COMMAND id,
    орын бойынша табылған id одан өзгеше болса журналға жазылады."""

    top: int
    pos: int
    recorded_id: int
    label: str
    shot: str


# menu-raw.json + menu-file.png: New, New from template, —, Open, Import▸, —, Save, Save as...
MENU_FILE_NEW = MenuRef(0, 0, 3, "File > New...", "menu-file.png, menu-raw.json")
MENU_FILE_SAVE_AS = MenuRef(0, 7, 11, "File > Save as...", "menu-file.png, menu-raw.json")
# menu-edit.png: Undo, Redo, —, Cut, Copy, Paste, Delete, —, Hide, Hide other, —, Unhide, Unhide all, —,
# Add to Catalog (14), Insert from Catalog... Shift+F5 (15), —, Group, Ungroup, —, Duplicate, Select all (21), Unselect all (22)
MENU_EDIT_INSERT_FROM_CATALOG = MenuRef(1, 15, 41, "Edit > Insert from Catalog... (Shift+F5)", "menu-edit.png, menu-raw.json")
MENU_EDIT_UNSELECT_ALL = MenuRef(1, 22, 48, "Edit > Unselect all", "menu-edit.png, menu-raw.json")
# menu-element-selected.png: New, Shape, Rotate…, Move…, Flip, Explode, —, Move to▸, Align to▸, Distribute▸, Distance▸, —, Properties...
MENU_ELEMENT_PROPERTIES = MenuRef(3, 16, 136, "Element > Properties...", "menu-element-selected.png, menu-raw.json")
# menu-tools.png: Catalog, Find, Structure, Dimensions, Layers, Lights, Autohide, Price-list, Kray, Mesh, Info, Lathe, Text, Replace, —, Reports and calculation, —, Preferences
MENU_TOOLS_CATALOG = MenuRef(4, 0, 138, "Tools > Catalog", "menu-tools.png, menu-raw.json")
MENU_TOOLS_STRUCTURE = MenuRef(4, 2, 140, "Tools > Structure", "menu-tools.png, menu-raw.json")
MENU_TOOLS_REPORTS = MenuRef(4, 15, 148, "Tools > Reports and calculation", "menu-tools.png, menu-raw.json")

# Properties терезесі — РАСТАЛҒАН класс/мәтін: scenario1-properties-controls.json
PROPERTIES_TITLES = ("Properties", "Свойства")          # ru: PRO100.rus №311
PROPERTIES_CLASS = "TFlatForm"
SPIN_CLASS = "TUnitSpinEdit"
# 6 өріс жоғарыдан төмен (rect.top бойынша): Dimensions ішінде Width(T433),
# Height(T459), Depth(T485); Position ішінде Left(T592), Bottom(T618), Back(T644).
# Орысшасы: Ширина/Высота/Глубина, Влево/Вниз/Назад (№320-323, №314-317).
SPIN_FIELDS_TOP_TO_BOTTOM = ("width", "height", "depth", "left", "bottom", "back")
NAME_COMBO_CLASS = "TComboBox"                          # Name: TComboBox + ішкі "Edit" (T367/T370)
PAGE_CONTROL_CLASS = "TPageControl"                     # қосымшалар: General · Material · Reports
TAB_GENERAL, TAB_MATERIAL = 0, 1                        # dialog-properties-general/material.png
CHECKBOX_CLASS = "TCheckBox"
ASPECT_RATIO_TEXTS = ("Aspect ratio", "Пропорции")      # scenario1-properties-controls.png; ru №324
BUTTON_CLASSES = ("TButton", "Button", "TBitBtn")
OK_TEXTS = ("OK", "ОК")
CANCEL_TEXTS = ("Cancel", "Отмена")
APPLY_TEXTS = ("Apply", "Применить")                     # дамп: "&Apply"

# Material қосымшасы → «Change» → «Select material» (dialog-properties-material.png, material-ldsp-find.png)
MATERIAL_CHANGE_TEXTS = ("Change", "Изменить")          # ru №534
SELECT_MATERIAL_TITLES = ("Select material", "Выбрать материал")  # ru №99
SELECT_TEXTS = ("Select", "Выбрать")                    # ru №103

# Жаңа жоба → «Room properties» (scenario1-new-project.png), тек OK басылады.
ROOM_TITLES = ("Room properties", "Свойства комнаты")   # ru — БОЛЖАМ, жолы табылмады

# «PRO100» хабар терезесі Yes/No/Cancel (new-project-dialog.png)
YES_TEXTS = ("Yes", "&Yes", "Да", "&Да")
NO_TEXTS = ("No", "&No", "Нет", "&Нет")

# Reports терезесі (dialog-reports.png, s1-reports-saveall.png)
REPORTS_TITLES = ("Reports", "Отчёты", "Отчеты")        # ru №241/№508
SAVE_ALL_TEXTS = ("Save all...", "Save all", "Сохранить все...", "Сохранить всё...", "Сохранить все")
COPY_TEXTS = ("Copy", "Копировать")                     # ru №297
# Қосымшалар реті: Parts list · Cabinet list · Material consumption · Calculation
REPORT_TAB_INDEX = {"parts": 0, "elements": 1, "materials": 2, "calculation": 3}

# Файл диалогы — РАСТАЛҒАН: s1-save-controls.json, s1-*-export-dialog.json
FILE_DIALOG_CLASS = "#32770"
SAVE_AS_TITLES = ("Save as", "Сохранить как")
FILE_SAVE_TEXTS = ("Save", "Сохранить")                 # дамп: "&Save"
FILE_OPEN_TEXTS = ("Open", "Открыть")

# Catalog (dialog-catalog.png, catalog-560-selected.png, base-600-insert.png)
CATALOG_TITLES = ("Catalog", "Каталог")
CATALOG_TAB_FURNITURE = 0                                # Furniture · Elements · Materials · Varia
CATALOG_ROOT_TEXTS = ("Furniture", "Мебель")             # жол комбосының түбір мәтіні
LIST_CLASS_HINTS = ("ListView", "SysListView32", "TListView")
COMBO_CLASS_HINTS = ("Combo",)

# Structure (dialog-structure.png, structure-base-expanded.png)
STRUCTURE_TITLES = ("Structure", "Структура")
TREE_CLASS_HINTS = ("TreeView", "SysTreeView32", "TTreeView")

# Статус жолы (s1-final-dimensions-applied.png)
STATUS_BAR_CLASSES = ("TStatusBar", "msctls_statusbar32")

# Кітапхана қалтасы PRO100.exe-нің қасында (pro100_list.txt: PRO100v7.08x64/Библиотека/Мебель)
LIBRARY_SUBDIRS = (("Библиотека", "Мебель"), ("библиотека", "элементы"), ("Library", "Furniture"))

WM_COMMAND = 0x0111
BASE_WAIT = 0.4       # әр әрекеттен кейінгі үзіліс, сек (--slow көбейтеді)
DIALOG_TIMEOUT = 15   # диалог күту, сек


def _strip_amp(text: str) -> str:
    return (text or "").replace("&", "").strip().rstrip(".").rstrip("…").strip().lower()


def _text_in(text: str, candidates: tuple[str, ...]) -> bool:
    t = _strip_amp(text)
    return any(t == _strip_amp(c) for c in candidates)


_SEND_KEYS_SPECIAL = set("+^%~(){}[]")


def escape_keys(text: str) -> str:
    """pywinauto send_keys үшін арнайы таңбаларды қорғау."""
    return "".join("{" + c + "}" if c in _SEND_KEYS_SPECIAL else c for c in text)


# ═══════════════════════════════════════════════════════════════════════════
# АДАПТЕР
# ═══════════════════════════════════════════════════════════════════════════


class Pro100UI:
    """`Pro100Driver` протоколының нақты іске асуы (pywinauto, win32 backend)."""

    def __init__(self, exe: str | None = None, library: str | None = None, slow: float = 1.0,
                 log: Callable[[str], None] = print) -> None:
        self.exe = exe
        self.library_root = library
        self.slow = max(0.5, slow)
        self.log = log
        self.main: Any = None
        self.pid: int | None = None
        self._notes: list[str] = []
        self._library: list[str] | None = None
        self._opened_tool_windows: list[MenuRef] = []
        self._our_project = False  # ағымдағы жобаны көпір өзі құрды ма

    # ── кеш импорт ────────────────────────────────────────────────────────
    @staticmethod
    def _pw() -> Any:
        try:
            import pywinauto  # noqa: PLC0415
            import pywinauto.keyboard  # noqa: F401,PLC0415
            import pywinauto.controls.common_controls  # noqa: F401,PLC0415
            import pywinauto.controls.win32_controls  # noqa: F401,PLC0415
        except ImportError as err:  # pragma: no cover — тек Windows
            raise UiError("pywinauto не установлен (нужен Windows + pip install pywinauto)") from err
        return pywinauto

    @staticmethod
    def _win32() -> tuple[Any, Any, Any]:
        import win32api  # noqa: PLC0415
        import win32gui  # noqa: PLC0415
        import win32process  # noqa: PLC0415
        return win32api, win32gui, win32process

    def _sleep(self, k: float = 1.0) -> None:
        time.sleep(BASE_WAIT * k * self.slow)

    def _wait(self, predicate: Callable[[], Any], timeout: float = DIALOG_TIMEOUT, what: str = "") -> Any:
        end = time.monotonic() + timeout * self.slow
        while time.monotonic() < end:
            value = predicate()
            if value:
                return value
            time.sleep(0.2)
        raise UiError(f"не дождались: {what}")

    def notes(self) -> list[str]:
        return list(self._notes)

    def _alive(self, win: Any) -> bool:
        """Терезе әлі бар әрі көрінеді ме (HwndWrapper-де exists() жоқ)."""
        _api, gui, _proc = self._win32()
        return bool(gui.IsWindow(win.handle) and gui.IsWindowVisible(win.handle))

    def _note(self, text: str) -> None:
        self._notes.append(text)
        self.log(f"  ! {text}")

    # ── терезелер ─────────────────────────────────────────────────────────
    def _windows(self) -> list[Any]:
        """PRO100 процесінің көрінетін жоғарғы терезелері ҒАНА (басқа бағдарламаға тимейміз)."""
        pw = self._pw()
        return list(pw.Desktop(backend="win32").windows(process=self.pid, visible_only=True))

    def _find_window(self, titles: tuple[str, ...], class_name: str | None = None) -> Any:
        for w in self._windows():
            if class_name and w.class_name() != class_name:
                continue
            if _text_in(w.window_text(), titles):
                return w
        return None

    def _wait_window(self, titles: tuple[str, ...], class_name: str | None = None, timeout: float = DIALOG_TIMEOUT) -> Any:
        return self._wait(lambda: self._find_window(titles, class_name), timeout, f"окно {titles[0]}")

    def _file_dialogs(self) -> list[Any]:
        return [w for w in self._windows() if w.class_name() == FILE_DIALOG_CLASS and self._filename_edit(w) is not None]

    @staticmethod
    def _filename_edit(dlg: Any) -> Any:
        """s1-save-controls.json: файл диалогында "Edit" класты бір ғана өріс бар — файл аты."""
        for c in dlg.descendants():
            if c.class_name() == "Edit":
                return c
        return None

    @staticmethod
    def _button(win: Any, texts: tuple[str, ...]) -> Any:
        for c in win.descendants():
            if c.class_name() in BUTTON_CLASSES and _text_in(c.window_text(), texts):
                return c
        return None

    def _click(self, win: Any, texts: tuple[str, ...]) -> None:
        btn = self._button(win, texts)
        if btn is None:
            raise UiError(f"кнопка не найдена: {texts[0]} в «{win.window_text()}»")
        btn.click()  # BM_CLICK — тінтуір жылжымайды
        self._sleep()

    # ── қауіпсіздік ───────────────────────────────────────────────────────
    def guard(self) -> None:
        """Лицензия/активация/демо не «проектті қалпына келтіру» терезесі бар ма?
        Бар болса — ешнәрсе баспай ТОҚТАЙМЫЗ."""
        for w in self._windows():
            try:
                texts = [c.window_text() for c in w.children()[:60]]
            except Exception:  # noqa: BLE001 — терезе жабылып үлгерсе
                continue
            title = w.window_text()
            kind = classify_dialog(title, texts)
            if kind in ("license", "recover"):
                raise StopRun(kind, title, " / ".join(t for t in texts if t)[:300])
            if kind == "warning" and w.class_name() == FILE_DIALOG_CLASS:
                # «Ошибка чтения прайс-листа» (PRO100.rus №87): тек OK бар ақпарат терезесі.
                self._note(f"предупреждение PRO100: {' / '.join(t for t in texts if t)[:200]}")
                btn = self._button(w, OK_TEXTS)
                if btn is not None:
                    btn.click()
                    self._sleep()

    def _ensure_foreground(self) -> None:
        """Пернетақта жіберер алдында фокус PRO100-да екенін тексеру."""
        _api, gui, proc = self._win32()
        fg = gui.GetForegroundWindow()
        if fg and proc.GetWindowThreadProcessId(fg)[1] == self.pid:
            return
        try:
            self.main.set_focus()
        except Exception:  # noqa: BLE001
            pass
        self._sleep()
        fg = gui.GetForegroundWindow()
        if not fg or proc.GetWindowThreadProcessId(fg)[1] != self.pid:
            raise StopRun("focus", gui.GetWindowText(fg) if fg else None, "фокус ушёл из PRO100")

    def _type(self, ctrl: Any, text: str, commit: str = "{TAB}") -> None:
        self._ensure_foreground()
        ctrl.set_focus()
        self._pw().keyboard.send_keys("{HOME}+{END}{DEL}" + escape_keys(text) + commit, with_spaces=True, pause=0.02)
        self._sleep(0.5)

    # ── мәзір ─────────────────────────────────────────────────────────────
    def _menu(self, ref: MenuRef) -> None:
        api, gui, _proc = self._win32()
        hmenu = gui.GetMenu(self.main.handle)
        sub = gui.GetSubMenu(hmenu, ref.top) if hmenu else 0
        item_id = gui.GetMenuItemID(sub, ref.pos) if sub else -1
        if item_id in (-1, 0xFFFFFFFF, 0):
            raise UiError(f"пункт меню не найден: {ref.label} ({ref.top}/{ref.pos})")
        if item_id != ref.recorded_id:
            self._note(f"id пункта «{ref.label}» = {item_id}, а в дампе {ref.recorded_id} (другая сборка/плагины?)")
        api.PostMessage(self.main.handle, WM_COMMAND, item_id, 0)
        self._sleep(1.5)

    def _toggle_tool_window(self, ref: MenuRef, titles: tuple[str, ...]) -> Any:
        """Tools > Catalog/Structure — қалқымалы панельді АУЫСТЫРАДЫ. Ашық болса қайта баспаймыз;
        өзіміз ашқанын соңында жабамыз (PRO100.layout-та өзгеріс қалмасын)."""
        win = self._find_window(titles)
        if win is None:
            self._menu(ref)
            win = self._wait_window(titles, timeout=8)
            self._opened_tool_windows.append(ref)
        return win

    # ── протокол ──────────────────────────────────────────────────────────
    def environment(self) -> dict[str, Any]:
        env: dict[str, Any] = {"driver": "pywinauto-win32", "pid": self.pid}
        try:
            pw = self._pw()
            env["pywinauto"] = getattr(pw, "__version__", "?")
            if self.main is not None:
                env["mainTitle"] = self.main.window_text()
                r = self.main.rectangle()
                env["mainRect"] = [r.left, r.top, r.right, r.bottom]
            env["exe"] = self._exe_path()
            env["libraryRoot"] = self.library_root
        except Exception as err:  # noqa: BLE001
            env["error"] = str(err)
        return env

    def _exe_path(self) -> str | None:
        try:
            from pywinauto.application import process_module  # noqa: PLC0415
            return str(process_module(self.pid))
        except Exception:  # noqa: BLE001
            return self.exe

    def start(self) -> None:
        pw = self._pw()
        _api, gui, _proc = self._win32()
        mains = [w for w in pw.Desktop(backend="win32").windows(visible_only=True)
                 if w.window_text().startswith(MAIN_TITLE_PREFIX) and gui.GetMenu(w.handle)]
        if not mains:
            exe = self.exe
            if not exe:
                raise UiError("PRO100 не запущен. Запустите PRO100 и повторите (или укажите --exe).")
            self.log(f"  запускаю {exe}")
            pw.Application(backend="win32").start(f'"{exe}"')
            mains = self._wait(lambda: [w for w in pw.Desktop(backend="win32").windows(visible_only=True)
                                        if w.window_text().startswith(MAIN_TITLE_PREFIX) and gui.GetMenu(w.handle)],
                               timeout=90, what="главное окно PRO100")
        if len(mains) > 1:
            raise UiError("открыто несколько окон PRO100 — оставьте одно")
        self.main = mains[0]
        self.pid = self.main.process_id()
        self.log(f"  PRO100: «{self.main.window_text()}», pid {self.pid}")
        if self.main.is_minimized():
            self.main.restore()
        self.main.set_focus()
        self._sleep()
        self.guard()

    def finish(self) -> None:
        for ref in reversed(self._opened_tool_windows):
            try:
                self._menu(ref)  # сол пункт панельді қайта жабады
            except Exception as err:  # noqa: BLE001
                self._note(f"не удалось закрыть окно {ref.label}: {err}")
        self._opened_tool_windows.clear()

    def new_project(self) -> None:
        self.guard()
        self._menu(MENU_FILE_NEW)
        deadline = time.monotonic() + DIALOG_TIMEOUT * self.slow
        while time.monotonic() < deadline:
            room = self._find_window(ROOM_TITLES)
            if room is not None:
                self._click(room, OK_TEXTS)   # өлшемін өзгертпейміз
                self._our_project = True
                return
            for w in self._windows():
                texts = [c.window_text() for c in w.children()[:30]]
                kind = classify_dialog(w.window_text(), texts)
                if kind == "unsaved":
                    if self._our_project:
                        self._click(w, NO_TEXTS)   # көпірдің өз тест-жобасы — сақтамай жабамыз
                    else:
                        self._click(w, ("Cancel", "Отмена"))
                        raise StopRun("unsaved", w.window_text(), "открыт несохранённый проект пользователя")
                elif kind in ("license", "recover"):
                    raise StopRun(kind, w.window_text(), " / ".join(texts)[:300])
            time.sleep(0.3)
        raise UiError("после File > New не появилось окно Room properties")

    # ── кітапхана ─────────────────────────────────────────────────────────
    def _library_root(self) -> str:
        if self.library_root:
            return self.library_root
        exe = self._exe_path()
        if exe:
            base = Path(exe).parent
            for parts in LIBRARY_SUBDIRS:
                cand = base.joinpath(*parts)
                if cand.is_dir():
                    self.library_root = str(cand)
                    return self.library_root
        raise UiError("папка библиотеки мебели не найдена рядом с PRO100.exe — укажите --library")

    def _find_in_library(self, query: LibraryQuery) -> LibraryMatch:
        if self._library is None:
            self._library = scan_library(self._library_root())
            self._note(f"в библиотеке {len(self._library)} файлов .meb")
        m = find_library_item(self._library, query)
        if m is None:
            raise UiError(f"в библиотеке не найден ни один из: {', '.join(query.search)}")
        return m

    def _selected_name(self) -> str | None:
        return self.read_status_bar().get("selected")  # type: ignore[return-value]

    def insert_library_item(self, query: LibraryQuery) -> InsertResult:
        self.guard()
        match = self._find_in_library(query)
        full = os.path.join(self._library_root(), match.path)
        try:
            self._menu(MENU_EDIT_UNSELECT_ALL)
        except UiError:
            pass
        errors: list[str] = []
        for strategy in (self._insert_via_file_dialog, self._insert_via_catalog):
            try:
                if strategy(match, full):
                    selected = self._wait(self._selected_name, timeout=10, what="выделение вставленного элемента")
                    return InsertResult(strategy.__name__.replace("_insert_via_", ""), match.path, selected)
            except StopRun:
                raise
            except Exception as err:  # noqa: BLE001 — келесі тәсілді байқаймыз
                errors.append(f"{strategy.__name__}: {err}")
        raise UiError("элемент не вставлен: " + " | ".join(errors))

    def _insert_via_file_dialog(self, match: LibraryMatch, full: str) -> bool:
        """БОЛЖАМ: Edit > Insert from Catalog... (menu-edit.png) файл таңдау
        диалогын ашады. Ашпаса — False (келесі тәсіл)."""
        before = {w.handle for w in self._file_dialogs()}
        self._menu(MENU_EDIT_INSERT_FROM_CATALOG)
        try:
            dlg = self._wait(lambda: next((w for w in self._file_dialogs() if w.handle not in before), None),
                             timeout=4, what="диалог Insert from Catalog")
        except UiError:
            return False
        self._filename_edit(dlg).set_edit_text(full)
        self._sleep()
        btn = self._button(dlg, FILE_OPEN_TEXTS)
        if btn is None:
            raise UiError("в диалоге вставки нет кнопки Open/Открыть")
        btn.click()
        self._wait(lambda: not self._alive(dlg), timeout=10, what="закрытие диалога вставки")
        return True

    def _insert_via_catalog(self, match: LibraryMatch, full: str) -> bool:
        """БОЛЖАМ: Catalog терезесіндегі тізім SysListView32 негізінде; қалтаға
        қос шерту кіреді, элементке қос шерту жобаға қояды (dialog-catalog.png,
        catalog-560-selected.png, base-600-insert.png — тек көрінісі расталған)."""
        pw = self._pw()
        cat = self._toggle_tool_window(MENU_TOOLS_CATALOG, CATALOG_TITLES)
        tabs = [c for c in cat.descendants() if "PageControl" in c.class_name() or "TabControl" in c.class_name()]
        if tabs:
            pw.controls.common_controls.TabControlWrapper(tabs[0].handle).select(CATALOG_TAB_FURNITURE)
            self._sleep()
        lists = [c for c in cat.descendants() if any(h in c.class_name() for h in LIST_CLASS_HINTS)]
        if not lists:
            raise UiError("в окне Catalog не найден список (класс " + ", ".join(sorted({c.class_name() for c in cat.descendants()})) + ")")
        lv = pw.controls.common_controls.ListViewWrapper(lists[0].handle)
        combos = [c for c in cat.descendants() if any(h in c.class_name() for h in COMBO_CLASS_HINTS)]

        # Түбірге: BACKSPACE (Explorer-тәрізді) — комбо «Furniture» болғанша, ең көбі 10 рет.
        for _ in range(10):
            text = combos[0].window_text() if combos else ""
            if not combos or _text_in(text, CATALOG_ROOT_TEXTS):
                break
            self._ensure_foreground()
            lv.set_focus()
            pw.keyboard.send_keys("{BACKSPACE}")
            self._sleep()

        segments = [s for s in match.folder.split("\\") if s and s != "."]
        for name in [*segments, match.stem]:
            want = normalize_library_name(name)
            shown = [lv.get_item(i).text() for i in range(lv.item_count())]
            texts = [normalize_library_name(t) for t in shown]
            if want not in texts:
                raise UiError(f"в каталоге нет «{name}» (видно: {', '.join(shown[:12])})")
            item = lv.get_item(texts.index(want))
            item.click(double=True)  # хабармен, тінтуір жылжымайды
            self._sleep(2)
        return True

    # ── Properties ────────────────────────────────────────────────────────
    def _open_properties(self) -> Any:
        self.guard()
        self._menu(MENU_ELEMENT_PROPERTIES)
        dlg = self._wait_window(PROPERTIES_TITLES, PROPERTIES_CLASS)
        pages = [c for c in dlg.descendants() if c.class_name() == PAGE_CONTROL_CLASS]
        if pages:
            self._pw().controls.common_controls.TabControlWrapper(pages[0].handle).select(TAB_GENERAL)
            self._sleep()
        return dlg

    @staticmethod
    def _spins(dlg: Any) -> dict[str, Any]:
        spins = sorted((c for c in dlg.descendants() if c.class_name() == SPIN_CLASS), key=lambda c: c.rectangle().top)
        if len(spins) != len(SPIN_FIELDS_TOP_TO_BOTTOM):
            raise UiError(f"в Properties найдено {len(spins)} полей {SPIN_CLASS}, ожидалось 6")
        return dict(zip(SPIN_FIELDS_TOP_TO_BOTTOM, spins))

    @staticmethod
    def _name_edit(dlg: Any) -> Any:
        for c in dlg.descendants():
            if c.class_name() == NAME_COMBO_CLASS:
                for e in c.children():
                    if e.class_name() == "Edit":
                        return e
                return c
        return None

    def set_properties(self, values: dict[str, Any]) -> None:
        pw = self._pw()
        dlg = self._open_properties()
        try:
            for c in dlg.descendants():
                if c.class_name() == CHECKBOX_CLASS and _text_in(c.window_text(), ASPECT_RATIO_TEXTS):
                    cb = pw.controls.win32_controls.ButtonWrapper(c.handle)
                    if cb.get_check_state():
                        cb.click()
                        self._note("снята галочка «Aspect ratio» у элемента, иначе размеры меняются вместе")
            if values.get("name"):
                edit = self._name_edit(dlg)
                if edit is None:
                    raise UiError("поле Name не найдено")
                self._type(edit, str(values["name"]))
            spins = self._spins(dlg)
            for f in SPIN_FIELDS_TOP_TO_BOTTOM:
                if values.get(f) is not None:
                    self._type(spins[f], str(int(values[f])))
            self._click(dlg, OK_TEXTS)
            self._wait(lambda: not self._alive(dlg), timeout=5, what="закрытие Properties")
        except Exception:
            if self._alive(dlg):
                btn = self._button(dlg, CANCEL_TEXTS)
                if btn is not None:
                    btn.click()
            raise

    def read_properties(self) -> dict[str, Any]:
        dlg = self._open_properties()
        try:
            edit = self._name_edit(dlg)
            out: dict[str, Any] = {"name": edit.window_text() if edit is not None else None}
            for f, ctrl in self._spins(dlg).items():
                raw = ctrl.window_text()
                v = parse_number(raw)
                out[f] = (int(v) if v is not None and v.is_integer() else v) if v is not None else raw
            locks = [c for c in dlg.descendants() if c.class_name() == CHECKBOX_CLASS and not c.window_text()]
            out["locks"] = [bool(self._pw().controls.win32_controls.ButtonWrapper(c.handle).get_check_state())
                            for c in sorted(locks, key=lambda c: c.rectangle().top)]
            return out
        finally:
            if self._alive(dlg):
                self._click(dlg, CANCEL_TEXTS)  # ештеңе өзгертпей жабамыз

    def read_status_bar(self) -> dict[str, Any]:
        pw = self._pw()
        for c in self.main.children():
            if c.class_name() in STATUS_BAR_CLASSES:
                try:
                    return parse_status_bar(pw.controls.common_controls.StatusBarWrapper(c.handle).texts())
                except Exception as err:  # noqa: BLE001
                    return {"selected": None, "position": None, "extent": None, "error": str(err)}
        return {"selected": None, "position": None, "extent": None, "error": "status bar not found"}

    def set_material(self, name: str) -> None:
        dlg = self._open_properties()
        try:
            pages = [c for c in dlg.descendants() if c.class_name() == PAGE_CONTROL_CLASS]
            self._pw().controls.common_controls.TabControlWrapper(pages[0].handle).select(TAB_MATERIAL)
            self._sleep()
            self._click(dlg, MATERIAL_CHANGE_TEXTS)
            sel = self._wait_window(SELECT_MATERIAL_TITLES)
            edits = sorted((c for c in sel.descendants() if c.class_name() in ("TEdit", "Edit")),
                           key=lambda c: c.rectangle().top)
            if not edits:
                raise UiError("в «Select material» нет поля Name")
            self._type(edits[-1], name, commit="")
            self._click(sel, SELECT_TEXTS)
            if self._alive(sel):
                self._click(sel, CANCEL_TEXTS)
                raise UiError(f"материал «{name}» не выбран (нет в библиотеке?)")
            self._click(dlg, OK_TEXTS)
        except Exception:
            if self._alive(dlg):
                btn = self._button(dlg, CANCEL_TEXTS)
                if btn is not None:
                    btn.click()
            raise

    # ── файл диалогы ──────────────────────────────────────────────────────
    def _save_in_dialog(self, dlg: Any, path: Path, out_root: Path) -> None:
        path = path.resolve()
        if out_root.resolve() not in path.parents:
            raise UiError(f"мост сохраняет только в папку результатов: {path}")
        path.parent.mkdir(parents=True, exist_ok=True)
        self._filename_edit(dlg).set_edit_text(str(path))
        self._sleep()
        self._click(dlg, FILE_SAVE_TEXTS)
        # «уже существует — заменить?» — тек өз қалтамызда болғандықтан Yes.
        end = time.monotonic() + 5 * self.slow
        while time.monotonic() < end and self._alive(dlg):
            for w in self._windows():
                if w.handle == dlg.handle:
                    continue
                texts = [c.window_text() for c in w.children()[:20]]
                if classify_dialog(w.window_text(), texts) == "overwrite":
                    self._click(w, YES_TEXTS)
            time.sleep(0.3)
        if self._alive(dlg):
            raise UiError(f"диалог сохранения не закрылся: {dlg.window_text()}")

    def save_project_as(self, path: Path) -> None:
        self.guard()
        self._menu(MENU_FILE_SAVE_AS)
        dlg = self._wait(lambda: next((w for w in self._file_dialogs() if _text_in(w.window_text(), SAVE_AS_TITLES)), None),
                         what="диалог Save as")
        self._save_in_dialog(dlg, path, path.parent.parent)
        self._our_project = True

    # ── есептер ───────────────────────────────────────────────────────────
    def export_reports(self, out_dir: Path, basename: str) -> ReportTexts:
        self.guard()
        out_dir.mkdir(parents=True, exist_ok=True)
        self._menu(MENU_TOOLS_REPORTS)
        rep = self._wait_window(REPORTS_TITLES)
        files: dict[str, str] = {}
        texts: dict[str, str] = {}
        source = "save-all"
        try:
            try:
                self._click(rep, SAVE_ALL_TEXTS)
                for _ in range(4):
                    dlg = self._wait(lambda: next(iter(self._file_dialogs()), None), timeout=10, what="диалог сохранения отчёта")
                    kind = report_kind_from_title(dlg.window_text())
                    if kind is None or kind in files:
                        self._click(dlg, CANCEL_TEXTS)
                        raise UiError(f"неожиданный диалог: {dlg.window_text()}")
                    target = out_dir / f"{basename} - {kind}.txt"
                    self._save_in_dialog(dlg, target, out_dir)
                    files[kind] = str(target)
            except UiError as err:
                self._note(f"Save all: {err}")
            for kind, path in files.items():
                texts[kind] = decode_report(Path(path).read_bytes())
            missing = [k for k in REPORT_TAB_INDEX if k not in texts]
            if missing:
                source = "save-all+clipboard" if files else "clipboard"
                texts.update(self._copy_tabs(rep, missing))
        finally:
            if self._alive(rep):
                self._click(rep, OK_TEXTS)
        return ReportTexts(source, files, texts)

    def _copy_tabs(self, rep: Any, kinds: list[str]) -> dict[str, str]:
        """Қор тәсіл: қосымшаны ашып «Copy» басу, алмасу буферінен оқу."""
        import win32clipboard  # noqa: PLC0415

        pw = self._pw()
        tabs = [c for c in rep.descendants() if "PageControl" in c.class_name() or "TabControl" in c.class_name()]
        out: dict[str, str] = {}
        for kind in kinds:
            try:
                if tabs:
                    pw.controls.common_controls.TabControlWrapper(tabs[0].handle).select(REPORT_TAB_INDEX[kind])
                    self._sleep()
                self._click(rep, COPY_TEXTS)
                win32clipboard.OpenClipboard()
                try:
                    out[kind] = win32clipboard.GetClipboardData(win32clipboard.CF_UNICODETEXT)
                finally:
                    win32clipboard.CloseClipboard()
            except Exception as err:  # noqa: BLE001
                self._note(f"копирование вкладки {kind}: {err}")
        return out

    # ── Structure ─────────────────────────────────────────────────────────
    def _tree(self) -> Any:
        pw = self._pw()
        win = self._toggle_tool_window(MENU_TOOLS_STRUCTURE, STRUCTURE_TITLES)
        trees = [c for c in win.descendants() if any(h in c.class_name() for h in TREE_CLASS_HINTS)]
        if not trees:
            raise UiError("в окне Structure не найдено дерево (классы: "
                          + ", ".join(sorted({c.class_name() for c in win.descendants()})) + ")")
        return pw.controls.common_controls.TreeViewWrapper(trees[0].handle)

    def list_top_elements(self) -> list[str]:
        self.guard()
        return [r.text() for r in self._tree().roots()]

    def select_top_element(self, index: int) -> None:
        self._tree().roots()[index].select()
        self._sleep()

    # ── скриншот ──────────────────────────────────────────────────────────
    def screenshot(self, path: Path) -> bool:
        """Тек PRO100 бас терезесінің аумағы (басқа терезелер түспейді)."""
        if self.main is None:
            return False
        import mss  # noqa: PLC0415
        import mss.tools  # noqa: PLC0415

        r = self.main.rectangle()
        box = {"left": r.left, "top": r.top, "width": max(1, r.width()), "height": max(1, r.height())}
        path.parent.mkdir(parents=True, exist_ok=True)
        with mss.mss() as sct:
            img = sct.grab(box)
            mss.tools.to_png(img.rgb, img.size, output=str(path))
        return True
