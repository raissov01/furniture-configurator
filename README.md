# Furniture 3D Configurator

Корпусная мебель үшін параметрлік конфигуратор. Спец: [CLAUDE.md](CLAUDE.md),
жол картасы: [PHASE-2.md](PHASE-2.md).

## Күйі

**M1 — ядро (аяқталды).** Таза TypeScript кітапханасы: конфиг → панельдер →
деталировка. React те, three.js те жоқ.

```
npm install
npm test                                # 36 тест
npm run typecheck
npm run cutlist -- examples/wardrobe.json
```

## Құрылымы

```
src/core/          таза TS — React/three.js импорты ЖОҚ
  types.ts         домен типтері
  constants.ts     әр өндіріс константасы + физикалық түсіндірмесі
  distribute.ts    бүтін миллиметрді детерминирленген бөлу
  geometry.ts      панельдің 3D орны, AABB
  edges.ts         кромка → рез өлшемі (§4.3)
  generateCabinet.ts   ЖАЛҒЫЗ АҚИҚАТ КӨЗІ: конфиг → Panel[]
  cutList.ts       Panel[] → деталировка
  schema.ts        zod валидация
src/cli/           npm run cutlist
examples/          эталон конфиг
tests/             §8 тест жиынтығы
```

## Негізгі ереже

3D те, деталировка да, раскрой да, баға да БІР `Panel[]` массивінен оқиды.
Егер 3D мен деталировка бір-бірімен келіспей қалса — архитектура қате.

Кестеде екі өлшем жұбы бар және олар ешқашан шатаспауы керек:
**ГОТОВЫЙ** (клиент көреді, кромкасымен) және **РЕЗ** (станок кеседі).
