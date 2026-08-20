# Furniture 3D Configurator

Корпусная мебель үшін параметрлік конфигуратор. Спец: [CLAUDE.md](CLAUDE.md),
жол картасы: [PHASE-2.md](PHASE-2.md).

## Күйі

**M1 — ядро (аяқталды).** Таза TypeScript кітапханасы: конфиг → панельдер →
деталировка. React те, three.js те жоқ.

**M2 — көп секциялы кабинет (A1) + материал/кромка кітапханасы (A4) (аяқталды).**

```
npm install
npm test                                # 67 тест
npm run typecheck
npm run cutlist -- examples/wardrobe.json
npm run cutlist -- examples/wardrobe-3section.json
npm run cutlist -- examples/wardrobe-v1.json    # ескі схема, автомиграция
```

## Құрылымы

```
src/core/          таза TS — React/three.js импорты ЖОҚ
  types.ts         домен типтері
  constants.ts     әр өндіріс константасы + физикалық түсіндірмесі
  distribute.ts    бүтін миллиметрді детерминирленген бөлу
  geometry.ts      панельдің 3D орны, AABB
  edges.ts         кромка → рез өлшемі (§4.3)
  sections.ts      секцияларға ен бөлу, фасад ұялары (A1)
  generateCabinet.ts   ЖАЛҒЫЗ АҚИҚАТ КӨЗІ: конфиг → Panel[]
  cutList.ts       Panel[] → деталировка
  seed.ts          материал/кромка кітапханасы (A4)
  schema.ts        zod валидация + схема миграциясы (v1 → v2)
src/cli/           npm run cutlist
examples/          эталон конфиг
tests/             §8 тест жиынтығы
```

## Негізгі ереже

3D те, деталировка да, раскрой да, баға да БІР `Panel[]` массивінен оқиды.
Егер 3D мен деталировка бір-бірімен келіспей қалса — архитектура қате.

Кестеде екі өлшем жұбы бар және олар ешқашан шатаспауы керек:
**ГОТОВЫЙ** (клиент көреді, кромкасымен) және **РЕЗ** (станок кеседі).
