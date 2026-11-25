// Штангенциркуль ШЦ-I (нониус 0,1 мм): устройство, ноль, наружный замер, чтение шкал,
// внутренний замер, глубина, типичные ошибки. Шкалы — canvas-текстуры (читаются при увеличении).
// Масштаб: 1 ед. = 10 мм. Измерительная грань неподвижной губки — x = 0, подвижной — x = s.
import { createStage, animator, THREE, PALETTE, ringY } from '../stage.js'

const STEPS = [
  { title: 'Устройство', text: 'Штанга с основной шкалой в миллиметрах. По ней ездит рамка с нониусом — короткой шкалой для долей миллиметра. Нижние губки — для наружных размеров, верхние — для отверстий, сзади выдвигается глубиномер.' },
  { title: 'Ноль, затем замер', text: 'Протрите губки и сведите их: ноль нониуса должен совпасть с нулём штанги. Затем разведите губки, поставьте деталь и сведите губки — без перекоса и без нажима.' },
  { title: 'Как прочитать', text: 'Целые мм: сколько делений штанги прошёл ноль нониуса — 24. Доли: какая черта нониуса совпала с чертой штанги — шестая, это 0,6 мм. Итого 24 + 0,6 = 24,6 мм.' },
  { title: 'Отверстие', text: 'Верхние губки вводят в отверстие и разводят до касания стенок. Читают так же. Чтобы найти диаметр, а не хорду, губки ставят через центр — по наибольшему показанию.' },
  { title: 'Глубина', text: 'Торец штанги упирают в край детали, глубиномер выдвигают до дна. Показание читают по тем же шкалам. Штангу держат ровно, без наклона.' },
  { title: 'Типичные ошибки', text: 'Перекос: губки легли наискось — показание больше настоящего. Сильный нажим: губки и деталь пружинят — показание неверное. Ещё ошибки: не проверили ноль, смотрите на шкалу сбоку (читайте прямо).' },
]

const VX = 0.6 // ноль основной шкалы на штанге (и ноль нониуса на рамке при s = 0)
const BEAM_END = 16.5

function canvasTex(stage, w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = stage.renderer.capabilities.getMaxAnisotropy()
  return t
}
const extrudeXY = (pts, z0, z1) => {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))
  return new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false }).translate(0, 0, z0)
}
const box = (x0, x1, y0, y1, z0, z1) =>
  new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)

