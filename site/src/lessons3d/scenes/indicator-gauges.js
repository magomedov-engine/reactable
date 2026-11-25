// Индикатор часового типа на магнитной стойке (биение вала), индикаторный нутромер в гильзе
// (качание, минимум, 2 направления × 3 высоты), набор щупов и проверка зазора клапана.
// Циферблаты — canvas-текстуры. Зазоры и толщины щупов показаны в сильно увеличенном масштабе.
import { createStage, animator, THREE, PALETTE, cylY, ringY } from '../stage.js'

const STEPS = [
  { title: 'Индикатор на стойке', text: 'Индикатор закрепляют на магнитной стойке, наконечник ставят на деталь с небольшим натягом. Затем поворачивают ободок, чтобы «0» встал под стрелку.' },
  { title: 'Биение вала', text: 'Вал медленно поворачивают. Индикатор показывает не размер, а насколько сместился наконечник. Размах стрелки — это биение. Например, от −3 до +3 делений: 0,06 мм (пример).' },
  { title: 'Нутромер: ищем минимум', text: 'Нутромер ставят на ноль по кольцу или микрометру, вводят в отверстие и покачивают. Стрелка доходит до крайней точки и «разворачивается» — это минимум, по нему и читают диаметр.' },
  { title: 'Нутромер: 2 направления, 3 высоты', text: 'Одного замера мало: отверстие может быть овальным или конусным. Мерят в двух направлениях крест-накрест и на трёх высотах — вверху, в середине, внизу.' },
  { title: 'Щупы', text: 'Щуп — набор тонких пластин. Толщина в миллиметрах выбита на каждой: 0,05; 0,10; 0,20… Пластины можно складывать, чтобы получить нужную толщину.' },
  { title: 'Щуп в зазоре', text: 'Пример — зазор клапана (масштаб сильно увеличен). Толстая пластина не входит. Нужная проходит с лёгким протягиванием. Идёт свободно — зазор больше.' },
]

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

