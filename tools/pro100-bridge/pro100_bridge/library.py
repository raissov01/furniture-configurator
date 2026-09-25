"""PRO100 кітапханасынан элементті АТЫ бойынша табу (таза Python).

Тестердің (цех иесінің) 60 ГБ кітапханасы біздікінен басқа болуы мүмкін,
сондықтан элемент нақты жолымен емес, файл атауының нұсқаларымен ізделеді
(`docs/pro100/nomenclature.md`: «Н 2дв 600», «В 2дв 800», «Н В3 600»).
Тек ФАЙЛ АТАУЛАРЫ оқылады — `.meb` ішіне кірмейміз, көшірмейміз.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import PureWindowsPath

from .kit import LibraryQuery

# Латын әрпімен терілген атау кириллицаға (скриншотта «H2 600» көрінген).
_HOMOGLYPHS = str.maketrans({
    "a": "а", "b": "в", "c": "с", "e": "е", "h": "н", "k": "к", "m": "м",
    "o": "о", "p": "р", "t": "т", "x": "х", "y": "у", "ё": "е",
})
_WS = re.compile(r"\s+")


def normalize_library_name(name: str) -> str:
    return _WS.sub(" ", name.lower().translate(_HOMOGLYPHS)).strip()


def _compact(name: str) -> str:
    return normalize_library_name(name).replace(" ", "")


@dataclass
class LibraryMatch:
    path: str          # кітапхана түбірінен салыстырмалы жол (Windows бөлгішімен)
    term: str          # қай іздеу сөзі тапты
    match: str         # 'exact' | 'compact'
    hints: int         # жолда кездескен folderHints саны

    @property
    def folder(self) -> str:
        return str(PureWindowsPath(self.path).parent)

    @property
    def stem(self) -> str:
        return PureWindowsPath(self.path).stem


def find_library_item(paths: list[str], query: LibraryQuery) -> LibraryMatch | None:
    """Іздеу сөздері РЕТІМЕН тексеріледі; бір сөзге бірнеше файл сәйкес келсе —
    folderHints көбі, содан кейін қысқа жол таңдалады."""
    stems = [(p, PureWindowsPath(p).stem) for p in paths]
    hints = [normalize_library_name(h) for h in query.folder_hints]
    for term in query.search:
        for mode, key in (("exact", normalize_library_name), ("compact", _compact)):
            want = key(term)
            found = [p for p, s in stems if key(s) == want]
            if found:
                def score(p: str) -> tuple[int, int]:
                    folder = normalize_library_name(str(PureWindowsPath(p).parent))
                    return (-sum(1 for h in hints if h in folder), len(p))
                best = min(found, key=score)
                return LibraryMatch(best, term, mode, -score(best)[0])
    return None


def scan_library(root: str) -> list[str]:
    """`root` астындағы барлық `.meb` файлдың салыстырмалы жолы (тек атаулар)."""
    out: list[str] = []
    for dirpath, _dirs, files in os.walk(root):
        for f in files:
            if f.lower().endswith(".meb"):
                rel = os.path.relpath(os.path.join(dirpath, f), root)
                out.append(rel.replace("/", "\\"))
    return sorted(out)
