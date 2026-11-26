// Сборка клапанного узла в головке: клапан в направляющую, маслоотражательный колпачок, пружина и тарелка,
// сжатие пружины рассухаривателем и установка двух сухарей, проверка ударом мягкого молотка.
// Головка показана в разрезе (задняя половина). Размеры условные.
import { createStage, animator, THREE, PALETTE, lathe, cylY } from '../stage.js'
import { halfPlate, halfPlateSection, halfLathe, lathe2Section, annulusY, sequencer, fitBox } from './ep-kit.js'
import { springGeo } from './es-kit.js'

const STEPS = [
  { title: 'Детали узла', text: 'Клапан, направляющая втулка в головке, маслоотражательный колпачок, пружина, тарелка и два сухаря — разрезной конус, который держит тарелку на стержне. Головка показана в разрезе.' },
  { title: '1. Клапан в направляющую', text: 'Стержень смазывают чистым маслом и вводят снизу, со стороны камеры сгорания. Клапан — только на своё место: его притирали к своему седлу. Впускной и выпускной не путать.' },
  { title: '2. Колпачок', text: 'Колпачок надевают на стержень до посадки на направляющую. Чтобы проточка под сухари не порезала кромку, на стержень надевают защитный колпачок или обматывают его плёнкой.' },
  { title: '3. Пружина и тарелка', text: 'Пружину ставят нужной стороной: витки с меньшим шагом (или с меткой) — к головке. Сверху тарелка.' },
  { title: '4. Сжать пружину и вставить сухари', text: 'Рассухариватель упирается в тарелку и тарелку клапана снизу и сжимает пружину — открывается проточка на стержне. Оба сухаря вставляют пинцетом или магнитом в проточку и плавно отпускают: тарелка садится на сухари и зажимает их.' },
  { title: '5. Проверка посадки', text: 'Лёгкий удар пластиковым молотком по торцу стержня (через подкладку): сухари должны остаться на месте. Не до упора сжимать пружину и не бить стальным молотком.' },
]

const HEAD_TOP = 1.0 // верх головки (опора пружины)
const SEAT_Y = -0.55 // где тарелка клапана садится на седло
const GROOVE = 2.42 // проточка под сухари на стержне
const SPR_FREE = 1.45 // свободная высота пружины (на модели)

