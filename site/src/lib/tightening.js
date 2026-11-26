// Упражнения тренажёра «Порядок затяжки». Правила — по уроку «Резьбовые соединения и момент затяжки»
// и схемам 3D-модели (TIGHTEN в model3d/assemblySteps.js): от центра к краям, крест-накрест, в несколько проходов.
// Проверяется правило, а не один заученный порядок: любой порядок по правилу засчитывается.
// allowed(prefix) — какие болты можно тянуть следующими; why(prefix, bolt) — почему этот болт сейчас нельзя.
// Если у прохода sameAs — порядок должен повторить проход с этим номером.

// ---------- круглый фланец, 6 болтов: «звёздочка» — болт, напротив него, соседний с первым, напротив…
const flangeBolts = [...Array(6)].map((_, i) => {
  const a = (-90 + i * 60) * (Math.PI / 180)
  return { x: 200 + 120 * Math.cos(a), y: 170 + 120 * Math.sin(a) }
})
const flangeOrders = []
for (let a = 0; a < 6; a++) for (const d of [1, -1]) flangeOrders.push([0, 1, 2].flatMap((k) => [(a + k * d + 6) % 6, (a + k * d + 3 + 6) % 6]))

// ---------- прямоугольная крышка, 4 угла (0 ЛВ, 1 ПВ, 2 ПН, 3 ЛН): по диагоналям
const coverBolts = [
  { x: 90, y: 80 },
  { x: 310, y: 80 },
  { x: 310, y: 260 },
  { x: 90, y: 260 },
]
const coverOrders = []
for (let a = 0; a < 4; a++) for (const b of [(a + 1) % 4, (a + 3) % 4]) coverOrders.push([a, (a + 2) % 4, b, (b + 2) % 4])

// по списку допустимых порядков: какие болты допустимы после prefix
const fromOrders = (orders) => (prefix) => {
  const ok = new Set()
  for (const o of orders) if (prefix.every((b, i) => o[i] === b)) ok.add(o[prefix.length])
  return [...ok].filter((b) => b !== undefined)
}

// ---------- головка (условная, 10 болтов: 2 ряда по 5). Колонка 2 — центр.
// Сначала центральная пара, потом болты на расстоянии 1 от центра, потом 2; внутри группы — по диагоналям.
const headBolts = []
for (const row of [0, 1]) for (let c = 0; c < 5; c++) headBolts.push({ x: 60 + c * 70, y: row ? 245 : 95, row, col: c })
const dist = (b) => Math.abs(headBolts[b].col - 2)
const diag = (b) => headBolts.findIndex((o) => o.row !== headBolts[b].row && o.col === 4 - headBolts[b].col)
function headAllowed(prefix) {
  const left = headBolts.map((_, i) => i).filter((i) => !prefix.includes(i))
  if (!left.length) return []
  const d = Math.min(...left.map(dist))
  // начатую диагональ нужно закончить: если в группе нечётное число затянутых — следующий напротив последнего
  const done = prefix.filter((b) => dist(b) === d)
  if (done.length % 2 === 1) return [diag(done.at(-1))]
  return left.filter((b) => dist(b) === d)
}
function headWhy(prefix, bolt) {
  const left = headBolts.map((_, i) => i).filter((i) => !prefix.includes(i))
  const d = Math.min(...left.map(dist))
  if (dist(bolt) > d) return 'Рано: сначала болты ближе к центру. Головку тянут от центра к краям, чтобы она прижималась от середины и не коробилась.'
  return 'Крест-накрест: следующий — болт по диагонали напротив предыдущего.'
}

