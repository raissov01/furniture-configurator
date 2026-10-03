"""PRO100 `.sto` / `.meb` деректер файлдарын тек оқу үшін тану (stdlib ғана).

Толық сипаттама: ``docs/pro100/file-format.md``.

Не істейді (деректер файлдарын ғана талдау арқылы анықталған):

* **Шифрланған контейнер** (PRO100 v7.08 сақтайтын барлық `.sto` және
  кітапхана `.meb`-тің басым көпшілігі): 4 байт сиқырлы белгі
  ``2A 44 3F 03``, одан кейін 8 байттық блок шифрымен CBC тәрізді режимде
  шифрланған дерек. Кілт бізде жоқ, сондықтан элемент ағашын/өлшемдерді
  бұл файлдардан оқу **мүмкін емес**. Модуль тек контейнерді таниды,
  пайдалы жүк ұзындығын, блок «саусақ ізін» береді және екі файлдың қай
  блоктан бастап ажырайтынын табады.
* **Ашық `PSTO` пішімі** (ескі, шифрланбаған; кітапханада аз ғана файл):
  нұсқа жолын (``Version355``), Delphi класс атауларын (``TGroup``,
  ``TFlatShape``) және cp1251 текстура/материал жолдарын ығысуларымен
  шығарады. Жазба өрістерінің толық схемасы әлі белгісіз, сондықтан өлшемдер
  оқылмайды.

PRO100 бағдарламасының бинарлық файлдары (DLL/EXE/.plg) мұнда қолданылмайды
және талданбайды.
"""
from __future__ import annotations

import re
import struct
from dataclasses import dataclass, field
from pathlib import Path
from typing import Union

MAGIC_ENCRYPTED = b"\x2a\x44\x3f\x03"
MAGIC_PLAIN = b"PSTO"
HEADER_SIZE = 4
BLOCK_SIZE = 8

KIND_ENCRYPTED = "encrypted"
KIND_PLAIN = "plain"
KIND_UNKNOWN = "unknown"

_CLASS_RE = re.compile(rb"T[A-Za-z][A-Za-z0-9_]{1,62}")
_PATH_RE = re.compile(rb"[^\x00-\x1f]+\.(?:bmp|jpg|jpeg|png|tga|gif)", re.IGNORECASE)

Source = Union[bytes, bytearray, str, Path]


class EncryptedFileError(ValueError):
    """Файл шифрланған контейнер: мазмұнын кілтсіз оқу мүмкін емес."""


class UnknownFormatError(ValueError):
    """Файл PRO100 `.sto`/`.meb` контейнеріне ұқсамайды."""


@dataclass(frozen=True)
class ContainerInfo:
    kind: str
    size: int
    payload_size: int
    full_blocks: int = 0
    tail_bytes: int = 0
    # Шифрланған файлдың алғашқы екі блогы (hex). CBC + тұрақты IV болғандықтан
    # бірдей ашық бастамасы бар файлдарда бұл мән бірдей (мысалы, барлық
    # v7.08 `.sto`-да бірінші блок бірдей).
    fingerprint: str = ""
    version: str | None = None


@dataclass(frozen=True)
class PlainObject:
    offset: int
    class_name: str


@dataclass(frozen=True)
class PlainString:
    offset: int
    text: str


