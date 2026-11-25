// Турбокомпрессор в разрезе: газы крутят турбину, на том же валу компрессор качает воздух, подшипники работают на масле.
// Передняя половина корпусов срезана плоскостью (видно колёса и каналы).
import { createStage, animator, THREE, PALETTE, cylX, cylY, ringY, clamp01, ease } from '../stage.js'
import { polyPath, smoothPath, flow, stepClock } from './es-kit.js'

const STEPS = [
  { title: 'Из чего состоит', text: 'Два колеса на одном валу. Справа турбина в горячем корпусе, слева компрессор. Между ними корпус подшипников: вал крутится на масле. Корпуса показаны в разрезе.' },
  { title: 'Газы крутят турбину', text: 'Горячие выхлопные газы из коллектора закручиваются в «улитке», бьют в лопатки и раскручивают турбинное колесо, потом уходят в выпускную трубу.' },
  { title: 'Компрессор качает воздух', text: 'Вал общий, поэтому вместе с турбиной крутится компрессор. Он засасывает чистый воздух после фильтра, сжимает его и гонит в охладитель и дальше в цилиндры. Больше воздуха — больше мощности.' },
  { title: 'Масло: смазка и охлаждение', text: 'Масло приходит сверху по тонкой трубке, смазывает и охлаждает подшипники и стекает вниз по толстой трубе в картер — без перегибов. Подвод и слив не путать. Перед первым запуском — залить масло в подвод по ТК.' },
  { title: 'Ничего не должно попасть внутрь', text: 'Вал крутится очень быстро: шайба, гайка или крошка во впуске разобьёт колесо. Все отверстия под заглушками до самого монтажа, ветошь во впуске не оставлять. Вал пальцами «просто так» не крутить.' },
]

const VIEWS = [
  { p: [0.9, 3.0, 8.0], t: [0, 0.2, 0] },
  { p: [3.8, 2.6, 5.2], t: [1.6, 0.3, 0] },
  { p: [-3.6, 2.6, 5.2], t: [-1.6, 0.3, 0] },
  { p: [0.5, 0.9, 4.6], t: [0, -0.1, 0] },
  { p: [-1.2, 1.5, 7.6], t: [-0.5, 0.3, 0] },
]

