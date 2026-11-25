// Шестерёнчатый масляный насос (крышка снята): масло переносится во впадинах зубьев по краю корпуса,
// редукционный клапан сбрасывает лишнее при высоком давлении.
import { createStage, animator, THREE, PALETTE, cylX, cylY, cylZ, clamp01, ease } from '../stage.js'
import { polyPath, flow, springGeo, gauge, stepClock } from './es-kit.js'

const STEPS = [
  { title: 'Устройство', text: 'Крышка насоса снята. В корпусе две шестерни в зацеплении: ведущая крутится от двигателя, ведомая — от неё. Слева вход из маслоприёмника, справа выход к фильтру и в магистраль. На выходе — редукционный клапан.' },
  { title: 'Как насос качает', text: 'Шестерни крутятся навстречу друг другу. Масло со входа попадает во впадины между зубьями и едет по краю корпуса к выходу. В зацеплении зубья входят во впадины и выдавливают масло в выход. Назад через зацепление оно пройти не может.' },
  { title: 'Редукционный клапан', text: 'На высоких оборотах или на холодном, густом масле давление растёт. Когда оно выше нормы, масло отжимает плунжер клапана, сжимая пружину, и лишнее уходит обратно в поддон. Давление снова в норме.' },
  { title: 'При сборке', text: 'Зазоры шестерён (по зубьям и торцам) проверяют щупом, значения по ТК. Насос перед запуском заливают маслом. Маслоприёмник крепят герметично: подсос воздуха — и давления нет.' },
]

const VIEWS = [
  { p: [1.0, 6.6, 7.0], t: [0.5, 0, -0.1] },
  { p: [0.5, 9.2, 2.6], t: [0.5, 0, 0] },
  { p: [5.6, 5.0, 3.4], t: [2.3, 0, -0.6] },
  { p: [-1.6, 5.8, 5.0], t: [-0.4, 0, -0.4] },
]

const N = 10, RP = 0.6, RT = 0.72, RR = 0.46, H = 0.5
const P = (Math.PI * 2) / N
const A_C = -0.6, B_C = 0.6 // центры шестерён по z

