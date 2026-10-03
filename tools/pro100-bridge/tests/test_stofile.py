"""`.sto`/`.meb` контейнерін тану.

Фикстуралар (`fixtures/sto/`) — біздің көпір PRO100 v7.08-де жасап сақтаған
жобалар (audit 2026-10-03 14:15:59 және 14:43:21, s1/s2 сценарийлері),
ҚЫСҚАРТЫЛҒАН: тек алғашқы 256 байт (тақырып + 31 блок; s1 екі сақтауының
айырмасы 124-байтта). Жобаның қалған бөлігінде кітапхана элементінің деректері
шифрланған күйде тұрады, сондықтан ол репозиторийге енгізілмейді. Кітапхана `.meb` файлдары репозиторийге көшірілмейді: ашық `PSTO` пішімі
тесттің ішінде синтетикалық байттармен құрастырылады.
"""
import struct
from pathlib import Path

import pytest

from pro100_bridge import stofile

FIX = Path(__file__).parent / "fixtures" / "sto"
S1_A = FIX / "s1-base-600.run1.sto"
S1_B = FIX / "s1-base-600.run2.sto"
S2 = FIX / "s2-wall-800.sto"


def _lstr(b: bytes) -> bytes:
    return struct.pack("<i", len(b)) + b


def _synthetic_psto() -> bytes:
    tex = "Разное\\Зеркало 2.bmp".encode("cp1251")
    return (
        b"PSTO"
        + _lstr(b"Version355")
        + struct.pack("<i", 1)
        + _lstr(b"TGroup")
        + b"\x00" * 6
        + struct.pack("<dd", 10.0, 100000.0)
        + struct.pack("<i", 2)
        + _lstr(b"TFlatShape")
        + b"\x00\x01\xff\xff\xff\xff"
        + struct.pack("<d", 10.0)
        + _lstr(tex)
        + b"\x00" * 16
        + _lstr(b"TFlatShape")
        + struct.pack("<d", 0.02)
    )


def test_bridge_sto_is_encrypted_container():
    for p in (S1_A, S2):
        info = stofile.sniff(p)
        assert info.kind == stofile.KIND_ENCRYPTED
        assert info.payload_size == info.size - 4
        assert info.full_blocks * 8 + info.tail_bytes == info.payload_size


def test_all_v708_projects_share_first_cipher_block():
    # CBC + тұрақты IV: бірдей ашық бастама → бірдей бірінші блок.
    a, b = stofile.sniff(S1_A), stofile.sniff(S2)
    assert a.fingerprint[:16] == b.fingerprint[:16] == "bb915c1c088a5984"


def test_same_project_saved_twice_diverges_on_block_boundary():
    off = stofile.first_divergence(S1_A, S1_B)
    assert off == 124
    assert (off - stofile.HEADER_SIZE) % stofile.BLOCK_SIZE == 0
    assert stofile.divergent_block(S1_A, S1_B) == 15
    assert stofile.sniff(S1_A).size == stofile.sniff(S1_B).size


def test_encrypted_file_is_not_readable():
    with pytest.raises(stofile.EncryptedFileError):
        stofile.read_plain(S2)
    d = stofile.describe(S2)
    assert d["kind"] == "encrypted" and d["readable"] is False


def test_identical_files_have_no_divergence():
    assert stofile.first_divergence(S2, S2) is None


def test_plain_psto_classes_and_cp1251_paths():
    data = _synthetic_psto()
    info = stofile.sniff(data)
    assert info.kind == stofile.KIND_PLAIN and info.version == "Version355"
    doc = stofile.read_plain(data)
    assert [o.class_name for o in doc.objects] == ["TGroup", "TFlatShape", "TFlatShape"]
    assert [p.text for p in doc.paths] == ["Разное\\Зеркало 2.bmp"]
    assert doc.class_counts() == {"TGroup": 1, "TFlatShape": 2}
    d = stofile.describe(data)
    assert d["readable"] is True and d["classes"]["TFlatShape"] == 2


def test_unknown_bytes():
    assert stofile.sniff(b"MZ\x90\x00").kind == stofile.KIND_UNKNOWN
    with pytest.raises(stofile.UnknownFormatError):
        stofile.read_plain(b"hello world")
