// Поршень и кольца: метка TOP, разводка замков, замер замкового зазора щупом,
// установка поршня в гильзу через обжимку. Размеры и углы условные (по ТК).
import { createStage, animator, THREE, PALETTE, lathe, cylX, cylY } from '../stage.js'
import { annulusY, halfLathe, lathe2Section, sequencer, fitBox } from './ep-kit.js'

const STEPS = [
  { title: 'Поршень и три кольца', text: 'Сверху два компрессионных кольца — держат газы. Ниже маслосъёмное — снимает лишнее масло со стенки гильзы. Поршень соединяется с шатуном пальцем.' },
  { title: 'Метка «TOP» — вверх', text: 'Кольца надевают специальными щипцами, не растягивая лишнего: сначала маслосъёмное, потом второе, потом первое. Метка «TOP» (или точка, буква) смотрит вверх, к днищу.' },
  { title: 'Замки разводят', text: 'Если замки колец стоят в одну линию, газы прорвутся через них. Поэтому замки разводят по кругу (например, примерно через 120°) и не ставят по оси пальца. Точная схема — в ТК.' },
  { title: 'Замковый зазор', text: 'Кольцо вставляют в гильзу и выравнивают ровно (например, днищем поршня). Щель в замке меряют щупом. Значение — по ТК, результат записывают.' },
  { title: 'Обжимка и установка', text: 'Гильзу, поршень и кольца смазывают чистым маслом. Обжимка сжимает кольца, поршень плавно вдвигают в гильзу рукояткой молотка — без ударов. Если не идёт — остановиться и проверить кольца.' },
]

const Y1 = 1.55, Y2 = 1.39, Y3 = 1.18 // высоты канавок
const LINER_TOP = 2.6

