#!/usr/bin/env python3
"""
Базис-Мебельщик 2023All.xlsx -> сүзілген шикі JSON (докс/basis/basis-filtered-raw.json).

Тек ДЕРЕК көшіріледі (атау, өлшем, баға, топ жолы) — текстура суреттері мен
3D модель ЖОҚ (docs/basis/materials-db.md §легалдық шекара). Файл үлкен
(33 554 жол × 36 баған), сондықтан openpyxl read_only (стрим) режимінде
оқылады, тек керекті бағандар жадта сақталады.

Сүзгі (docs/basis/import.md-де негізделген):
  - ЛДСП: топ жолында "/ЛДСП/", қалыңдығы 16 немесе 18 мм
  - ХДФ:  топ жолында "/ХДФ/", қалыңдығы 3 немесе 4 мм
  - Кромка: топ жолы "02 Кромочные материалы/"-мен басталады, атауындағы
    ені 19 немесе 22 мм (ЛДСП 16/18 мм-ге сәйкес келетін екі стандартты
    ен), қалыңдығы 0.4/1/2 мм (жобаның EdgeBand конвенциясы)
  - МДФ ЕНГІЗІЛМЕЙДІ: базада небәрі 8 жол, барлығында Длина/Ширина/Шаг X/Y
    толтырылмаған (0 не 1000×1000 fallback) — нақты парақ өлшемі жоқ,
    ойдан қосу CLAUDE.md §10-ға қайшы («ешқашан болжамды қалдырмаңыз»).

Қолдану:
    python3 scripts/basisExtract.py <2023All.xlsx> docs/basis/basis-filtered-raw.json
"""
import json
import re
import sys

import openpyxl

WIDTH_RE = re.compile(r'(\d+(?:[.,]\d+)?)\s*[xх]\s*(\d+)', re.IGNORECASE)


def to_float(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def extract(src_path: str) -> dict:
    wb = openpyxl.load_workbook(src_path, read_only=True, data_only=True)
    ws = wb['Sheet1']
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    idx = {name: i for i, name in enumerate(header)}

    def col(r, name):
        return r[idx[name]]

    def group_of(r):
        return col(r, 'Наименование группы') or ''

    ldsp, hdf, edge = [], [], []

    for r in rows:
        g = group_of(r)
        th = to_float(col(r, 'Толщина'))

        if '/ЛДСП/' in g and th in (16.0, 18.0):
            ldsp.append(row_dict(r, idx, group=g, thickness=th))
        elif '/ХДФ/' in g and th in (3.0, 4.0):
            hdf.append(row_dict(r, idx, group=g, thickness=th))
        elif g.startswith('02 Кромочные материалы/'):
            name = col(r, 'Наименование материала') or ''
            m = WIDTH_RE.search(name)
            if m and int(m.group(2)) in (19, 22) and th in (0.4, 1.0, 2.0):
                edge.append(row_dict(r, idx, group=g, thickness=th))

    return {'ldsp': ldsp, 'hdf': hdf, 'edgeBands': edge}


def row_dict(r, idx, *, group, thickness):
    def col(name):
        return r[idx[name]]

    return {
        'articul': col('Артикул материала'),
        'name': col('Наименование материала'),
        'group': group,
        'unit': col('Единица измерения'),
        'price': col('Стоимость'),
        'thickness': thickness,
        'length': col('Длина'),
        'width': col('Ширина'),
        'stepX': col('Шаг по Х'),
        'stepY': col('Шаг по Y'),
        'colorHex': col('Цвет (HEX)'),
    }


def main() -> int:
    if len(sys.argv) != 3:
        print('Қолдану: basisExtract.py <2023All.xlsx> <out.json>', file=sys.stderr)
        return 2
    data = extract(sys.argv[1])
    with open(sys.argv[2], 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(
        f"ЛДСП: {len(data['ldsp'])}, ХДФ: {len(data['hdf'])}, "
        f"Кромка: {len(data['edgeBands'])}"
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