export default {
  title: 'Штангенциркуль',
  animated: false,
  steps: STEPS,
  mount(host) {
    const C = PALETTE
    const WHOLE = new THREE.Box3(new THREE.Vector3(-1.2, -4.3, -0.5), new THREE.Vector3(17, 4, 0.5))
    const JAWS = new THREE.Box3(new THREE.Vector3(-1.2, -4.3, -0.5), new THREE.Vector3(6, 4, 0.5))
    const stage = createStage(host, { position: [3, 3, 20], target: [8, 0, 0], fov: 30, fit: WHOLE, pad: 1.0 })
    const to = animator(stage)
    const { root } = stage
    const timers = []
    const later = (fn, ms) => timers.push(setTimeout(fn, ms))
    const clearTimers = () => timers.splice(0).forEach(clearTimeout)
    const texs = []
    const basic = (map) => new THREE.MeshBasicMaterial({ map, toneMapped: false, transparent: true })

    // поворотная «рука»: turn (мировая точка) → inner (сдвиг на локальную точку)
    const turn = new THREE.Group()
    const cal = new THREE.Group()
    turn.add(cal)
    root.add(turn)

    // ---------- штанга и неподвижные губки
    const steelM = stage.mat('steel')
    cal.add(new THREE.Mesh(box(-0.9, BEAM_END, 0, 1.6, -0.17, 0.17), steelM))
    cal.add(new THREE.Mesh(extrudeXY([[0, 0.01], [0, -3.85], [-0.15, -4.1], [-0.45, -3.6], [-0.9, -0.1], [-0.9, 0.01]], -0.17, 0.17), steelM))
    cal.add(new THREE.Mesh(extrudeXY([[-0.9, 1.59], [0.32, 1.59], [0.32, 3.35], [0.05, 3.7], [0, 3.55], [0, 2.4], [-0.9, 1.9]], 0, 0.17), steelM))

    // основная шкала: мм от −3 до 128, цифры — сантиметры
    const MM0 = -3, MM1 = 128, PPM = 24
    const mainTex = canvasTex(stage, (MM1 - MM0) * PPM, 168, (g, w, h) => {
      g.fillStyle = C.milk
      g.fillRect(0, 0, w, h)
      g.fillStyle = C.graphite
      g.textAlign = 'center'
      g.font = 'bold 56px Arial, sans-serif'
      for (let mm = 0; mm <= 125; mm++) {
        const x = (mm - MM0) * PPM
        const L = mm % 10 === 0 ? 92 : mm % 5 === 0 ? 66 : 44
        g.fillRect(x - 1.5, h - L, 3, L)
        if (mm % 10 === 0) g.fillText(String(mm / 10), x, 54)
      }
      g.font = '600 30px Arial, sans-serif'
      g.fillText('мм', (126.5 - MM0) * PPM, 120)
    })
    texs.push(mainTex)
    const mainScale = new THREE.Mesh(new THREE.PlaneGeometry((MM1 - MM0) / 10, 0.7), basic(mainTex))
    mainScale.position.set(VX + (MM0 + MM1) / 20, 1.2, 0.172)
    cal.add(mainScale)

    // ---------- рамка (двигается на s)
    const frame = new THREE.Group()
    const frameM = stage.mat('steelDark')
    frame.add(new THREE.Mesh(box(0, 3.4, -0.35, 1.85, -0.3, -0.17), frameM))
    frame.add(new THREE.Mesh(box(0, 3.4, -0.35, 0, -0.3, 0.26), frameM))
    frame.add(new THREE.Mesh(box(0, 3.4, 1.6, 1.85, -0.3, 0.26), frameM))
    frame.add(new THREE.Mesh(box(0, 3.4, 0, 0.82, 0.17, 0.26), frameM))
    frame.add(new THREE.Mesh(extrudeXY([[0, -0.3], [1.0, -0.3], [0.45, -3.6], [0.15, -4.1], [0, -3.85]], -0.17, 0.17), steelM))
    frame.add(new THREE.Mesh(extrudeXY([[0.8, 1.8], [0.8, 2.1], [0, 2.4], [0, 3.55], [-0.05, 3.7], [-0.32, 3.35], [-0.32, 1.8]], -0.17, 0), steelM))
    // винт-фиксатор
    const screw = new THREE.Group()
    screw.add(stage.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16), 'steel'))
    const knob = stage.mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 18), 'steelBlack')
    knob.position.y = 0.18
    screw.add(knob)
    screw.position.set(2.3, 1.95, 0)
    frame.add(screw)
    // глубиномер: узкая линейка в пазу штанги, кончик на BEAM_END + s
    frame.add(new THREE.Mesh(box(1.2, BEAM_END, 0.74, 0.86, -0.08, -0.02), steelM))
    // нониус: 10 делений на 9 мм, цена 0,1 мм
    const V0 = -2.5, V1 = 11.5, VPM = 48
    const vTex = canvasTex(stage, (V1 - V0) * VPM, 192, (g, w, h) => {
      g.fillStyle = C.milk
      g.fillRect(0, 0, w, h)
      g.fillStyle = C.graphite
      g.textAlign = 'center'
      g.font = 'bold 50px Arial, sans-serif'
      for (let k = 0; k <= 10; k++) {
        const x = (k * 0.9 - V0) * VPM
        const L = k % 5 === 0 ? 84 : 56
        g.fillRect(x - 2.5, 0, 5, L)
        if (k % 5 === 0) g.fillText(String(k), x, 140)
      }
      g.font = '600 34px Arial, sans-serif'
      g.fillText('0,1', (10.6 - V0) * VPM, 182)
    })
    texs.push(vTex)
    const vernier = new THREE.Mesh(new THREE.PlaneGeometry((V1 - V0) / 10, 0.4), basic(vTex))
    vernier.position.set(VX + (V0 + V1) / 20, 0.62, 0.262)
    frame.add(vernier)
    cal.add(frame)

    // подсветка черт при чтении
    const hlMat = new THREE.MeshBasicMaterial({ color: C.mark, toneMapped: false, transparent: true, opacity: 0.95 })
    const okMat = new THREE.MeshBasicMaterial({ color: C.ok, toneMapped: false, transparent: true, opacity: 0.95 })
    const hlMain = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.4), hlMat)
    hlMain.position.set(VX + 2.4, 1.05, 0.176)
    const hlPair = new THREE.Group()
    const pMain = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.35), okMat)
    pMain.position.set(VX + 3.0, 1.03, 0.176)
    const pVer = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.3), okMat)
    pVer.position.set(VX + 0.54, 0.67, 0.265)
    hlPair.add(pMain)
    frame.add(pVer)
    cal.add(hlMain, hlPair)

    // ---------- детали
    const partMat = stage.mat('iron')
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.23, 1.23, 1.4, 64), partMat)
    shaft.position.set(1.23, -2.3, 0)
    root.add(shaft)
    const ring = new THREE.Mesh(ringY(0.92, 1.25, 0.6, 64).rotateX(Math.PI / 2), partMat)
    ring.position.set(0.92, 3.0, 0)
    root.add(ring)
    // блок с глухим отверстием (глубина 12,5 мм), разрезан пополам, чтобы видеть глубиномер
    const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
    const block = new THREE.Group()
    const bs = new THREE.Shape()
    bs.moveTo(-1, -0.8).lineTo(1, -0.8).lineTo(1, 2.4).lineTo(-1, 2.4).closePath()
    const bh = new THREE.Path()
    bh.absarc(0, 0.8, 0.26, 0, Math.PI * 2, true)
    bs.holes.push(bh)
    const bGeos = [
      new THREE.ExtrudeGeometry(bs, { depth: 1.25, bevelEnabled: false, curveSegments: 32 }).rotateY(Math.PI / 2).translate(BEAM_END, 0, 0),
      box(BEAM_END + 1.25, BEAM_END + 2.2, -0.8, 2.4, -1, 1),
    ]
    const secMat = new THREE.MeshBasicMaterial({ color: C.section, side: THREE.BackSide, clippingPlanes: [cut], toneMapped: false })
    const blockMat = stage.mat('iron', { clippingPlanes: [cut] })
    for (const g of bGeos) block.add(new THREE.Mesh(g, blockMat), new THREE.Mesh(g, secMat))
    root.add(block)

    // стрелка «нажим»
    const push = stage.arrow(new THREE.Vector3(5.0, -1.3, 0.3), new THREE.Vector3(3.7, -1.3, 0.3), C.bad, { head: 0.35, width: 0.28 })
    frame.add(push)

    // ---------- подписи
    const P = {
      beam: stage.label('Штанга со шкалой, мм', new THREE.Vector3(12.5, 1.6, 0.17), { side: 'top' }),
      vern: stage.label('Нониус', vernier, { offset: [-0.4, -0.2, 0], side: 'bottom' }),
      outer: stage.label('Губки: наружный размер', new THREE.Vector3(-0.2, -3.6, 0), { side: 'left' }),
      inner: stage.label('Губки: отверстие', new THREE.Vector3(0, 3.6, 0), { side: 'top' }),
      screw: stage.label('Винт-фиксатор', screw, { offset: [0, 0.3, 0], side: 'right' }),
      depth: stage.label('Глубиномер', new THREE.Vector3(BEAM_END + 0.6, 0.8, 0), { side: 'bottom' }),
    }
    const R = {
      val: stage.label('', new THREE.Vector3(0, 0, 0), { side: 'right', tone: 'big' }),
      mm: stage.label('24 мм', new THREE.Vector3(VX + 2.4, 1.55, 0.18), { side: 'top', tone: 'accent' }),
      line: stage.label('черта 6 → 0,6 мм', pVer, { offset: [0, -0.15, 0], side: 'bottom', tone: 'ok' }),
      zero: stage.label('0 = 0', vernier, { offset: [-0.4, -0.2, 0], side: 'bottom', tone: 'ok' }),
      warn: stage.label('', new THREE.Vector3(0, 0, 0), { side: 'left', tone: 'warn' }),
    }
    const valAt = (text, v, side = 'right') => {
      R.val.anchor = v
      R.val.el.className = `l3d-tag big ${side}`
      R.val.set(text).show(true)
    }

    // ---------- состояние и поза
    const st = { s: 4, a: 0, pwx: 1.23, pwy: -2.3, plx: 1.23, ply: -2.3 }
    stage.onFrame(() => {
      frame.position.x = st.s
      turn.position.set(st.pwx, st.pwy, 0)
      turn.rotation.z = st.a
      cal.position.set(-st.plx, -st.ply, 0)
    })

    let cur = { box: WHOLE, dir: [0.12, 0.2, 1] }
    const view = (b, dir, ms) => {
      cur = { box: b, dir }
      stage.fit(b, { dir, pad: 1.03, ms })
    }
    const SCALE_BOX = (x0, x1) => new THREE.Box3(new THREE.Vector3(x0, 0.2, 0.2), new THREE.Vector3(x1, 1.7, 0.3))
    const pose = (p, k) => {
      for (const key of ['a', 'pwx', 'pwy', 'plx', 'ply']) to(st, key, p[key], 1.2 * k)
    }
    const NORMAL = { a: 0, pwx: 1.23, pwy: -2.3, plx: 1.23, ply: -2.3 }

    const apply = (i, instant) => {
      clearTimers()
      const k = instant ? 0 : 1
      const ms = instant ? 0 : 1000
      Object.values(P).forEach((l) => l.show(i === 0))
      Object.values(R).forEach((l) => l.show(false))
      shaft.visible = i === 1 || i === 2 || i === 5
      ring.visible = i === 3
      block.visible = i === 4
      hlMain.visible = i === 2
      hlPair.visible = i === 2
      pVer.visible = i === 2
      push.visible = i === 5
      if (i !== 4 && i !== 5) pose(NORMAL, k)

      if (i === 0) {
        to(st, 's', 4, 0.9 * k)
        view(WHOLE, [0.12, 0.2, 1], ms)
      } else if (i === 1) {
        if (instant) {
          st.s = 2.46
          valAt('24,6 мм', new THREE.Vector3(2.7, -2.3, 0))
          view(JAWS, [0.25, 0.15, 1], 0)
        } else {
          shaft.visible = false
          to(st, 's', 0, 1.0)
          view(SCALE_BOX(-0.6, 2.6), [0.05, 0.1, 1], 1000)
          later(() => R.zero.show(true), 1100)
          later(() => {
            R.zero.show(false)
            to(st, 's', 3.4, 1.0)
            view(JAWS, [0.25, 0.15, 1], 1000)
          }, 2600)
          later(() => {
            shaft.visible = true
            to(st, 's', 2.46, 1.0)
          }, 3700)
          later(() => valAt('24,6 мм', new THREE.Vector3(2.7, -2.3, 0)), 4800)
        }
      } else if (i === 2) {
        to(st, 's', 2.46, 0.6 * k)
        view(SCALE_BOX(VX + 1.4, VX + 4.3), [0.04, 0.12, 1], ms)
        R.mm.show(true)
        R.line.show(true)
        valAt('24 + 0,6 = 24,6 мм', new THREE.Vector3(VX + 4.1, 0.25, 0.3), 'bottom')
      } else if (i === 3) {
        to(st, 's', 1.84, 1.0 * k)
        view(new THREE.Box3(new THREE.Vector3(-1.4, -0.4, -0.5), new THREE.Vector3(4.4, 4.6, 0.5)), [0.2, 0.15, 1], ms)
        if (instant) valAt('18,4 мм', new THREE.Vector3(2.2, 3.0, 0))
        else later(() => valAt('18,4 мм', new THREE.Vector3(2.2, 3.0, 0)), 1100)
      } else if (i === 4) {
        // штанга вертикально, торцом на блок; глубиномер до дна отверстия
        const D = { a: -Math.PI / 2, pwx: BEAM_END, pwy: 0.8, plx: BEAM_END, ply: 0.8 }
        to(st, 's', 0.4, 0.5 * k)
        pose(D, k)
        if (!instant) later(() => to(st, 's', 1.25, 1.2), 1300)
        else st.s = 1.25
        const b = new THREE.Box3(new THREE.Vector3(BEAM_END - 3.2, -2.4, -1), new THREE.Vector3(BEAM_END + 3.2, 4.2, 1))
        view(b, [0.45, 0.2, 1], ms)
        const show = () => valAt('12,5 мм', new THREE.Vector3(BEAM_END + 1.1, -0.1, 0))
        if (instant) show()
        else later(show, 2600)
      } else if (i === 5) {
        // перекос 8°: губки касаются рёбер детали — показание больше диаметра
        const th = (8 * Math.PI) / 180
        const sTilt = 2.46 * Math.cos(th) + 1.4 * Math.sin(th)
        to(st, 's', sTilt, 1.0 * k)
        pose({ a: th, pwx: 1.23, pwy: -2.3, plx: sTilt / 2, ply: -2.3 }, k)
        view(new THREE.Box3(new THREE.Vector3(-2, -4.6, -0.5), new THREE.Vector3(6.5, 3, 0.5)), [0.2, 0.12, 1], ms)
        const show = () => {
          R.warn.anchor = new THREE.Vector3(-0.6, -2.3, 0)
          R.warn.set(`Перекос: ${(sTilt * 10).toFixed(1).replace('.', ',')} вместо 24,6`).show(true)
          valAt('Нажим — нельзя', new THREE.Vector3(4.9, -1.0, 0.3), 'top')
          R.val.el.className = 'l3d-tag warn top'
        }
        if (instant) show()
        else later(show, 1200)
      }
    }

    stage.ready()
    return stage.controller({
      setStep: (i, o) => apply(i, o?.instant),
      resetView: () => stage.fit(cur.box, { dir: cur.dir, pad: 1.03, ms: 700 }),
      dispose() {
        clearTimers()
        texs.forEach((t) => t.dispose())
      },
    })
  },
}
