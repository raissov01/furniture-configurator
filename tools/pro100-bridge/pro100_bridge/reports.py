"""PRO100 есептерінің мәтінін талдау (таза Python, GUI-сыз).

Пішім НАҚТЫ файлдармен расталған (tests/fixtures/captured-s1, PRO100 v7.08,
ағылшынша интерфейс, Reports → «Save all...»): UTF-8 + BOM, CRLF, бағандар
TAB-пен бөлінген, тақырып жолы ЖОҚ. Бағандар жиыны `PRO100.rus` ресурс
жолдарымен сәйкес:

  Список деталей        Наименование|Длина||Ширина||Толщина|Количество|Материал
                        (екі бос баған — кромка белгісі болуы мүмкін, мәні "   ")
  Список элементов      Наименование|Количество
  Потребность в мат.    Наименование|Количество|Ед.изм.
  Расчёт стоимости      Категория|Наименование|Количество|Ед.изм.|Цена|
                        Сумма без НДС|НДС, %|Сумма НДС|Сумма с НДС
                        (нақты файлда 8 баған: Категория/Наименование бір бағанда)

Болжам (расталмаған): орысша интерфейс cp1251 не үтірлі ондық жазуы мүмкін —
сондықтан екеуі де қабылданады (tests/fixtures/synthetic).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# ── Декодтау және сан ───────────────────────────────────────────────────────


def decode_report(data: bytes) -> str:
    """Файлдың байттарын мәтінге: UTF-16 (BOM) → UTF-8 (BOM-мен/сіз) → cp1251."""
    if data.startswith(b"\xff\xfe") or data.startswith(b"\xfe\xff"):
        return data.decode("utf-16")
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("cp1251")


_SPACES = re.compile(r"[\s  ]")


def parse_number(text: str) -> float | None:
    """«1 234,50» / «1234.5» / «-3» → сан. Бос не сан емес → None."""
    s = _SPACES.sub("", text or "").replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _lines(text: str) -> list[str]:
    text = text.lstrip("﻿")
    return [ln for ln in text.replace("\r\n", "\n").replace("\r", "\n").split("\n") if ln.strip()]


# Тақырып жолын тану (көшіріп-алу не басқа нұсқа тақырыппен жазса).
_HEADER_WORDS = {"наименование", "name", "длина", "length", "категория", "category", "количество", "count"}


def _is_header(cols: list[str]) -> bool:
    return any(c.strip().lower() in _HEADER_WORDS for c in cols)


# ── Деталь тізімі ───────────────────────────────────────────────────────────


@dataclass
class PartRow:
    name: str
    length: float
    width: float
    thickness: float
    count: int
    material: str
    edges_length: str = ""
    edges_width: str = ""


def parse_parts(text: str) -> tuple[list[PartRow], list[str]]:
    """Деталь тізімі. Қайтарады: (жолдар, талданбаған жолдар).

    Талданбаған жол ЖОЙЫЛМАЙДЫ — audit-те көрінуі керек.
    """
    rows: list[PartRow] = []
    unparsed: list[str] = []
    for line in _lines(text):
        cols = line.split("\t")
        if _is_header(cols):
            continue
        if len(cols) >= 8:
            name, ls, el, ws, ew, ts, cs = cols[:7]
            material = "\t".join(cols[7:])
        elif len(cols) == 6:
            name, ls, ws, ts, cs, material = cols
            el = ew = ""
        else:
            unparsed.append(line)
            continue
        length, width, thick, count = parse_number(ls), parse_number(ws), parse_number(ts), parse_number(cs)
        if length is None or width is None or thick is None or count is None:
            unparsed.append(line)
            continue
        rows.append(PartRow(name.strip(), length, width, thick, int(round(count)), material.strip(), el, ew))
    return rows, unparsed


# ── Элементтер тізімі ───────────────────────────────────────────────────────


@dataclass
class ElementRow:
    name: str
    count: float


def parse_elements(text: str) -> tuple[list[ElementRow], list[str]]:
    rows: list[ElementRow] = []
    unparsed: list[str] = []
    for line in _lines(text):
        cols = line.split("\t")
        if _is_header(cols):
            continue
        count = parse_number(cols[1]) if len(cols) >= 2 else None
        if count is None:
            unparsed.append(line)
            continue
        rows.append(ElementRow(cols[0].strip(), int(count) if count.is_integer() else count))
    return rows, unparsed


# ── Материал қажеттілігі ────────────────────────────────────────────────────


@dataclass
class MaterialRow:
    name: str
    qty: float
    unit: str


def parse_materials(text: str) -> tuple[list[MaterialRow], list[str]]:
    rows: list[MaterialRow] = []
    unparsed: list[str] = []
    for line in _lines(text):
        cols = line.split("\t")
        if _is_header(cols):
            continue
        qty = parse_number(cols[1]) if len(cols) >= 2 else None
        if qty is None:
            unparsed.append(line)
            continue
        rows.append(MaterialRow(cols[0].strip(), qty, cols[2].strip() if len(cols) >= 3 else ""))
    return rows, unparsed


# ── Расчёт стоимости ────────────────────────────────────────────────────────


@dataclass
class CalcRow:
    label: str
    category: str
    name: str
    qty: float | None
    unit: str
    price: float | None
    sum_without_vat: float | None
    vat_percent: float | None
    vat: float | None
    sum_with_vat: float | None


@dataclass
class Calculation:
    rows: list[CalcRow] = field(default_factory=list)
    unparsed: list[str] = field(default_factory=list)
    total: float | None = None
    discount: float | None = None
    to_pay: float | None = None

    @property
    def price_list_empty(self) -> bool:
        """Прайс-лист бос: барлық сома 0 не жоқ (нақты 1-сценарийдегідей)."""
        return all((r.sum_with_vat or 0) == 0 and (r.sum_without_vat or 0) == 0 for r in self.rows)


_TOTAL = {"total", "всего", "итого"}
_DISCOUNT = {"discount", "скидка", "скидка всего", "total discount"}
_TO_PAY = {"to pay", "к оплате", "amount due"}


def parse_calculation(text: str) -> Calculation:
    calc = Calculation()
    for line in _lines(text):
        cols = line.split("\t")
        if _is_header(cols):
            continue
        if len(cols) >= 9:
            category, name, rest = cols[0].strip(), cols[1].strip(), cols[2:9]
            label = category or name
        elif len(cols) == 8:
            label, rest = cols[0].strip(), cols[1:8]
            category, name = label, ""
        else:
            calc.unparsed.append(line)
            continue
        nums = [parse_number(c) for c in rest]
        row = CalcRow(label, category, name, nums[0], rest[1].strip(), nums[2], nums[3], nums[4], nums[5], nums[6])
        calc.rows.append(row)
        key = label.lower()
        amount = row.sum_with_vat
        if key in _TOTAL:
            calc.total = amount
        elif key in _DISCOUNT:
            calc.discount = amount
        elif key in _TO_PAY:
            calc.to_pay = amount
    return calc


# ── Сақтау диалогының тақырыбынан есеп түрін тану ───────────────────────────
# Ағылшынша — скриншоттардан (s1-*-export-dialog.json), орысша — PRO100.rus
# ресурс жолдарынан (№63, №72, №75, №78).

_TITLE_KINDS: list[tuple[str, tuple[str, ...]]] = [
    ("parts", ("piece list", "parts list", "списка деталей", "детал")),
    ("elements", ("element list", "cabinet list", "списка элементов", "элемент")),
    ("materials", ("material consumption", "потребности в материалах", "материал")),
    ("calculation", ("calculation", "расчёта стоимости", "расчета стоимости", "стоимост")),
]


def report_kind_from_title(title: str) -> str | None:
    t = (title or "").lower()
    for kind, words in _TITLE_KINDS:
        if any(w in t for w in words):
            return kind
    return None