export default {
  title: 'Турбокомпрессор в разрезе',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: VIEWS[0].p.map((x, j) => VIEWS[0].t[j] + (x - VIEWS[0].t[j]) * 1.4), target: VIEWS[0].t, fov: 30 })
    const to = animator(stage)
    const clock = stepClock(stage)
    const { root } = stage

    // разрез: оставляем заднюю половину (z < 0)
    const cut = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)]
    const cmat = (kind, over = {}) => stage.mat(kind, { clippingPlanes: cut, side: THREE.DoubleSide, ...over })
    const axX = (geo) => geo.rotateZ(-Math.PI / 2) // ось Y → ось X
    const latheX = (pts, seg = 40) => axX(new THREE.LatheGeometry(pts.map(([r, x]) => new THREE.Vector2(r, x)), seg))
    const torusX = (R, tube) => new THREE.TorusGeometry(R, tube, 16, 56).rotateY(Math.PI / 2)

    const hotMat = cmat('iron', { color: '#5e443d', metalness: 0.2, roughness: 0.75 })
    const aluMat = cmat('steel', { color: '#6c6964', metalness: 0.2, roughness: 0.7 })
    const bodyMat = cmat('ironDark')

    // ---- ротор: вал + два колеса
    const rotor = new THREE.Group()
    root.add(rotor)
    rotor.add(stage.mesh(cylX(0.07, 3.0, 16), 'chrome'))
    function wheel(x, dir, kind, over) {
      const w = new THREE.Group()
      const m = stage.mat(kind, over)
      w.add(new THREE.Mesh(cylX(0.62, 0.05, 40), m).translateX(-dir * 0.2))
      const hub = new THREE.Mesh(axX(new THREE.CylinderGeometry(0.1, 0.2, 0.42, 24)).rotateZ(dir > 0 ? 0 : Math.PI), m)
      w.add(hub)
      const N = 11
      for (let i = 0; i < N; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.03), m)
        const a = (i / N) * Math.PI * 2
        const g = new THREE.Group()
        b.position.set(0, 0.39, 0)
        b.rotation.y = 0.45 * dir
        g.add(b)
        g.rotation.x = a
        w.add(g)
      }
      w.position.x = x
      rotor.add(w)
      return w
    }
    const turbine = wheel(1.25, 1, 'steel', { color: '#c9b9aa' })
    const compressor = wheel(-1.25, -1, 'chrome', { color: '#ece7dc' })

    // ---- корпус подшипников и подшипники
    root.add(new THREE.Mesh(latheX([[0.1, -0.85], [0.5, -0.85], [0.56, -0.6], [0.56, 0.6], [0.5, 0.85], [0.1, 0.85], [0.1, -0.85]]), bodyMat))
    const brgMat = stage.mat('bronze', { emissive: PALETTE.oil, emissiveIntensity: 0 })
    const bearings = [-0.45, 0.45].map((x) => {
      const b = new THREE.Mesh(axX(ringY(0.075, 0.15, 0.22, 28)), brgMat)
      b.position.x = x
      root.add(b)
      return b
    })

    // ---- корпус турбины (горячий): улитка, обечайка колеса, выход
    const turbH = new THREE.Group()
    turbH.add(new THREE.Mesh(torusX(0.98, 0.36), hotMat).translateX(1.3))
    turbH.add(new THREE.Mesh(latheX([[0.64, 1.02], [0.64, 1.45], [0.46, 1.62], [0.46, 2.8]]), hotMat))
    const tIn = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.0, 24, 1, true), hotMat)
    tIn.position.set(1.3, 1.1, -0.98)
    turbH.add(tIn)
    root.add(turbH)

    // ---- корпус компрессора (алюминий)
    const compH = new THREE.Group()
    compH.add(new THREE.Mesh(torusX(0.98, 0.34), aluMat).translateX(-1.3))
    compH.add(new THREE.Mesh(latheX([[0.64, -1.02], [0.64, -1.45], [0.42, -1.62], [0.42, -2.9]]), aluMat))
    const cOut = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.0, 24, 1, true), aluMat)
    cOut.position.set(-1.3, 1.1, -0.98)
    compH.add(cOut)
    root.add(compH)

    // ---- масляные трубки: подвод тонкий сверху, слив толстый снизу
    const oilIn = new THREE.Mesh(cylY(0.06, 1.2, 14), cmat('steel'))
    oilIn.position.set(0, 1.15, 0)
    const oilOut = new THREE.Mesh(cylY(0.17, 1.3, 20), cmat('steelDark'))
    oilOut.position.set(0, -1.2, 0)
    root.add(oilIn, oilOut)

    // ---- потоки
    const R = 0.98
    const spiral = (x0, x1, r0, r1, th0, th1, n = 28) =>
      Array.from({ length: n + 1 }, (_, i) => {
        const k = i / n, th = th0 + (th1 - th0) * k, r = r0 + (r1 - r0) * k
        return [x0 + (x1 - x0) * k, r * Math.sin(th), -r * Math.cos(th)]
      })
    const exPath = smoothPath([[1.3, 2.3, -R], [1.3, 1.0, -R], ...spiral(1.3, 1.25, R, 0.35, 0, -Math.PI * 1.7), [1.5, 0, 0], [2.0, 0, 0], [2.9, 0, 0]])
    const airInPath = polyPath([[-3.2, 0, 0], [-1.5, 0, 0]])
    const airOutPath = smoothPath([...spiral(-1.25, -1.3, 0.35, R, -Math.PI * 1.7, 0), [-1.3, 1.0, -R], [-1.3, 2.3, -R]])
    const fEx = flow(stage, exPath, { n: 60, color: PALETTE.exhaust, size: 0.13, speed: 2.4, jitter: 0.12 })
    const fAirIn = flow(stage, airInPath, { n: 14, color: PALETTE.air, size: 0.12, speed: 1.6, jitter: 0.3 })
    const fAirOut = flow(stage, airOutPath, { n: 70, color: '#a9c49a', size: 0.11, speed: 1.4, jitter: 0.06 })
    const oilA = polyPath([[0, 1.75, 0], [0, 0.3, 0], [-0.45, 0.16, 0], [-0.45, -0.16, 0], [0, -0.3, 0], [0, -1.85, 0]])
    const oilB = polyPath([[0, 1.75, 0], [0, 0.3, 0], [0.45, 0.16, 0], [0.45, -0.16, 0], [0, -0.3, 0], [0, -1.85, 0]])
    const fOilA = flow(stage, oilA, { n: 18, color: PALETTE.oil, size: 0.1, speed: 0.8, front: true })
    const fOilB = flow(stage, oilB, { n: 18, color: PALETTE.oil, size: 0.1, speed: 0.8, front: true })
    const flows = { ex: [fEx], air: [fAirIn, fAirOut], oil: [fOilA, fOilB] }

    // ---- заглушки и «посторонний предмет» (шаг 5)
    const capMat = stage.mat('rubber', { color: '#8a4a3e', transparent: true, opacity: 0 })
    const caps = [
      [cylX(0.5, 0.08, 28), [-2.95, 0, 0]],
      [cylX(0.54, 0.08, 28), [2.85, 0, 0]],
      [cylY(0.36, 0.08, 28), [-1.3, 2.13, -R]],
      [cylY(0.38, 0.08, 28), [1.3, 2.13, -R]],
    ].map(([g, p]) => {
      const m = new THREE.Mesh(g, capMat)
      m.position.set(...p)
      root.add(m)
      return m
    })
    const junk = new THREE.Mesh(axX(ringY(0.07, 0.16, 0.04, 6)), stage.mat('steel', { color: '#d9d4ca' }))
    junk.visible = false
    root.add(junk)
    const junkHit = stage.mat('bad', { transparent: true, opacity: 0, emissive: PALETTE.bad, emissiveIntensity: 0.6, depthWrite: false })
    const hitDisc = new THREE.Mesh(cylX(0.66, 0.45, 32), junkHit)
    hitDisc.position.x = -1.25
    root.add(hitDisc)

    // ---- подписи
    const L = {
      turb: stage.label('Турбина', new THREE.Vector3(1.3, -1.25, -0.5), { side: 'bottom' }),
      comp: stage.label('Компрессор', new THREE.Vector3(-1.3, -1.25, -0.5), { side: 'bottom' }),
      shaft: stage.label('Общий вал', new THREE.Vector3(0.75, 0.07, 0), { side: 'top' }),
      brg: stage.label('Подшипники (на масле)', new THREE.Vector3(-0.45, -0.15, 0), { side: 'bottom' }),
      exIn: stage.label('Газы из коллектора', new THREE.Vector3(1.3, 2.15, -R), { side: 'right' }),
      exOut: stage.label('В выпуск', new THREE.Vector3(2.8, 0.45, 0), { side: 'top' }),
      airIn: stage.label('Воздух после фильтра', new THREE.Vector3(-2.9, 0.42, 0), { side: 'top' }),
      airOut: stage.label('Сжатый — в охладитель', new THREE.Vector3(-1.3, 2.15, -R), { side: 'left' }),
      oilIn: stage.label('Подвод: тонкая, сверху', new THREE.Vector3(0, 1.7, 0), { side: 'right' }),
      oilOut: stage.label('Слив: толстая, вниз', new THREE.Vector3(0.17, -1.75, 0), { side: 'right' }),
      caps: stage.label('Заглушки — до монтажа', new THREE.Vector3(1.3, 2.25, -R), { side: 'top', tone: 'ok' }),
      junk: stage.label('Шайба во впуске = разбитое колесо', new THREE.Vector3(-3.0, -0.4, 0), { side: 'bottom', tone: 'warn' }),
    }

    const S = { step: 0, spin: 0.15, ang: 0, ex: 0, air: 0, oil: 0, dimOthers: 1 }

    stage.onFrame((dt, t) => {
      if (stage.playing) S.ang += dt * 16 * S.spin
      rotor.rotation.x = -S.ang
      for (const f of flows.ex) {
        f.amount = S.ex
        f.speed = 2.4 * Math.max(0.3, S.spin)
        f.opacity = S.dimOthers
      }
      for (const f of flows.air) {
        f.amount = S.air
        f.speed = (f === fAirIn ? 1.8 : 1.4) * Math.max(0.3, S.spin)
        f.opacity = S.dimOthers
      }
      for (const f of flows.oil) f.amount = S.oil
      brgMat.emissiveIntensity = S.oil * (0.25 + 0.2 * Math.sin(t * 4))
      // шаг 5: шайба летит во впуск → вспышка на колесе; потом заглушки
      if (S.step === 4) {
        const c = clock.t
        const k = clamp01((c % 4) / 1.6)
        junk.visible = c < 4.0 || (c % 4) < 1.8
        if (c >= 4) junk.visible = false
        junk.position.set(-3.6 + 2.2 * ease(k), -0.1 * Math.sin(k * 3), 0)
        junk.rotation.z = k * 6
        junkHit.opacity = c < 4 ? 0.5 * clamp01(((c % 4) - 1.5) / 0.1) * (1 - clamp01(((c % 4) - 1.7) / 0.8)) : 0
        L.junk.show(c < 4)
        const kc = ease(clamp01((c - 4.2) / 0.8))
        capMat.opacity = kc
        for (const m of caps) m.visible = kc > 0.01
        L.caps.show(kc > 0.5)
      }
    })

    const apply = (i, instant) => {
      S.step = i
      clock.reset(instant ? 99 : 0)
      // ракурсы заданы «впритык» — отодвигаем камеру, чтобы корпус не обрезался в блоке урока
      const v0 = VIEWS[i]
      const v = { t: v0.t, p: v0.p.map((x, j) => v0.t[j] + (x - v0.t[j]) * 1.4) }
      if (instant) {
        stage.camera.position.set(...v.p)
        stage.controls.target.set(...v.t)
      } else stage.flyTo(v.p, v.t, 900)
      const d = instant ? 0 : 1.2
      const cfg = [
        { spin: 0.15, ex: 0, air: 0, oil: 0, dim: 1, labels: ['turb', 'comp', 'shaft', 'brg'] },
        { spin: 1, ex: 1, air: 0, oil: 0, dim: 1, labels: ['turb', 'exIn', 'exOut'] },
        { spin: 1, ex: 1, air: 1, oil: 0, dim: 1, labels: ['comp', 'airIn', 'airOut'] },
        { spin: 0.6, ex: 1, air: 1, oil: 1, dim: 0.22, labels: ['brg', 'oilIn', 'oilOut'] },
        { spin: 0, ex: 0, air: 0, oil: 0, dim: 1, labels: [] },
      ][i]
      to(S, 'spin', cfg.spin, d)
      to(S, 'ex', cfg.ex, instant ? 0 : 0.8)
      to(S, 'air', cfg.air, instant ? 0 : 0.8)
      to(S, 'oil', cfg.oil, instant ? 0 : 0.8)
      to(S, 'dimOthers', cfg.dim, instant ? 0 : 0.6)
      for (const k in L) L[k].show(cfg.labels.includes(k))
      if (i !== 4) {
        junk.visible = false
        junkHit.opacity = 0
        capMat.opacity = 0
        for (const m of caps) m.visible = false
      }
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