export default {
  title: 'Поршень и кольца',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [3, 3, 7], target: [0, 1.2, 0], fov: 30 })
    const to = animator(stage)
    const seq = sequencer(stage)
    const { root } = stage

    // ---------- поршень с шатуном
    const piston = new THREE.Group()
    const PROF = [[0, 0], [0.985, 0], [0.985, 1.12], [0.88, 1.12], [0.88, 1.24], [0.97, 1.24], [0.97, 1.36], [0.88, 1.36], [0.88, 1.42], [0.97, 1.42], [0.97, 1.52], [0.88, 1.52], [0.88, 1.58], [0.97, 1.58], [0.97, 1.7], [0.62, 1.7], [0.45, 1.58], [0.25, 1.5], [0, 1.56]]
    piston.add(stage.mesh(lathe(PROF, 64), 'steelDark'))
    const pin = stage.mesh(cylX(0.27, 2.02, 24), 'chrome')
    pin.position.y = 0.55
    piston.add(pin)
    const rod = stage.mesh(new THREE.BoxGeometry(0.32, 1.9, 0.36), 'steel')
    rod.position.y = -0.4
    piston.add(rod)
    root.add(piston)

    // ---------- кольца: rotation.y — где замок, rotation.x = π — кольцо перевёрнуто
    const GAP = 0.1
    const mkRing = (h, kind) => {
      const g = new THREE.Group()
      if (kind === 'oil') {
        for (const dy of [-0.045, 0.045]) {
          const rail = new THREE.Mesh(annulusY(0.9, 0.985, GAP / 2, Math.PI * 2 - GAP / 2, 0.026), stage.mat('chrome'))
          rail.position.y = dy
          g.add(rail)
        }
        g.add(new THREE.Mesh(annulusY(0.89, 0.965, GAP / 2, Math.PI * 2 - GAP / 2, 0.064), stage.mat('steelBlack')))
      } else {
        g.add(new THREE.Mesh(annulusY(0.89, 0.985, GAP / 2, Math.PI * 2 - GAP / 2, h), stage.mat(kind)))
      }
      // флажок у замка — чтобы замок был виден сверху
      const flag = stage.mesh(new THREE.BoxGeometry(0.22, 0.03, 0.05), 'mark')
      flag.position.set(1.06, 0, 0)
      flag.visible = false
      g.add(flag)
      g.flag = flag
      // метка TOP на верхней стороне
      const top = stage.mesh(new THREE.BoxGeometry(0.08, 0.012, 0.03), 'ok')
      top.position.set(0.94 * Math.cos(0.4), h / 2 + 0.006, -0.94 * Math.sin(0.4))
      top.rotation.y = 0.4
      g.add(top)
      g.top = top
      return g
    }
    const r1 = mkRing(0.055, 'chrome')
    const r2 = mkRing(0.055, 'steel')
    const r3 = mkRing(0.12, 'oil')
    r3.top.visible = false
    r2.top.position.set(0.94 * Math.cos(-0.9), 0.0335, -0.94 * Math.sin(-0.9))
    r2.top.rotation.y = -0.9
    const rings = [r1, r2, r3]
    rings.forEach((r) => root.add(r))

    // ---------- гильза (задняя половина) и обжимка
    const LIN = [[1.0, -0.6], [1.16, -0.6], [1.16, 2.4], [1.32, 2.4], [1.32, LINER_TOP], [1.0, LINER_TOP], [1.0, -0.6]]
    const liner = new THREE.Group()
    liner.add(stage.mesh(halfLathe(LIN, 56), 'steel'))
    liner.add(stage.mesh(lathe2Section(LIN), stage.mat('steelDark', { side: THREE.DoubleSide, color: '#9c988f', metalness: 0.3, roughness: 0.7 })))
    root.add(liner)
    const sleeve = new THREE.Group()
    sleeve.add(stage.mesh(lathe([[0.995, 0], [1.05, 0], [1.05, 0.6], [0.995, 0.6], [0.995, 0]], 56), stage.mat('chrome', { side: THREE.DoubleSide })))
    const ratchet = stage.mesh(new THREE.BoxGeometry(0.3, 0.3, 0.22), 'steelBlack')
    ratchet.position.set(1.18, 0.3, 0.3)
    const lever = stage.mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), 'steelBlack')
    lever.position.set(1.3, 0.3, 0.7)
    sleeve.add(ratchet, lever)
    sleeve.position.y = LINER_TOP
    root.add(sleeve)
    const handle = new THREE.Group()
    const wood = stage.mesh(cylY(0.13, 2.2, 16), stage.mat('bronze', { color: '#7d6145', metalness: 0, roughness: 0.8 }))
    wood.position.y = 1.1
    handle.add(wood)
    root.add(handle)
    const push = stage.arrow(new THREE.Vector3(0.55, 4.6, 0.5), new THREE.Vector3(0.55, 3.8, 0.5), PALETTE.milk, { head: 0.22, width: 0.16 })
    root.add(push)

    // ---------- кольцо в гильзе и щуп
    const mRing = new THREE.Group()
    mRing.add(new THREE.Mesh(annulusY(0.9, 0.998, 0.015, Math.PI * 2 - 0.015, 0.055), stage.mat('chrome')))
    mRing.rotation.y = Math.PI / 2 // замок у задней стенки
    mRing.position.y = 1.9
    root.add(mRing)
    const feeler = new THREE.Group()
    const blade = stage.mesh(new THREE.BoxGeometry(0.022, 1.3, 0.18), 'chrome')
    blade.position.y = 0.65
    const fHandle = stage.mesh(new THREE.BoxGeometry(0.08, 0.5, 0.3), 'steelDark')
    fHandle.position.y = 1.5
    feeler.add(blade, fHandle)
    feeler.position.set(0, 1.9, -0.93)
    root.add(feeler)

    // ---------- подписи
    const L = {
      k1: stage.label('Компрессионное 1', new THREE.Vector3(-0.99, 3.3, 0), { side: 'left' }),
      k2: stage.label('Компрессионное 2', new THREE.Vector3(0.99, 2.85, 0), { side: 'right' }),
      k3: stage.label('Маслосъёмное', new THREE.Vector3(-0.99, 2.4, 0), { side: 'left' }),
      pin: stage.label('Палец', new THREE.Vector3(1.01, 0.55, 0), { side: 'right' }),
      top1: stage.label('TOP', r1.top, { side: 'top', tone: 'ok' }),
      top2: stage.label('TOP', r2.top, { side: 'top', tone: 'ok' }),
      g1: stage.label('замок 1', r1.flag, { side: 'right', offset: [0.12, 0, 0] }),
      g2: stage.label('замок 2', r2.flag, { side: 'right', offset: [0.12, 0, 0] }),
      g3: stage.label('замок 3', r3.flag, { side: 'right', offset: [0.12, 0, 0] }),
      gaps: stage.label('', new THREE.Vector3(0, 1.75, 0), { side: 'top', tone: 'big' }),
      mring: stage.label('Кольцо ровно в гильзе', new THREE.Vector3(-0.95, 1.9, 0), { side: 'left' }),
      feeler: stage.label('Щуп в замке', blade, { side: 'right', offset: [0, 0.6, 0], tone: 'accent' }),
      sleeve: stage.label('Обжимка колец', new THREE.Vector3(-1.05, LINER_TOP + 0.3, 0), { side: 'left' }),
      push: stage.label('Плавно, без ударов', new THREE.Vector3(0.55, 4.6, 0.5), { side: 'right', tone: 'accent' }),
      liner: stage.label('Гильза', new THREE.Vector3(1.16, 0.6, 0), { side: 'right' }),
    }
    const showLabels = (keys) => Object.entries(L).forEach(([k, l]) => l.show(keys.includes(k)))

    // ---------- состояние
    const st = { py: 0, spin: 1, piston: 1, liner: 0, sleeve: 0, feelerY: 3.4, mring: 0, push: 0 }
    const rs = rings.map(() => ({ y: 0, a: 0, flip: 0 }))
    const HOME = [Y1, Y2, Y3]
    const EXPL = [3.3, 2.85, 2.4]
    const STAG = [Math.PI / 6, (5 * Math.PI) / 6, (3 * Math.PI) / 2]
    let spinA = 0

    stage.onFrame((dt, t) => {
      if (stage.playing) spinA += dt * 0.35 * st.spin
      piston.visible = st.piston > 0.5
      piston.position.y = st.py
      piston.rotation.y = spinA
      rings.forEach((r, k) => {
        r.visible = piston.visible
        r.position.y = rs[k].y + st.py
        r.rotation.set(Math.PI * rs[k].flip, rs[k].a + spinA, 0, 'YXZ')
      })
      liner.visible = st.liner > 0.5
      sleeve.visible = st.sleeve > 0.5
      handle.visible = st.sleeve > 0.5
      handle.position.y = st.py + 1.7
      push.visible = st.push > 0.5
      push.position.y = 4.6 + Math.sin(t * 4) * 0.05
      mRing.visible = st.mring > 0.5
      feeler.visible = st.mring > 0.5
      feeler.position.y = st.feelerY
    })

    const box = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b))
    const VIEWS = [
      [box([-1.1, -1.2, -1.1], [1.1, 3.5, 1.1]), [0.6, 0.4, 1]],
      [box([-1.1, -0.2, -1.1], [1.1, 3.5, 1.1]), [0.5, 0.55, 1]],
      [box([-1.2, 1.0, -1.2], [1.2, 1.8, 1.2]), [0.25, 1.7, 0.7]],
      [box([-1.3, 1.4, -1.3], [1.3, 3.0, 0.3]), [0.15, 0.8, 1]],
      [box([-1.4, -0.6, -1.4], [1.4, 4.7, 1.4]), [0.5, 0.35, 1]],
    ]

    const ringTo = (k, key, v, dur) => to(rs[k], key, v, dur)

    const apply = (i, instant) => {
      const d = instant ? 0 : 0.8
      seq.stop()
      to(st, 'spin', i <= 1 ? 1 : 0, 0.5)
      if (i === 0) spinA = 0
      to(st, 'piston', i === 3 ? 0 : 1, 0)
      to(st, 'liner', i >= 3 ? 1 : 0, 0)
      to(st, 'sleeve', i === 4 ? 1 : 0, 0)
      to(st, 'mring', i === 3 ? 1 : 0, 0)
      to(st, 'push', 0, 0)
      to(st, 'py', 0, i === 4 ? 0 : d)
      rings.forEach((r) => (r.flag.visible = i === 2))
      showLabels([['k1', 'k2', 'k3', 'pin'], ['top1', 'top2'], ['g1', 'g2', 'g3', 'gaps'], ['mring', 'feeler', 'liner'], ['sleeve', 'liner'], []][i])
      if (i === 0) {
        rs.forEach((r, k) => {
          ringTo(k, 'y', EXPL[k], d)
          ringTo(k, 'a', 0, d)
          ringTo(k, 'flip', 0, d)
        })
      } else if (i === 1) {
        // снизу вверх: маслосъёмное, второе, первое (первое сначала перевёрнуто)
        rs.forEach((r, k) => {
          ringTo(k, 'y', EXPL[k], 0)
          ringTo(k, 'a', 0, 0)
          ringTo(k, 'flip', 0, 0)
        })
        ringTo(0, 'flip', 1, 0)
        L.top1.show(false)
        if (instant) {
          rs.forEach((r, k) => ringTo(k, 'y', HOME[k], 0))
          ringTo(0, 'flip', 0, 0)
          L.top1.show(true)
        } else
          seq.run([
            [0.3, () => ringTo(2, 'y', HOME[2], 0.9)],
            [1.3, () => ringTo(1, 'y', HOME[1], 0.9)],
            [2.4, () => {
              ringTo(0, 'flip', 0, 0.8)
            }],
            [3.2, () => L.top1.show(true)],
            [3.4, () => ringTo(0, 'y', HOME[0], 0.9)],
          ])
      } else if (i === 2) {
        rs.forEach((r, k) => {
          ringTo(k, 'y', HOME[k], d)
          ringTo(k, 'flip', 0, d)
          ringTo(k, 'a', 0, instant ? 0 : 0.6)
        })
        const bad = () => L.gaps.set('Замки в линию — газы прорвутся').tone('warn')
        const good = () => L.gaps.set('Замки разведены').tone('ok')
        if (instant) {
          rs.forEach((r, k) => ringTo(k, 'a', STAG[k], 0))
          good()
        } else {
          bad()
          seq.run([[1.8, () => rs.forEach((r, k) => ringTo(k, 'a', STAG[k], 1.4))], [3.2, good]])
        }
      } else if (i === 3) {
        to(st, 'feelerY', 3.4, 0)
        if (instant) to(st, 'feelerY', 1.9 - 0.65, 0)
        else seq.run([[0.6, () => to(st, 'feelerY', 1.9 - 0.65, 1.4)]])
      } else if (i === 4) {
        rs.forEach((r, k) => {
          ringTo(k, 'y', HOME[k], 0)
          ringTo(k, 'flip', 0, 0)
          ringTo(k, 'a', STAG[k], 0)
        })
        const startY = LINER_TOP + 0.3 - (Y1 + Y3) / 2
        to(st, 'py', startY, 0)
        seq.run(
          [
            [0.8, () => to(st, 'push', 1, 0)],
            [0.9, () => to(st, 'py', 0.3, 3.0)],
            [3.9, () => to(st, 'push', 0, 0)],
            [5.2, () => to(st, 'py', startY, 0.8)],
          ],
          6.4,
        )
        L.push.show(true)
      }
      const [bx, dir] = VIEWS[i]
      fitBox(stage, bx, dir, { pad: 1.12, ms: instant ? 0 : 900 })
      if (instant) stage.setHome()
    }

    stage.onFrame(() => L.push.show(st.push > 0.5))

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