export default {
  title: 'Шестерёнчатый масляный насос',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: VIEWS[0].p, target: VIEWS[0].t, fov: 30 })
    const to = animator(stage)
    const clock = stepClock(stage)
    const { root } = stage

    // ---- шестерня (контур в плоскости XZ, толщина по Y)
    const gearShape = new THREE.Shape()
    for (let i = 0; i < N; i++) {
      const a = i * P
      const pts = [[RR, a - 0.5 * P], [RR, a - 0.27 * P], [RT, a - 0.13 * P], [RT, a + 0.13 * P], [RR, a + 0.27 * P]]
      pts.forEach(([r, t], j) => {
        if (i === 0 && j === 0) gearShape.moveTo(r * Math.cos(t), r * Math.sin(t))
        else gearShape.lineTo(r * Math.cos(t), r * Math.sin(t))
      })
    }
    const hole = new THREE.Path()
    hole.absarc(0, 0, 0.12, 0, Math.PI * 2, true)
    gearShape.holes.push(hole)
    const gearGeo = new THREE.ExtrudeGeometry(gearShape, { depth: H, bevelEnabled: false }).rotateX(-Math.PI / 2)
    const gA = new THREE.Group()
    const gearMatA = stage.mat('steel', { emissive: PALETTE.milk, emissiveIntensity: 0 })
    gA.add(new THREE.Mesh(gearGeo, gearMatA))
    const shaftA = stage.mesh(cylY(0.12, 1.5, 20), 'chrome')
    shaftA.position.y = 0.6
    gA.add(shaftA)
    const keyA = stage.mesh(new THREE.BoxGeometry(0.05, 0.5, 0.26), 'steelDark')
    keyA.position.set(0, 1.05, 0)
    gA.add(keyA)
    gA.position.set(0, 0, A_C)
    root.add(gA)
    const gB = new THREE.Group()
    gB.add(new THREE.Mesh(gearGeo, stage.mat('steelDark')))
    const shaftB = stage.mesh(cylY(0.12, 0.7, 20), 'chrome')
    shaftB.position.y = 0.3
    gB.add(shaftB)
    gB.position.set(0, 0, B_C)
    root.add(gB)

    // ---- корпус: две «подковы» вокруг шестерён, между ними канал вход→выход
    const W = 1.5, HZ = 1.62, CW = 0.22, R = RT + 0.03
    const xi = Math.sqrt(R * R - (Math.abs(A_C) - CW) ** 2)
    const th1 = Math.atan2(Math.abs(A_C) - CW, -xi), th2 = Math.atan2(Math.abs(A_C) - CW, xi)
    const half = new THREE.Shape()
    half.moveTo(-W, -CW)
    half.lineTo(-xi, -CW)
    half.absarc(0, A_C, R, th1, th2 + Math.PI * 2, false)
    half.lineTo(W, -CW)
    half.lineTo(W, -HZ)
    half.lineTo(-W, -HZ)
    half.lineTo(-W, -CW)
    const halfGeo = new THREE.ExtrudeGeometry(half, { depth: H, bevelEnabled: false, curveSegments: 40 }).rotateX(Math.PI / 2).translate(0, H, 0)
    const housMat = stage.mat('ironDark', { side: THREE.DoubleSide, color: '#3f3e3a', roughness: 0.75 })
    root.add(new THREE.Mesh(halfGeo, housMat))
    root.add(new THREE.Mesh(halfGeo.clone().scale(1, 1, -1), housMat))
    const floor = stage.mesh(new THREE.BoxGeometry(2 * W, 0.1, 2 * HZ), 'ironDark', { color: '#2c2b29' })
    floor.position.y = -0.05
    root.add(floor)

    // ---- трубы (полупрозрачные)
    const pipeMat = stage.mat('steelDark', { transparent: true, opacity: 0.35, depthWrite: false })
    const inPipe = new THREE.Mesh(cylX(0.2, 1.2, 20), pipeMat)
    inPipe.position.set(-2.1, 0.25, 0)
    const outPipe = new THREE.Mesh(cylX(0.2, 2.2, 20), pipeMat)
    outPipe.position.set(2.6, 0.25, 0)
    root.add(inPipe, outPipe)

    // ---- редукционный клапан на выходе (ответвление к -z)
    const RV_X = 2.4
    const rvBody = new THREE.Mesh(cylZ(0.19, 1.4, 20), pipeMat)
    rvBody.position.set(RV_X, 0.25, -0.9)
    const rvCap = stage.mesh(cylZ(0.23, 0.1, 20), 'steelDark')
    rvCap.position.set(RV_X, 0.25, -1.62)
    const rvRet = new THREE.Mesh(cylY(0.1, 1.15, 14), pipeMat)
    rvRet.position.set(RV_X, -0.32, -0.5)
    root.add(rvBody, rvCap, rvRet)
    const plunger = stage.mesh(cylZ(0.16, 0.35, 20), 'chrome')
    root.add(plunger)
    const rvSpring = stage.mesh(springGeo(0.13, 0.025, 1, 7), 'steelBlack')
    rvSpring.rotation.x = Math.PI / 2
    root.add(rvSpring)

    // ---- давление
    const gP = gauge(stage, { h: 1.3, r: 0.06, color: PALETTE.oil })
    gP.position.set(1.85, 0.45, 0)
    root.add(gP)
    const gStem = stage.mesh(cylY(0.05, 0.25, 10), 'steelDark')
    gStem.position.set(1.85, 0.35, 0)
    root.add(gStem)

    // ---- частицы во впадинах зубьев (3 на впадину, у каждой шестерни)
    const NPG = N * 3
    const tPos = new Float32Array(NPG * 2 * 3)
    const tGeo = new THREE.BufferGeometry()
    tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3))
    const inFlow = flow(stage, polyPath([[-2.7, 0.25, 0], [-0.75, 0.25, 0]]), { n: 26, color: '#e2b955', size: 0.15, speed: 0.9, jitter: 0.3, front: true })
    const tMat = inFlow.mat.clone()
    tMat.size = 0.15
    const tPts = new THREE.Points(tGeo, tMat)
    tPts.frustumCulled = false
    tPts.renderOrder = 20
    root.add(tPts)
    const outFlow = flow(stage, polyPath([[0.6, 0.25, 0], [3.7, 0.25, 0]]), { n: 34, color: '#e2b955', size: 0.15, speed: 1.1, jitter: 0.22, front: true })
    const retFlow = flow(stage, polyPath([[RV_X, 0.25, -0.15], [RV_X, 0.25, -0.5], [RV_X, -0.9, -0.5]]), { n: 14, color: PALETTE.oil, size: 0.12, speed: 1.0, jitter: 0.05, front: true })
    const airFlow = flow(stage, polyPath([[-2.0, 0.55, 0.1], [-2.0, 0.3, 0.05], [-0.8, 0.25, 0]]), { n: 10, color: '#e9eef2', size: 0.1, speed: 0.6, jitter: 0.15, front: true })
    retFlow.amount = 0
    airFlow.amount = 0

    // щуп (шаг «При сборке»): между вершиной зуба и стенкой корпуса
    const feeler = new THREE.Group()
    const blade = stage.mesh(new THREE.BoxGeometry(0.3, 1.0, 0.025), 'chrome', { color: '#e3ddd0' })
    const fh = stage.mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), 'steelBlack')
    fh.position.y = 0.57
    feeler.add(blade, fh)
    feeler.position.set(0, 1.6, A_C - RT - 0.016)
    feeler.visible = false
    root.add(feeler)

    // ---- подписи
    const L = {
      drive: stage.label('Ведущая шестерня', gA, { offset: [0, 1.35, 0], side: 'top' }),
      driven: stage.label('Ведомая', gB, { offset: [0.3, 0.5, 0.5], side: 'right' }),
      in: stage.label('Вход', new THREE.Vector3(-2.3, 0.5, 0), { side: 'top' }),
      out: stage.label('Выход', new THREE.Vector3(3.4, 0.5, 0.2), { side: 'bottom' }),
      rv: stage.label('Редукционный клапан', new THREE.Vector3(RV_X + 0.2, 0.3, -1.3), { side: 'right' }),
      teeth: stage.label('Масло едет во впадинах', new THREE.Vector3(0, 0.5, A_C - 0.9), { side: 'top', tone: 'accent' }),
      mesh: stage.label('Зацепление выдавливает в выход', new THREE.Vector3(0.3, 0.5, 0), { side: 'right' }),
      press: stage.label('Давление', gP, { offset: [0, 1.4, 0], side: 'top' }),
      ret: stage.label('Лишнее — в поддон', new THREE.Vector3(RV_X, -0.85, -0.5), { side: 'right', tone: 'accent' }),
      feeler: stage.label('Зазор по зубьям — щупом, по ТК', new THREE.Vector3(0.2, 1.3, A_C - RT), { side: 'right' }),
      air: stage.label('Подсос воздуха = нет давления', new THREE.Vector3(-2.0, 0.6, 0.1), { side: 'top', tone: 'warn' }),
    }

    const S = { step: 0, rpm: 0.3, ang: 0, P: 0, open: 0, oil: 0, auto: false, air: 0 }
    const tmp = new THREE.Vector3()

    stage.onFrame((dt, t) => {
      // шаг 2: обороты растут → давление → клапан открывается
      if (S.step === 2) {
        const k = (clock.t % 8) / 8
        S.rpm = 0.6 + 1.0 * (k < 0.45 ? ease(k / 0.45) : k < 0.75 ? 1 : 1 - ease((k - 0.75) / 0.25))
      }
      if (stage.playing) S.ang += dt * 1.6 * S.rpm
      const psiA = -S.ang, psiB = S.ang + P / 2
      gA.rotation.y = psiA
      gB.rotation.y = psiB
      // давление: растёт с оборотами, ограничено клапаном; воздух его «съедает»
      const raw = 0.25 + 0.5 * S.rpm
      const wantOpen = clamp01((raw - 0.82) / 0.1)
      S.open += (wantOpen - S.open) * Math.min(1, dt * 5)
      const targetP = Math.min(raw, 0.86) * (1 - 0.7 * S.air) * S.oil
      S.P += (targetP - S.P) * Math.min(1, dt * 3)
      gP.set(S.P)
      // клапан
      const zp = -0.42 - 0.45 * S.open
      plunger.position.set(RV_X, 0.25, zp)
      rvSpring.position.set(RV_X, 0.25, zp - 0.175)
      rvSpring.scale.y = zp - 0.175 + 1.57
      retFlow.amount = S.open * S.oil
      inFlow.amount = S.oil
      outFlow.amount = S.oil
      inFlow.speed = 0.9 * S.rpm
      outFlow.speed = 1.2 * S.rpm
      retFlow.speed = 1.0
      airFlow.amount = S.air
      // частицы во впадинах
      let k = 0
      if (S.oil > 0.01) {
        for (let g = 0; g < 2; g++) {
          const cz = g ? B_C : A_C, psi = g ? psiB : psiA
          for (let i = 0; i < N; i++) {
            const beta = (i + 0.5) * P + psi
            const s = Math.sin(beta)
            // только на внешней стороне (между входом и выходом)
            const outer = g ? s < -0.25 : s > 0.25
            if (!outer) continue
            for (let j = 0; j < 3; j++) {
              const r = [0.55, 0.64, 0.6][j]
              tmp.set(r * Math.cos(beta + (j - 1) * 0.06), [0.12, 0.25, 0.38][j], cz - r * Math.sin(beta + (j - 1) * 0.06))
              tPos[k * 3] = tmp.x
              tPos[k * 3 + 1] = tmp.y
              tPos[k * 3 + 2] = tmp.z
              k++
            }
          }
        }
      }
      tGeo.setDrawRange(0, k)
      tGeo.attributes.position.needsUpdate = true
      tPts.visible = k > 0
      tMat.opacity = S.oil
      L.ret.show(S.step === 2 && S.open > 0.5)
      gearMatA.emissiveIntensity = S.step === 0 ? 0.12 + 0.08 * Math.sin(t * 3) : 0
      // щуп
      if (S.step === 3) {
        const c = clock.t
        feeler.position.y = 1.7 - 0.95 * ease(clamp01((c - 0.4) / 1.2))
      }
    })

    const apply = (i, instant) => {
      S.step = i
      clock.reset(instant ? 99 : 0)
      const v = VIEWS[i]
      if (instant) {
        stage.camera.position.set(...v.p)
        stage.controls.target.set(...v.t)
      } else stage.flyTo(v.p, v.t, 900)
      const d = instant ? 0 : 0.8
      to(S, 'oil', i === 0 ? 0 : 1, d)
      to(S, 'rpm', i === 0 ? 0.3 : i === 3 ? 0.35 : 1, d)
      to(S, 'air', i === 3 ? 1 : 0, d)
      feeler.visible = i === 3
      const show = [
        ['drive', 'driven', 'in', 'out', 'rv'],
        ['teeth', 'mesh', 'in', 'out'],
        ['rv', 'press'],
        ['feeler', 'air', 'press'],
      ][i]
      for (const k in L) L[k].show(show.includes(k))
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