@dataclass
class PlainDocument:
    version: str
    objects: list[PlainObject] = field(default_factory=list)
    paths: list[PlainString] = field(default_factory=list)

    def class_counts(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for o in self.objects:
            out[o.class_name] = out.get(o.class_name, 0) + 1
        return out


def _load(src: Source) -> bytes:
    if isinstance(src, (bytes, bytearray)):
        return bytes(src)
    return Path(src).read_bytes()


def _read_lstring(data: bytes, off: int, limit: int = 4096) -> tuple[bytes, int] | None:
    """Delphi стиліндегі жол: int32 LE ұзындық + байттар."""
    if off + 4 > len(data):
        return None
    (n,) = struct.unpack_from("<i", data, off)
    if n < 0 or n > limit or off + 4 + n > len(data):
        return None
    return data[off + 4 : off + 4 + n], off + 4 + n


def sniff(src: Source) -> ContainerInfo:
    data = _load(src)
    size = len(data)
    head = data[:HEADER_SIZE]
    if head == MAGIC_ENCRYPTED:
        payload = size - HEADER_SIZE
        return ContainerInfo(
            kind=KIND_ENCRYPTED,
            size=size,
            payload_size=payload,
            full_blocks=payload // BLOCK_SIZE,
            tail_bytes=payload % BLOCK_SIZE,
            fingerprint=data[HEADER_SIZE : HEADER_SIZE + 2 * BLOCK_SIZE].hex(),
        )
    if head == MAGIC_PLAIN:
        s = _read_lstring(data, 4, limit=64)
        version = s[0].decode("ascii", "replace") if s else None
        return ContainerInfo(kind=KIND_PLAIN, size=size, payload_size=size, version=version)
    return ContainerInfo(kind=KIND_UNKNOWN, size=size, payload_size=size)


def first_divergence(a: Source, b: Source) -> int | None:
    """Екі файл бірінші рет ажырайтын байт ығысуы (бірдей болса None).

    Шифрланған файлдарда бұл әрқашан ``4 + 8*k`` болады: ашық мәтіндегі
    бірінші айырмашылық жататын блоктың басы.
    """
    da, db = _load(a), _load(b)
    n = min(len(da), len(db))
    for i in range(n):
        if da[i] != db[i]:
            return i
    return None if len(da) == len(db) else n


def divergent_block(a: Source, b: Source) -> int | None:
    """Шифрланған екі файл үшін бірінші ажыраған блок нөмірі (0-ден)."""
    off = first_divergence(a, b)
    if off is None or off < HEADER_SIZE:
        return None
    return (off - HEADER_SIZE) // BLOCK_SIZE


def read_plain(src: Source) -> PlainDocument:
    """Ашық `PSTO` файлынан нұсқа, класс атаулары және текстура жолдарын алу."""
    data = _load(src)
    info = sniff(data)
    if info.kind == KIND_ENCRYPTED:
        raise EncryptedFileError(
            "PRO100 шифрланған контейнері (2A 44 3F 03): кілтсіз оқылмайды"
        )
    if info.kind != KIND_PLAIN or info.version is None:
        raise UnknownFormatError("PSTO белгісі немесе нұсқа жолы табылмады")

    doc = PlainDocument(version=info.version)
    start = 4 + 4 + len(info.version)
    off = start
    while off + 4 <= len(data):
        s = _read_lstring(data, off, limit=4096)
        if s is not None and len(s[0]) >= 2:
            raw, end = s
            if _CLASS_RE.fullmatch(raw):
                doc.objects.append(PlainObject(off, raw.decode("ascii")))
                off = end
                continue
            if _PATH_RE.fullmatch(raw):
                doc.paths.append(PlainString(off, raw.decode("cp1251", "replace")))
                off = end
                continue
        off += 1
    return doc


def describe(src: Source) -> dict:
    """CLI/JSON үшін қысқа сипаттама."""
    data = _load(src)
    info = sniff(data)
    out: dict = {
        "kind": info.kind,
        "size": info.size,
        "payloadSize": info.payload_size,
    }
    if info.kind == KIND_ENCRYPTED:
        out.update(
            fullBlocks=info.full_blocks,
            tailBytes=info.tail_bytes,
            fingerprint=info.fingerprint,
            readable=False,
        )
    elif info.kind == KIND_PLAIN:
        doc = read_plain(data)
        out.update(
            version=doc.version,
            classes=doc.class_counts(),
            paths=[p.text for p in doc.paths],
            readable=True,
        )
    return out
