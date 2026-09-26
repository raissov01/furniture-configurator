/**
 * Leica DISTO D5-тің жарияланған Bluetooth keyboard Text Mode шығысы.
 * ОС HID пернелерін мәтінге айналдырғаннан КЕЙІН ғана шақырылады;
 * бұл Leica-ның меншікті GATT packet decoder-і емес.
 * Режим: Text Mode, метр бірлігі. Numbers Mode бірліксіз болғандықтан қабылданбайды.
 * https://shop.leica-geosystems.com/sites/default/files/2019-03/disto_connectivity_overview_en.pdf (p. 9)
 */
export type DistoD5Measurement = {
  distanceMm: number
  deviceModel: 'Leica DISTO D5'
  capturedAt: number
  accuracyMm: 2
  source: 'bluetoothKeyboard'
}

// D5 паспорты: ең төменгі қашықтық 0,05 м, ең жоғарысы 200 м.
const MIN_DISTANCE_TENTH_MM = 500
const MAX_DISTANCE_TENTH_MM = 2_000_000
// D5 паспорты: қолайсыз жағдайда ±2 мм; өлшеу жағдайы белгілі болмаса, осы шек қолданылады.
const CONSERVATIVE_ACCURACY_MM = 2 as const

export function parseDistoD5Text(payload: string, capturedAt: number): DistoD5Measurement {
  if (!Number.isSafeInteger(capturedAt) || capturedAt < 0) {
    throw new RangeError('capturedAt: теріс емес бүтін миллисекунд керек')
  }
  // Пайдаланушы енгізген мәтінге емес, жалғыз HID өлшем хабарламасына арналған.
  // Соңындағы Enter/Tab пернесі құрылғыда қосымша бапталады.
  const match = /^(\d{1,3})(?:[.,](\d{1,4}))?m(?:\r\n|\r|\n|\t)?$/.exec(payload)
  if (!match) {
    throw new RangeError('payload: Leica DISTO D5 Text Mode метр өлшемі керек (мысалы, 1.234m)')
  }

  const metres = Number(match[1])
  const fractionalTenthsMm = Number((match[2] ?? '').padEnd(4, '0'))
  const distanceTenthsMm = metres * 10_000 + fractionalTenthsMm
  if (distanceTenthsMm < MIN_DISTANCE_TENTH_MM || distanceTenthsMm > MAX_DISTANCE_TENTH_MM) {
    throw new RangeError('payload: қашықтық 50–200000 мм аралығында болуы керек')
  }

  // Дисплей 0,1 мм көрсете алады; жобада өлшем тек бүтін мм, жарты мм жоғарыға дөңгелектеледі.
  return {
    distanceMm: Math.floor((distanceTenthsMm + 5) / 10),
    deviceModel: 'Leica DISTO D5',
    capturedAt,
    accuracyMm: CONSERVATIVE_ACCURACY_MM,
    source: 'bluetoothKeyboard',
  }
}