// ---------- коренные крышки ЯМЗ-240: 7 крышек, у каждой 2 вертикальных и 2 горизонтальных стяжных болта.
// Болт = крышка·4 + (0/1 вертикальные, 2/3 горизонтальные), как в 3D-модели.
const capBolts = []
for (let c = 0; c < 7; c++) {
  const x = 40 + c * 55
  capBolts.push({ x: x - 12, y: 150 }, { x: x + 12, y: 150 }, { x: x - 22, y: 205, h: true }, { x: x + 22, y: 205, h: true })
}
const cap = (b) => Math.floor(b / 4)
const capDist = (b) => Math.abs(cap(b) - 3)
function capsAllowed(kind) {
  const mine = (b) => (kind === 'v' ? b % 4 < 2 : b % 4 >= 2)
  return (prefix) => {
    const left = capBolts.map((_, i) => i).filter((i) => mine(i) && !prefix.includes(i))
    if (!left.length) return []
    const last = prefix.at(-1)
    // у начатой крышки сначала второй болт пары
    if (last !== undefined && prefix.filter((b) => cap(b) === cap(last)).length % 2 === 1) return left.filter((b) => cap(b) === cap(last))
    const d = Math.min(...left.map(capDist))
    return left.filter((b) => capDist(b) === d)
  }
}
function capsWhy(kind) {
  return (prefix, bolt) => {
    const isV = bolt % 4 < 2
    if (kind === 'v' && !isV) return 'Горизонтальные стяжные болты — последними, когда все вертикальные затянуты.'
    if (kind === 'h' && isV) return 'Вертикальные уже затянуты. Сейчас — горизонтальные стяжные.'
    const last = prefix.at(-1)
    if (last !== undefined && prefix.filter((b) => cap(b) === cap(last)).length % 2 === 1) return 'Сначала второй болт этой же крышки: пару тянут поочерёдно, чтобы крышка села ровно.'
    return 'От средней (4-й) крышки к краям: следующая крышка — ближайшая к середине из оставшихся.'
  }
}

export const EXERCISES = [
  {
    id: 'cover',
    title: 'Крышка на 4 болтах',
    intro: 'Прямоугольная крышка или фланец на четырёх болтах. Тянут крест-накрест — по диагоналям, в два прохода.',
    w: 400, h: 340,
    shape: { kind: 'rect', x: 50, y: 40, w: 300, h: 260 },
    bolts: coverBolts,
    passes: [
      { t: 'Проход 1 — предварительный момент', allowed: fromOrders(coverOrders), why: () => 'Крест-накрест: следующий болт — по диагонали напротив.' },
      { t: 'Проход 2 — окончательный момент, тот же порядок', sameAs: 0 },
    ],
  },
  {
    id: 'flange',
    title: 'Фланец на 6 болтах',
    intro: 'Круглый фланец, например шкив или крышка насоса. «Звёздочкой»: болт, затем напротив него, затем соседний с первым и снова напротив.',
    w: 400, h: 340,
    shape: { kind: 'circle', cx: 200, cy: 170, r: 150, hole: 55 },
    bolts: flangeBolts,
    passes: [
      {
        t: 'Проход 1 — предварительный момент',
        allowed: fromOrders(flangeOrders),
        why: (prefix) =>
          prefix.length % 2 === 1
            ? 'Следующий — напротив, через центр.'
            : 'Теперь соседний с первым болтом пары, по кругу в ту же сторону, что и раньше.',
      },
      { t: 'Проход 2 — окончательный момент, тот же порядок', sameAs: 0 },
    ],
  },
  {
    id: 'head',
    title: 'Головка цилиндров (условная, 10 болтов)',
    intro: 'Схема условная: настоящие порядок и число болтов — по ТК. Правило общее: от центра к краям, крест-накрест, в три прохода.',
    w: 400, h: 340,
    shape: { kind: 'rect', x: 25, y: 55, w: 350, h: 230, chambers: true },
    bolts: headBolts,
    passes: [
      { t: 'Проход 1 — предварительный момент', allowed: headAllowed, why: headWhy },
      { t: 'Проход 2 — окончательный момент, тот же порядок', sameAs: 0 },
      { t: 'Проход 3 — доворот на угол по ТК, тот же порядок', sameAs: 0 },
    ],
  },
  {
    id: 'maincap',
    title: 'Коренные крышки ЯМЗ-240',
    intro: '7 крышек, у каждой 2 вертикальных болта и 2 горизонтальных стяжных. От средней крышки к краям, вертикальные — парой; стяжные — последними. На заводе вертикальные тянут ещё и вторым проходом окончательным моментом, а после каждой крышки проворачивают вал.',
    w: 420, h: 300,
    shape: { kind: 'caps' },
    bolts: capBolts,
    passes: [
      { t: 'Проход 1 — вертикальные болты', allowed: capsAllowed('v'), why: capsWhy('v') },
      { t: 'Проход 2 — горизонтальные стяжные болты', allowed: capsAllowed('h'), why: capsWhy('h') },
    ],
  },
]
