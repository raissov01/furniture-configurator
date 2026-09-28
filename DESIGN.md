---
name: AisMebel
description: Платформа для мебельных цехов — корпус, раскрой, присадка и КП из одной модели.
colors:
  brand-graphite: "#1F2A37"
  brand-amber: "#F2A33A"
  ink: "#1F2A37"
  ink-soft: "#4B5563"
  panel: "#E7EAEE"
  paper: "#FFFFFF"
  rule: "#AAB3BD"
  oak-deep: "#87520B"
  neutral-offcut: "#788695"
  dark-panel: "#141B24"
  dark-paper: "#273342"
  dark-ink: "#F5F7F9"
  p100-chrome: "#F0F0F0"
  p100-canvas: "#FFFFFF"
  p100-divider: "#DBDBDB"
  p100-tool-selected: "#CCE8FF"
  p100-tool-hover: "#E5F3FF"
  p100-text: "#000000"
typography:
  display:
    fontFamily: "PT Sans Narrow, sans-serif"
    fontWeight: 700
    fontSize: "clamp(2.6rem, 6vw, 4.2rem)"
    lineHeight: 0.98
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.625
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
  p100-ui:
    fontFamily: "Segoe UI, Tahoma, Arial, sans-serif"
    fontSize: "12px"
    lineHeight: 1.2
  p100-small:
    fontFamily: "Segoe UI, Tahoma, Arial, sans-serif"
    fontSize: "11px"
  p100-touch:
    fontFamily: "Segoe UI, Tahoma, Arial, sans-serif"
    fontSize: "14px"
rounded:
  none: "0px"
  p100: "1px"
  p100-dialog: "2px"
spacing:
  gutter-mobile: "20px"
  gutter-desktop: "32px"
  section: "56px"
components:
  button-primary:
    backgroundColor: "{colors.brand-graphite}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
---

# Design System: AisMebel

> impeccable `document` жолымен бар коддан жазылды (`app/globals.css`,
> `components/site/*`, `app/layout.tsx`). Жаңа әлем ойлап табылған жоқ.

## Overview

Екі әлем, бір бренд:

1. **Сайт және клиент беттері** (лендинг, `/c`, `/view`, `/mobile`) —
   «сызба парағы»: фон — плита (`panel`), блоктар — қағаз (`paper`), бөлімдерді
   нақты миллиметрі бар өлшем сызығы бөледі. Тұтас түс, 1px жиек, бұрыш 0.
2. **Десктоп конфигураторы** (`.p100-workspace`, `.p100-cut-page`) — өлшенген
   PRO100 v7.08 палитрасы, 12px Segoe UI. Бұл әлем ӨЗГЕРМЕЙДІ; тек ыңғайлылық.

## Colors

### Primary
- **Графит `#1F2A37`** — мәтін, негізгі CTA фоны, өлшем сызығы.
### Secondary
- **Амбер `#F2A33A`** — тек мағыналы жерде: раскрой бөлшегі, қараңғы темадағы CTA.
  `oak-deep #87520B` — амбердің ашық фондағы мәтіндік нұсқасы.
### Neutral
- `panel #E7EAEE`, `paper #FFFFFF`, `rule #AAB3BD`, `ink-soft #4B5563`.
### Named Rules
- **Бір акцент.** Көк (`#005A9E`, `#CCE8FF`) тек PRO100 қабығында рұқсат.
- **Градиент, blur, glass жоқ** (иесінің ережесі).

## Typography

PT Sans Narrow 700 — тақырыптар (аймақтың техникалық көрсеткіш қарпі);
Golos Text — мәтін; JetBrains Mono — тек сандар, өлшем, кесте мәндері.
Барлығы `cyrillic-ext` жиынымен (қазақ әріптері үшін міндетті).

### Hierarchy
- H1: 2.6rem → 4.2rem, leading 0.98.
- H2: 1.875rem → 3rem, leading 1.05.
- Мәтін: 16px, leading 1.625, ені ≤ 65ch.
- Қосалқы белгі: 11–12px mono — тек өлшем/мән үшін, «costume» ретінде емес.

## Layout

`max-w-6xl`, гуттер 20/32px. Hero — сол жақта мәтін, оң жақта нақты раскрой
парағы. Бөлімдер арасында `Dimension` өлшем сызығы (мәні бетке қатысты).

## Elevation & Depth

Көлеңке жоқ. Тереңдік — фон ауысуы (`panel` → `paper`) және 1px `rule` жиек.

## Shapes

Бұрыш 0 (сайт), 1px (PRO100 батырмасы). Дөңгелек пилюль жоқ.

## Components

### Buttons
- Primary: графит фон, ақ мәтін, 1px графит жиек, биіктігі ≥ 44px.
- Ghost: мөлдір, 1px `ink` жиек.
- Бір ниетке бір белгі: «Открыть конфигуратор» барлық жерде бірдей.
### Cards / Containers
- `.sheet` — ақ қағаз + 1px `rule`. Ішіне карта салынбайды.
### Signature Component
- **Өлшем сызығы** (`.dimline`): екі ұшында штрих, ортасында нақты мм.
- **Раскрой парағы** (`SheetFigure`): `nestPanels()` нәтижесі; рез реті
  `sheetCutPlan()`-нан алынады.

## Do's and Don'ts

### Do:
- Санды ядродан ал; өлшемді H × W × D әріппен жаз.
- Қозғалыс — мағына үшін (рез реті, «готовый → рез»), `prefers-reduced-motion`-да соңғы күй бірден.
### Don't:
- Градиент, blur, glassmorphism, эмоджи, көлеңке.
- Әр бөлім үстіне eyebrow / «01 —» нөмірі.
- PRO100 қабығының палитрасын өзгерту.