export default {
  title: 'Сборка клапана: пружина и сухари',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [3.2, 2.6, 7.4], target: [0, 1.1, 0], fov: 30 })
    const to = animator(stage)
    const seq = sequencer(stage)
    const { root } = stage
    const secMat = stage.mat('mark', { color: PALETTE.section, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.1 })

    // ---------- головка в разрезе: плита с отверстием под направляющую, седло снизу
    const head = new THREE.Group()
    head.add(stage.mesh(halfPlate(2.2, 1.6, 0.21, -0.9, HEAD_TOP), 'iron'))
    head.add(new THREE.Mesh(halfPlateSection(2.2, 0.21, -0.9, HEAD_TOP), secMat))
    // камера под седлом: вырез снизу показываем тёмным кругом
    const chamber = stage.mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.02, 48), 'ironDark')
    chamber.position.y = -0.91
    head.add(chamber)
    // седло — кольцо
    const SEAT = [[0.5, -0.9], [0.66, -0.9], [0.66, -0.62], [0.5, -0.62], [0.5, -0.9]]
    head.add(stage.mesh(halfLathe(SEAT, 48), 'steelDark'), new THREE.Mesh(lathe2Section(SEAT), secMat))
    // направляющая втулка — выступает над головкой
    const GUIDE = [[0.105, -0.35], [0.2, -0.35], [0.2, HEAD_TOP + 0.3], [0.105, HEAD_TOP + 0.3], [0.105, -0.35]]
    head.add(stage.mesh(halfLathe(GUIDE, 32), 'bronze'), new THREE.Mesh(lathe2Section(GUIDE), stage.mat('bronze', { side: THREE.DoubleSide })))
    root.add(head)

    // ---------- клапан
    const valve = new THREE.Group()
    valve.add(stage.mesh(lathe([[0, -0.9], [0.62, -0.9], [0.62, -0.84], [0.48, -0.7], [0.14, -0.5], [0.1, -0.3], [0.1, GROOVE - 0.08], [0.085, GROOVE - 0.05], [0.085, GROOVE + 0.05], [0.1, GROOVE + 0.08], [0.1, 2.75], [0, 2.75]], 48), 'chrome'))
    root.add(valve)
    const oil = stage.mesh(cylY(0.104, 2.0, 16), stage.mat('oil', { transparent: true, opacity: 0.55 }))
    oil.position.y = 1.0
    valve.add(oil)

    // ---------- колпачок, пружина, тарелка, сухари
    const seal = stage.mesh(lathe([[0.1, 0], [0.24, 0], [0.24, 0.26], [0.13, 0.3], [0.1, 0.3], [0.1, 0]], 32), 'rubber')
    root.add(seal)
    const spring = new THREE.Group()
    const sprMesh = stage.mesh(springGeo(0.42, 0.055, 1, 7), 'steelDark')
    sprMesh.position.y = 1 // геометрия идёт от 0 вниз до -1: сдвигаем, чтобы низ был в 0, масштабом задаём высоту
    spring.add(sprMesh)
    root.add(spring)
    const retainer = stage.mesh(lathe([[0.13, 0], [0.5, 0], [0.5, 0.07], [0.3, 0.12], [0.2, 0.3], [0.13, 0.3], [0.13, 0]], 48), 'steel')
    root.add(retainer)
    const cotters = [0, 1].map((k) => {
      const c = stage.mesh(annulusY(0.085, 0.135, k * Math.PI + 0.12, (k + 1) * Math.PI - 0.12, 0.24, 24), 'chrome')
      root.add(c)
      return c
    })

    // ---------- рассухариватель: чашка сверху на тарелке, скоба и упор под тарелкой клапана
    const tool = new THREE.Group()
    const cup = stage.mesh(lathe([[0.28, 0], [0.56, 0], [0.56, 0.45], [0.28, 0.45], [0.28, 0]], 40), stage.mat('steelBlack', { side: THREE.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false }))
    // чашка полупрозрачная: у настоящего рассухаривателя в ней окно, через которое ставят сухари
    const screwRod = stage.mesh(cylY(0.07, 1.6, 12), 'steelBlack')
    screwRod.position.y = 1.25
    const arm = stage.mesh(new THREE.BoxGeometry(2.7, 0.18, 0.22), 'steelBlack')
    arm.position.set(1.25, 2.05, 0)
    tool.add(cup, screwRod)
    root.add(tool)
    const frame = new THREE.Group()
    const leg = stage.mesh(new THREE.BoxGeometry(0.18, 1, 0.22), 'steelBlack')
    frame.add(arm, leg)
    const anvil = stage.mesh(new THREE.BoxGeometry(3.1, 0.16, 0.5), 'steelBlack')
    frame.add(anvil)
    root.add(frame)

    // ---------- молоток
    const hammer = new THREE.Group()
    const hHead = stage.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 20).rotateZ(Math.PI / 2), stage.mat('bad', { color: '#c9b36b' }))
    const hHandle = stage.mesh(cylY(0.06, 1.6, 10), stage.mat('bronze', { color: '#7d6145', metalness: 0, roughness: 0.8 }))
    hHandle.position.set(0.2, 0.8, 0)
    hHead.position.set(0, 0, 0)
    hammer.add(hHead, hHandle)
    root.add(hammer)

    // ---------- подписи
    const L = {
      valve: stage.label('Клапан', new THREE.Vector3(0.62, -0.85, 0), { side: 'right' }),
      guide: stage.label('Направляющая', new THREE.Vector3(-0.2, 0.3, 0), { side: 'left' }),
      seat: stage.label('Седло', new THREE.Vector3(-0.66, -0.75, 0), { side: 'left' }),
      seal: stage.label('Колпачок', seal, { side: 'right', offset: [0.25, 0.15, 0] }),
      spring: stage.label('Пружина', spring, { side: 'right', offset: [0.45, 0.6, 0] }),
      ret: stage.label('Тарелка', retainer, { side: 'left', offset: [-0.5, 0.05, 0] }),
      cot: stage.label('Сухари', cotters[0], { side: 'right', offset: [0.15, 0, 0], tone: 'accent' }),
      oil: stage.label('Стержень смазан', new THREE.Vector3(0.1, 1.8, 0), { side: 'right', tone: 'ok' }),
      groove: stage.label('Проточка под сухари', new THREE.Vector3(0.1, GROOVE, 0), { side: 'right', tone: 'accent' }),
      tool: stage.label('Рассухариватель', new THREE.Vector3(2.6, 2.1, 0), { side: 'right' }),
      tap: stage.label('Лёгкий удар через подкладку', new THREE.Vector3(0, 3.5, 0), { side: 'top', tone: 'accent' }),
      ok: stage.label('Сухари сели', new THREE.Vector3(-0.15, GROOVE, 0), { side: 'left', tone: 'ok' }),
    }
    const showLabels = (keys) => Object.entries(L).forEach(([k, l]) => l.show(keys.includes(k)))

    // ---------- состояние (все высоты — «нижняя точка» детали)
    const st = {
      valve: -2.4, // смещение клапана вниз от рабочего положения
      seal: 3.9, sealOn: 1,
      spring: 4.4, sprLen: SPR_FREE, sprOn: 1,
      ret: 6.0, retOn: 1,
      cotOut: 1.0, cotY: 6.5, cotOn: 1,
      tool: 0, cupY: 0,
      hammer: 0, hy: 0, oil: 0,
    }
    const restRet = HEAD_TOP + SPR_FREE - 0.25 // тарелка на собранном клапане: пружина чуть сжата
    stage.onFrame(() => {
      valve.position.y = -st.valve
      oil.visible = st.oil > 0.5
      seal.visible = st.sealOn > 0.5
      seal.position.y = st.seal
      spring.visible = st.sprOn > 0.5
      spring.position.y = st.spring
      sprMesh.scale.y = st.sprLen
      sprMesh.position.y = st.sprLen
      retainer.visible = st.retOn > 0.5
      retainer.position.y = st.ret
      cotters.forEach((c, k) => {
        c.visible = st.cotOn > 0.5
        c.position.set(0, st.cotY, (k ? 1 : -1) * st.cotOut)
      })
      const show = st.tool > 0.5
      tool.visible = frame.visible = show
      cup.position.y = st.cupY
      screwRod.position.y = st.cupY + 1.25
      arm.position.y = st.cupY + 2.05
      // стойка скобы — от упора под клапаном до плеча над чашкой
      leg.scale.y = st.cupY + 2.05 + 1.12
      leg.position.set(2.5, (st.cupY + 2.05 - 1.12) / 2, 0)
      anvil.position.set(0.95, -1.12, 0)
      hammer.visible = st.hammer > 0.5
      hammer.position.set(0, 3.0 + st.hy, 0)
    })

    // положения «собрано»
    const assembled = (d) => {
      to(st, 'valve', 0, d)
      to(st, 'seal', HEAD_TOP + 0.3 - 0.02, d)
      to(st, 'spring', HEAD_TOP, d)
      to(st, 'sprLen', restRet - HEAD_TOP, d)
      to(st, 'ret', restRet, d)
      to(st, 'cotOut', 0, d)
      to(st, 'cotY', GROOVE - 0.12, d)
    }
    const exploded = (d) => {
      to(st, 'valve', 2.4, d)
      to(st, 'seal', 3.9, d)
      to(st, 'spring', 4.4, d)
      to(st, 'sprLen', SPR_FREE, d)
      to(st, 'ret', 6.0, d)
      to(st, 'cotOut', 0.8, d)
      to(st, 'cotY', 6.6, d)
    }

    const box = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b))
    const VIEWS = [
      [box([-1.5, -3.4, -1], [1.5, 6.8, 1]), [0.45, 0.25, 1]],
      [box([-1.5, -3.4, -1], [1.5, 3.0, 1]), [0.45, 0.2, 1]],
      [box([-1.2, 0.4, -1], [1.2, 4.4, 1]), [0.45, 0.3, 1]],
      [box([-1.3, 0.4, -1], [1.3, 6.4, 1]), [0.45, 0.3, 1]],
      [box([-1.6, -1.3, -1], [3.0, 4.9, 1]), [0.35, 0.25, 1]],
      [box([-1.3, 0.6, -1], [1.3, 4.2, 1]), [0.45, 0.3, 1]],
    ]

    const apply = (i, instant) => {
      const d = instant ? 0 : 0.9
      seq.stop()
      to(st, 'tool', 0, 0)
      to(st, 'hammer', 0, 0)
      to(st, 'cupY', 0, 0)
      to(st, 'oil', i === 1 ? 1 : 0, 0)
      const vis = (seal, spr, ret, cot) => {
        to(st, 'sealOn', seal, 0)
        to(st, 'sprOn', spr, 0)
        to(st, 'retOn', ret, 0)
        to(st, 'cotOn', cot, 0)
      }
      if (i === 0) {
        vis(1, 1, 1, 1)
        exploded(d)
        showLabels(['valve', 'guide', 'seat', 'seal', 'spring', 'ret', 'cot'])
      } else if (i === 1) {
        vis(0, 0, 0, 0)
        exploded(0)
        showLabels(['valve', 'guide', 'seat', 'oil'])
        if (instant) to(st, 'valve', 0, 0)
        else seq.run([[0.5, () => to(st, 'valve', 0, 2.0)], [4.0, () => to(st, 'valve', 2.4, 0)]], 4.6)
      } else if (i === 2) {
        vis(1, 0, 0, 0)
        to(st, 'valve', 0, 0)
        showLabels(['seal', 'guide'])
        const on = HEAD_TOP + 0.3 - 0.02
        if (instant) to(st, 'seal', on, 0)
        else {
          to(st, 'seal', 3.6, 0)
          seq.run([[0.4, () => to(st, 'seal', on, 1.6)], [3.6, () => to(st, 'seal', 3.6, 0)]], 4.2)
        }
      } else if (i === 3) {
        vis(1, 1, 1, 0)
        to(st, 'valve', 0, 0)
        to(st, 'seal', HEAD_TOP + 0.28, 0)
        to(st, 'sprLen', SPR_FREE, 0)
        showLabels(['spring', 'ret'])
        if (instant) {
          to(st, 'spring', HEAD_TOP, 0)
          to(st, 'ret', HEAD_TOP + SPR_FREE, 0)
        } else {
          to(st, 'spring', 4.4, 0)
          to(st, 'ret', 6.0, 0)
          seq.run([[0.4, () => to(st, 'spring', HEAD_TOP, 1.4)], [1.6, () => to(st, 'ret', HEAD_TOP + SPR_FREE, 1.2)], [4.6, () => { to(st, 'spring', 4.4, 0); to(st, 'ret', 6.0, 0) }]], 5.0)
        }
      } else if (i === 4) {
        vis(1, 1, 1, 1)
        to(st, 'valve', 0, 0)
        to(st, 'seal', HEAD_TOP + 0.28, 0)
        to(st, 'spring', HEAD_TOP, 0)
        to(st, 'tool', 1, 0)
        showLabels(['tool', 'groove', 'cot', 'ret'])
        const freeRet = HEAD_TOP + SPR_FREE
        const low = GROOVE - 0.55 // тарелка опущена ниже проточки
        const reset = () => {
          to(st, 'sprLen', SPR_FREE, 0)
          to(st, 'ret', freeRet, 0)
          to(st, 'cupY', freeRet + 0.07, 0)
          to(st, 'cotOut', 1.0, 0)
          to(st, 'cotY', GROOVE - 0.12, 0)
        }
        reset()
        if (instant) assembled(0)
        else
          seq.run(
            [
              [0.6, () => { to(st, 'ret', low, 1.4); to(st, 'sprLen', low - HEAD_TOP, 1.4); to(st, 'cupY', low + 0.07, 1.4) }],
              [2.3, () => to(st, 'cotOut', 0, 1.0)],
              [3.6, () => { to(st, 'ret', restRet, 1.0); to(st, 'sprLen', restRet - HEAD_TOP, 1.0); to(st, 'cupY', freeRet + 0.07, 1.0) }],
              [4.7, () => L.ok.show(true)],
              [6.4, () => { L.ok.show(false); reset() }],
            ],
            7.0,
          )
      } else if (i === 5) {
        vis(1, 1, 1, 1)
        assembled(d)
        to(st, 'hammer', 1, 0)
        showLabels(['tap', 'cot', 'ret'])
        if (!instant)
          seq.run(
            [
              [0.3, () => to(st, 'hy', 1.2, 0.5)],
              [1.0, () => to(st, 'hy', 0, 0.12)],
              [1.15, () => { to(st, 'valve', 0.06, 0.08); to(st, 'ret', restRet - 0.06, 0.08); to(st, 'cotY', GROOVE - 0.18, 0.08) }],
              [1.3, () => { to(st, 'valve', 0, 0.2); to(st, 'ret', restRet, 0.2); to(st, 'cotY', GROOVE - 0.12, 0.2) }],
              [1.5, () => L.ok.show(true)],
              [1.6, () => to(st, 'hy', 1.2, 0.5)],
              [3.4, () => L.ok.show(false)],
            ],
            3.6,
          )
      }
      L.ok.show(false)
      const [bx, dir] = VIEWS[i]
      fitBox(stage, bx, dir, { pad: 1.08, ms: instant ? 0 : 900 })
      if (instant) stage.setHome()
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
