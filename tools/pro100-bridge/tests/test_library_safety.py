"""Кітапханадан атымен табу, диалогтарды тану, статус жолы."""
from pro100_bridge.kit import LibraryQuery
from pro100_bridge.library import find_library_item, normalize_library_name
from pro100_bridge.safety import classify_dialog, parse_status_bar

LIB = [
    r"01 Кухни Модерн\01 Модерн стандарт\Нижние\530 глубина\Н2 600.meb",
    r"01 Кухни Модерн\01 Модерн стандарт\Нижние\560 глубина\Н2 600.meb",
    r"01 Кухни Модерн\01 Модерн стандарт\Нижние\560 глубина\Н В3 600.meb",
    r"01 Кухни Модерн\01 Модерн стандарт\Верхние\720\В 2дв 800.meb",
    r"02 Кухни Классика\Нижние\Н 2дв 600.meb",
    r"04 Шкафы\Шкаф Л З З Л 1864 х 618 х 2096.meb",
]


def test_normalize_latin_homoglyphs_and_spaces():
    assert normalize_library_name("H2 600") == normalize_library_name("Н2 600")
    assert normalize_library_name("  В  2дв 800 ") == "в 2дв 800"


def test_find_first_search_term_wins_and_folder_hints_break_ties():
    q = LibraryQuery(search=["Н2 600", "Н 2дв 600"], folder_hints=["Нижние", "560"])
    m = find_library_item(LIB, q)
    assert m is not None and m.path.endswith(r"560 глубина\Н2 600.meb") and m.term == "Н2 600"


def test_find_falls_back_to_next_term_and_compact_form():
    q = LibraryQuery(search=["Н 3ящ 600", "НВ3 600"], folder_hints=["560"])
    m = find_library_item(LIB, q)
    assert m is not None and m.path.endswith(r"Н В3 600.meb") and m.match == "compact"


def test_find_latin_typed_name():
    m = find_library_item(LIB, LibraryQuery(search=["B 2дв 800"]))
    assert m is not None and "Верхние" in m.path


def test_find_none_suggests_similar():
    q = LibraryQuery(search=["Пенал 600"])
    assert find_library_item(LIB, q) is None


def test_classify_dialogs():
    assert classify_dialog("Лицензия", ["Не обнаружен аппаратный ключ защиты."]) == "license"
    assert classify_dialog("PRO100", ["Пробное использование программы окончено."]) == "license"
    assert classify_dialog("PRO100", ["Полнофункциональная версия программы включает в себя возможности:"]) == "license"
    assert classify_dialog("Registration", []) == "license"
    assert classify_dialog("PRO100", ["Project  was modified.", "Save changes ?"]) == "unsaved"
    assert classify_dialog("PRO100", ["Проект M7 был изменён.", "Сохранить изменения ?"]) == "unsaved"
    assert classify_dialog("PRO100", ["В предыдущем сеансе проект (x) был закрыт некорректно."]) == "recover"
    assert classify_dialog("Confirm Save As", ["a.txt already exists.", "Do you want to replace it?"]) == "overwrite"
    assert classify_dialog("PRO100", ["Ошибка чтения прайс-листа."]) == "warning"
    assert classify_dialog("Properties", ["OK"]) == "unknown"


def test_status_bar_parse_english_and_russian():
    s = parse_status_bar(['Selected element: "S1 Base 600x720x560"', "2700 x 0 x 1709", "600 x 720 x 560"])
    assert s == {"selected": "S1 Base 600x720x560", "position": [2700, 0, 1709], "extent": [600, 720, 560]}
    s = parse_status_bar(['Выбран элемент: "Н2 600"', "2694 x 780 x 1700", "612 x 1440 x 600"])
    assert s["selected"] == "Н2 600" and s["extent"] == [612, 1440, 600]
    assert parse_status_bar(["Inserts the content of the clipboard."]) == {"selected": None, "position": None, "extent": None}