export default {
  title: 'Индикатор, нутромер и щуп',
  animated: true,
  steps: STEPS,
  mount(host) {
    const C = PALETTE
    const BOX_A = new THREE.Box3(new THREE.Vector3(-4.3, -1.9, -3.2), new THREE.Vector3(4.3, 4.4, 1.5))
    const stage = createStage(host, { position: [5, 4, 11], target: [0, 1, 0], fov: 30, fit: BOX_A, pad: 1.0 })
    const to = animator(stage)
    const { root } = stage
    const timers = []
    const later = (fn, ms) => timers.push(setTimeout(fn, ms))
    const clearTimers = () => timers.splice(0).forEach(clearTimeout)
    const texs = []

    // ---------- циферблат индикатора (общие текстуры для двух индикаторов)
    const scaleTex = canvasTex(stage, 1024, 1024, (g, w) => {
      const c = w / 2
      g.fillStyle = C.milk
      g.beginPath()
      g.arc(c, c, 510, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = C.graphite
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = 'bold 64px Arial, sans-serif'
      for (let k = 0; k < 100; k++) {
        const a = (k / 100) * Math.PI * 2
        const L = k % 10 === 0 ? 92 : k % 5 === 0 ? 70 : 48
        g.save()
        g.translate(c, c)
        g.rotate(a)
        g.fillRect(-3, -500, 6, L)
        g.restore()
        if (k % 10 === 0) g.fillText(String(k), c + 360 * Math.sin(a), c - 360 * Math.cos(a))
      }
    })
    const faceTex = canvasTex(stage, 512, 512, (g, w) => {
      const c = w / 2
      g.fillStyle = C.milk
      g.fillRect(0, 0, w, w)
      g.fillStyle = C.graphite
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = '600 38px Arial, sans-serif'
      g.fillText('0,01 мм', c, 130)
      // счётчик оборотов (целые мм)
      const sy = 330
      g.strokeStyle = C.graphite
      g.lineWidth = 4
      g.beginPath()
      g.arc(c, sy, 118, 0, Math.PI * 2)
      g.stroke()
      g.font = 'bold 34px Arial, sans-serif'
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2
        g.save()
        g.translate(c, sy)
        g.rotate(a)
        g.fillRect(-2.5, -118, 5, 24)
        g.restore()
        if (k % 2 === 0) g.fillText(String(k), c + 70 * Math.sin(a), sy - 70 * Math.cos(a))
      }
    })
    texs.push(scaleTex, faceTex)
    const scaleMat = new THREE.MeshBasicMaterial({ map: scaleTex, toneMapped: false })
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, toneMapped: false })
    const needleMat = new THREE.MeshBasicMaterial({ color: C.mark, toneMapped: false })
    const capMat = new THREE.MeshBasicMaterial({ color: C.graphite, toneMapped: false })
    function makeDial() {
      const d = new THREE.Group()
      d.add(stage.mesh(cylY(1.05, 0.45, 48).rotateX(Math.PI / 2), 'chrome'))
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.95, 96), scaleMat)
      ring.position.z = 0.228
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.5, 64), faceMat)
      face.position.z = 0.229
      const big = new THREE.Group()
      const bn = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.98).translate(0, 0.33, 0), needleMat)
      big.add(bn, new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), capMat))
      big.position.z = 0.24
      const small = new THREE.Group()
      small.add(new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.2).translate(0, 0.08, 0), needleMat))
      small.position.set(0, -0.145, 0.235)
      d.add(ring, face, big, small)
      const stem = stage.mesh(cylY(0.13, 0.6).translate(0, -1.25, 0), 'chrome')
      const plunger = new THREE.Group()
      plunger.add(stage.mesh(cylY(0.06, 0.65).translate(0, -1.85, 0), 'chrome'))
      const tip = stage.mesh(new THREE.SphereGeometry(0.1, 16, 12), 'steelBlack')
      tip.position.y = -2.15
      plunger.add(tip)
      d.add(stem, plunger)
      d.userData = { ring, big, small, plunger }
      // reading — смещение наконечника, мм; zero — где стоит «0» ободка, мм
      d.set = (reading, zero) => {
        big.rotation.z = -2 * Math.PI * reading
        small.rotation.z = (-2 * Math.PI * reading) / 10
        ring.rotation.z = -2 * Math.PI * zero
      }
      return d
    }

    // ================= A: индикатор на магнитной стойке, вал в призмах
    const A = new THREE.Group()
    const plate = stage.mesh(new THREE.BoxGeometry(9, 0.3, 5.5), 'ironDark')
    plate.position.set(0, -1.75, -0.6)
    A.add(plate)
    const vs = new THREE.Shape()
    vs.moveTo(-1.8, -1.6).lineTo(1.8, -1.6).lineTo(1.8, 0.2).lineTo(1.614, 0.2).lineTo(0, -1.414).lineTo(-1.614, 0.2).lineTo(-1.8, 0.2).closePath()
    const vGeo = new THREE.ExtrudeGeometry(vs, { depth: 1.0, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2)
    for (const x of [-2.8, 2.8]) {
      const v = stage.mesh(vGeo, 'iron')
      v.position.x = x
      A.add(v)
    }
    const shaft = new THREE.Group()
    shaft.add(stage.mesh(new THREE.CylinderGeometry(1, 1, 8, 64).rotateZ(Math.PI / 2), 'chrome'))
    const mark = stage.mesh(new THREE.BoxGeometry(0.04, 0.9, 0.12), 'mark')
    mark.position.set(4.01, 0.45, 0)
    shaft.add(mark)
    A.add(shaft)
    // стойка
    const base = stage.mesh(new THREE.BoxGeometry(1.5, 1.1, 1.3), 'steelBlack')
    base.position.set(0, -1.05, -2.6)
    const knob = stage.mesh(cylY(0.18, 0.3, 16).rotateZ(Math.PI / 2), 'mark')
    knob.position.set(0.85, -1.0, -2.6)
    const post = stage.mesh(cylY(0.12, 4.4), 'chrome')
    post.position.set(0, 1.7, -2.6)
    const arm = stage.mesh(new THREE.BoxGeometry(0.2, 0.2, 2.8), 'chrome')
    arm.position.set(0, 1.95, -1.3)
    const clamp = stage.mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), 'steelBlack')
    clamp.position.set(0, 1.95, -2.6)
    const clamp2 = stage.mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), 'steelBlack')
    clamp2.position.set(0, 1.95, 0)
    A.add(base, knob, post, arm, clamp, clamp2)
    const dialA = makeDial()
    dialA.position.set(0, 3.25, 0)
    A.add(dialA)
    root.add(A)

    // ================= B: нутромер в гильзе (гильза разрезана пополам)
    const BX = 14
    const B = new THREE.Group()
    B.position.x = BX
    const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
    const liner = new THREE.Group()
    const lGeo = ringY(2.0, 2.45, 5, 72)
    liner.add(new THREE.Mesh(lGeo, stage.mat('iron', { clippingPlanes: [cut] })))
    liner.add(new THREE.Mesh(lGeo, new THREE.MeshBasicMaterial({ color: C.section, side: THREE.BackSide, clippingPlanes: [cut], toneMapped: false })))
    B.add(liner)
    const gauge = new THREE.Group()
    const head = stage.mesh(new THREE.BoxGeometry(0.6, 0.34, 0.34), 'steelBlack')
    const anvil = stage.mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 12).rotateZ(Math.PI / 2).translate(-0.5, 0, 0), 'chrome')
    const rod = stage.mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 12).rotateZ(Math.PI / 2).translate(0.5, 0, 0), 'chrome')
    const tipL = stage.mesh(new THREE.SphereGeometry(0.1, 12, 10), 'steel')
    const tipR = stage.mesh(new THREE.SphereGeometry(0.1, 12, 10), 'steel')
    const tube = stage.mesh(cylY(0.12, 5.4).translate(0, 2.8, 0), 'chrome')
    const grip = stage.mesh(cylY(0.24, 1.6).translate(0, 4.3, 0), 'rubber')
    const dialB = makeDial()
    dialB.position.y = 6.95
    dialB.userData.plunger.visible = false
    gauge.add(head, anvil, rod, tipL, tipR, tube, grip, dialB)
    B.add(gauge)
    // хорды замеров: 3 высоты × 2 направления
    const chordMat = new THREE.MeshBasicMaterial({ color: C.ok, toneMapped: false })
    const chords = []
    for (const h of [1.6, 0, -1.6])
      for (const dir of [0, 1]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 4, 8).rotateZ(Math.PI / 2), chordMat)
        m.position.y = h
        m.rotation.y = dir ? Math.PI / 2 : 0
        m.visible = false
        chords.push({ m, h, dir })
        B.add(m)
      }
    root.add(B)

    // ================= C: набор щупов веером
    const CX = 28
    const Cg = new THREE.Group()
    Cg.position.x = CX
    const THK = ['0,05', '0,10', '0,20', '0,30', '0,40']
    const bShape = new THREE.Shape()
    bShape.moveTo(0, -0.3).lineTo(4.9, -0.2).quadraticCurveTo(5.25, 0, 4.9, 0.2).lineTo(0, 0.3).quadraticCurveTo(-0.32, 0, 0, -0.3)
    const blades = THK.map((txt, j) => {
      const t = 0.02 + parseFloat(txt.replace(',', '.')) * 0.15
      const g = new THREE.Group()
      g.add(stage.mesh(new THREE.ExtrudeGeometry(bShape, { depth: t, bevelEnabled: false, curveSegments: 8 }), 'steel'))
      const tex = canvasTex(stage, 256, 64, (c, w, h) => {
        c.fillStyle = C.graphite
        c.font = 'bold 46px Arial, sans-serif'
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        c.fillText(txt, w / 2, h / 2 + 2)
      })
      texs.push(tex)
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }))
      lbl.position.set(3.6, 0, t + 0.002)
      g.add(lbl)
      g.position.z = j * 0.1
      Cg.add(g)
      return g
    })
    const hub = stage.mesh(cylY(0.22, 0.75, 20).rotateX(Math.PI / 2).translate(0, 0, 0.25), 'steelBlack')
    const cheek = stage.mesh(new THREE.BoxGeometry(1.6, 0.66, 0.06), 'steelDark')
    cheek.position.set(0.5, 0, -0.06)
    Cg.add(hub, cheek)
    root.add(Cg)

    // ================= D: зазор клапана, пластина щупа (масштаб увеличен)
    const DX = 38
    const D = new THREE.Group()
    D.position.x = DX
    const GAP = 0.2
    D.add(stage.mesh(cylY(0.22, 3.2).translate(0, -1.6, 0), 'chrome'))
    const helix = new THREE.Curve()
    helix.getPoint = (u, out = new THREE.Vector3()) => out.set(0.55 * Math.cos(u * Math.PI * 12), -2.7 + u * 2.0, 0.55 * Math.sin(u * Math.PI * 12))
    D.add(stage.mesh(new THREE.TubeGeometry(helix, 180, 0.06, 6, false), 'steelDark'))
    const cap = stage.mesh(ringY(0.22, 0.75, 0.15, 32), 'steel')
    cap.position.y = -0.62
    D.add(cap)
    const rocker = stage.mesh(new THREE.BoxGeometry(4.2, 0.5, 0.6), 'iron')
    rocker.position.set(-1.6, 1.55, 0)
    D.add(rocker)
    const screwD = stage.mesh(cylY(0.17, 1.6).translate(0, GAP + 0.8, 0), 'steel')
    const nut = stage.mesh(cylY(0.32, 0.25, 6).translate(0, 2.0, 0), 'steelBlack')
    D.add(screwD, nut)
    const probe = new THREE.Group()
    const probeMat = stage.mat('steel', { emissive: new THREE.Color(C.bad), emissiveIntensity: 0 })
    const probeBlade = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 0.5).translate(2, 0.5, 0), probeMat)
    probe.add(probeBlade)
    D.add(probe)
    root.add(D)

    // ---------- подписи
    const LA = [
      stage.label('Магнитная стойка', base, { offset: [0, -0.55, 0], side: 'bottom' }),
      stage.label('Индикатор', dialA, { offset: [1.05, 0.4, 0], side: 'right' }),
      stage.label('Вал в призмах', new THREE.Vector3(-3.4, 0.9, 0), { side: 'top' }),
    ]
    const lZero = stage.label('«0» под стрелку', dialA, { offset: [-1.05, 0.5, 0.2], side: 'left', tone: 'ok' })
    const lRun = stage.label('Размах стрелки = биение', dialA, { offset: [-1.05, 0, 0.2], side: 'left', tone: 'accent' })
    const lLiner = stage.label('Гильза (разрез)', new THREE.Vector3(BX - 2.2, 2.5, 0), { side: 'left' })
    const lMin = stage.label('Минимум → диаметр', dialB, { offset: [1.05, 0, 0], side: 'right', tone: 'ok' })
    const lRock = stage.label('Покачать', new THREE.Vector3(BX - 1.2, 6.95, 0), { side: 'left' })
    const lSet = stage.label('Толщина — на пластине, мм', new THREE.Vector3(CX + 3, 2.6, 0), { side: 'top' })
    const lProbe = stage.label('', probe, { offset: [3.2, 0.6, 0.25], side: 'top' })
    const lGap = stage.label('зазор', new THREE.Vector3(DX - 0.3, GAP / 2, 0.3), { side: 'left' })

    // ---------- состояние
    const st = { zeroA: 0.5, runout: 0, rock: 0, h: 0, dirB: 0, fan: 0, px: 5.5, pt: 0.3, drag: 0 }
    let spin = 0, rockT = 0
    stage.onFrame((dt) => {
      if (stage.playing) {
        spin += dt * 1.1 * st.runout
        rockT += dt * st.rock
      }
      shaft.rotation.x = spin
      // натяг 0,5 мм + биение 0,03 мм (размах 0,06)
      dialA.set(0.5 + 0.03 * Math.cos(spin) * st.runout, st.zeroA)
      // нутромер: качание, длина головки = D / cos θ
      const th = 0.22 * Math.sin(rockT * 1.6) * Math.min(1, st.rock)
      gauge.position.y = st.h
      gauge.rotation.set(0, st.dirB, th)
      const half = 2.0 / Math.cos(th)
      anvil.scale.x = half - 0.3
      anvil.position.x = -0.3 // неподвижный наконечник слева, подвижный стержень справа
      tipL.position.x = -half + 0.08
      tipR.position.x = half - 0.08
      rod.scale.x = half - 0.3
      rod.position.x = 0.3
      lMin.show(st.rock > 0.5 && Math.abs(th) < 0.035 && B.visible)
      const extra = (1 / Math.cos(th) - 1) / (1 / Math.cos(0.22) - 1)
      dialB.set(0.3 + 0.4 * extra, 0.3)
      blades.forEach((b, j) => (b.rotation.z = st.fan * (0.62 - j * 0.3)))
      probe.position.set(st.px + Math.sin(rockT * 5) * 0.12 * st.drag, 0, 0)
      probe.scale.y = st.pt
      probe.visible = D.visible
    })

    let cur = { box: BOX_A, dir: [0.45, 0.35, 1] }
    const view = (b, dir, ms) => {
      cur = { box: b, dir }
      stage.fit(b, { dir, pad: 1.02, ms })
    }
    const boxAt = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1))
    const setProbe = (txt, t) => {
      st.pt = t
      lProbe.set(`пластина ${txt}`).tone('').show(true)
    }

    const apply = (i, instant) => {
      clearTimers()
      const k = instant ? 0 : 1
      const ms = instant ? 0 : 1100
      A.visible = i <= 1
      B.visible = i === 2 || i === 3
      Cg.visible = i === 4
      D.visible = i === 5
      LA.forEach((l) => l.show(i === 0))
      ;[lZero, lRun, lLiner, lRock, lSet, lProbe, lGap].forEach((l) => l.show(false))
      to(st, 'runout', i === 1 ? 1 : 0, 0.6 * k)
      chords.forEach((c) => (c.m.visible = false))
      to(probeMat, 'emissiveIntensity', 0, 0.01)
      st.drag = 0

      if (i === 0) {
        view(BOX_A, [0.45, 0.35, 1], ms)
        spin = 0
        if (instant) {
          st.zeroA = 0.5
          lZero.show(true)
        } else {
          st.zeroA = 0.12
          later(() => to(st, 'zeroA', 0.5, 1.4), 900)
          later(() => lZero.show(true), 2300)
        }
      } else if (i === 1) {
        st.zeroA = 0.5
        view(boxAt(-1.4, -0.6, -0.5, 1.4, 4.4, 1), [0.2, 0.1, 1], ms)
        lRun.show(true)
      } else if (i === 2) {
        st.rock = 0
        to(st, 'rock', 1, 0.8 * k)
        to(st, 'h', 0, 0.6 * k)
        to(st, 'dirB', 0, 0.6 * k)
        view(boxAt(BX - 2.6, -2.6, -2.5, BX + 2.6, 8.1, 0.5), [0.15, 0.25, 1], ms)
        lLiner.show(true)
        lRock.show(true)
      } else if (i === 3) {
        to(st, 'rock', 0.3, 0.5 * k)
        view(boxAt(BX - 2.6, -2.6, -2.5, BX + 2.6, 8.1, 2.5), [0.55, 0.45, 1], ms)
        lLiner.show(true)
        if (instant) chords.forEach((c) => (c.m.visible = true))
        else
          chords.forEach((c, n) =>
            later(() => {
              to(st, 'h', c.h, 0.5)
              to(st, 'dirB', c.dir ? Math.PI / 2 : 0, 0.5)
              later(() => (c.m.visible = true), 550)
            }, 300 + n * 1100),
          )
      } else if (i === 4) {
        st.fan = instant ? 1 : 0
        to(st, 'fan', 1, 1.3 * k)
        view(boxAt(CX - 1, -2.2, 0, CX + 5.6, 3.6, 0.5), [0.1, 0.15, 1], ms)
        later(() => lSet.show(true), instant ? 0 : 1000)
        if (instant) lSet.show(true)
      } else if (i === 5) {
        view(boxAt(DX - 3.8, -2.8, -0.5, DX + 5.5, 2.6, 0.5), [0.35, 0.3, 1], ms)
        lGap.show(true)
        const good = () => {
          setProbe('0,20', GAP)
          st.px = 4.5
          to(st, 'px', -0.5, 1.2)
          later(() => {
            st.drag = 1
            lProbe.set('0,20 — с лёгким усилием').tone('ok')
          }, 1250)
        }
        if (instant) {
          setProbe('0,20', GAP)
          st.px = -0.5
          st.drag = 1
          lProbe.set('0,20 — с лёгким усилием').tone('ok')
        } else {
          setProbe('0,30', 0.3)
          st.px = 4.5
          to(st, 'px', 0.25, 0.9)
          later(() => {
            to(probeMat, 'emissiveIntensity', 0.6, 0.3)
            lProbe.set('0,30 — не входит').tone('warn')
          }, 950)
          later(() => {
            to(probeMat, 'emissiveIntensity', 0, 0.3)
            to(st, 'px', 4.5, 0.7)
          }, 2300)
          later(good, 3100)
        }
      }
    }

    stage.ready()
    return stage.controller({
      setStep: (i, o) => apply(i, o?.instant),
      resetView: () => stage.fit(cur.box, { dir: cur.dir, pad: 1.02, ms: 700 }),
      dispose() {
        clearTimers()
        texs.forEach((t) => t.dispose())
      },
    })
  },
}
