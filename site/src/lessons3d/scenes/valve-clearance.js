// Регулировка теплового зазора: коромысло, регулировочный винт с контргайкой, щуп между коромыслом и стержнем клапана.
// Зазор на модели сильно увеличен (в жизни — десятые доли миллиметра, значение по ТК).
import { createStage, animator, THREE, PALETTE, cylY, cylZ, clamp01, ease, lerp } from '../stage.js'
import { springGeo, stepClock } from './es-kit.js'

const STEPS = [
  { title: 'Узел и зазор', text: 'Кулачок через толкатель и штангу качает коромысло, другой конец коромысла давит на клапан. Между коромыслом и торцом стержня клапана нужен тепловой зазор: при нагреве детали удлиняются. Зазор на модели увеличен.' },
  { title: 'Только на закрытом клапане', text: 'Пока кулачок давит, клапан открыт и зазора нет — мерить бесполезно. Регулируют, когда толкатель стоит на тыльной (круглой) части кулачка: поршень этого цилиндра в ВМТ такта сжатия, оба клапана закрыты.' },
  { title: 'Проверка щупом', text: 'Щуп нужной толщины (по ТК) вводят между коромыслом и стержнем клапана. Если щуп болтается — зазор больше нормы. Если не входит — меньше.' },
  { title: 'Регулировка винтом', text: 'Ослабить контргайку. Отвёрткой вращать винт, двигая щуп туда-сюда. Перетянул — щуп зажат. Нужно лёгкое протягивание: щуп идёт с небольшим усилием, без рывков.' },
  { title: 'Затянуть и перепроверить', text: 'Держа винт отвёрткой, затянуть контргайку — винт при этом может сдвинуться. Поэтому щупом проверить ещё раз. Дальше — следующий цилиндр по схеме из ТК. Впуск и выпуск часто имеют разные зазоры.' },
]

const FAR = { p: [2.4, -0.3, 10.6], t: [-0.8, -1.75, 0] }
const NEAR = { p: [1.8, 0.7, 3.8], t: [-0.35, 0.05, 0] }
const ADJ = { p: [0.6, 1.4, 5.2], t: [-0.9, 0.1, 0] }
const VIEWS = [FAR, FAR, NEAR, ADJ, ADJ]

const PIVOT = [-1.0, 0.22]
const Y_CUP = -0.27
const BLADE = 0.1 // «правильный» зазор = толщина щупа
const G_BIG = 0.2, G_TIGHT = BLADE * 0.92

// связь «вылет винта s» ↔ «зазор» (малые углы, без лишней точности)
const thetaFrom = (s, lift) => Math.asin(Math.max(-0.9, Math.min(0.9, (-0.02 - s - Y_CUP - lift) / 0.85)))
const gapFrom = (th) => 0.22 + Math.sin(th) - 0.22 * Math.cos(th)
function sFromGap(g) {
  let th = Math.asin(g)
  for (let i = 0; i < 3; i++) th = Math.asin(g - 0.22 + 0.22 * Math.cos(th))
  return -0.02 - Y_CUP - 0.85 * Math.sin(th)
}

export default {
  title: 'Регулировка теплового зазора',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: FAR.p, target: FAR.t, fov: 30 })
    const to = animator(stage)
    const clock = stepClock(stage)
    const { root } = stage

    // ---- головка (верхняя плита), клапан, пружина
    const deck = stage.mesh(new THREE.BoxGeometry(3.8, 0.35, 1.2), 'iron')
    deck.position.set(-0.7, -1.85, 0)
    root.add(deck)
    const valve = new THREE.Group()
    const stem = stage.mesh(cylY(0.07, 2.55, 16), 'chrome')
    stem.position.y = -1.275
    const vhead = stage.mesh(new THREE.CylinderGeometry(0.42, 0.12, 0.18, 32), 'steel')
    vhead.position.y = -2.5
    const retainer = stage.mesh(cylY(0.26, 0.06, 28), 'steelDark')
    retainer.position.y = -0.33
    valve.add(stem, vhead, retainer)
    root.add(valve)
    const spring = stage.mesh(springGeo(0.21, 0.035, 1, 7), 'steelBlack')
    root.add(spring)

    // ---- коромысло на оси
    const rShaft = stage.mesh(cylZ(0.17, 1.0, 24), 'steelDark')
    rShaft.position.set(PIVOT[0], PIVOT[1], 0)
    root.add(rShaft)
    const rocker = new THREE.Group()
    rocker.position.set(PIVOT[0], PIVOT[1], 0)
    root.add(rocker)
    const armMat = stage.mat('steel', { color: '#a19d94' })
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 0.3), armMat)
    arm.position.set(0.07, 0.03, 0)
    const boss = new THREE.Mesh(cylZ(0.28, 0.34, 28), armMat)
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.3), armMat)
    toe.position.set(1.0, -0.16, 0)
    rocker.add(arm, boss, toe)

    // регулировочный винт (двигается относительно коромысла на s) и контргайка
    const screw = new THREE.Group()
    const screwMat = stage.mat('steel', { emissive: PALETTE.milk, emissiveIntensity: 0 })
    const rod = new THREE.Mesh(cylY(0.065, 0.75, 16), screwMat)
    rod.position.y = 0.22
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), screwMat)
    ball.position.y = -0.15
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.03), stage.mat('steelBlack'))
    slot.position.y = 0.6
    screw.add(rod, ball, slot)
    screw.position.x = -0.85
    rocker.add(screw)
    const nutMat = stage.mat('steelDark', { emissive: PALETTE.milk, emissiveIntensity: 0 })
    const nut = new THREE.Mesh(cylY(0.14, 0.12, 6), nutMat)
    nut.position.set(-0.85, 0.235, 0)
    rocker.add(nut)

    // отвёртка и ключ (появляются на регулировке)
    const driver = new THREE.Group()
    const dBlade = stage.mesh(cylY(0.035, 0.8, 10), 'chrome')
    dBlade.position.y = 0.4
    const dHandle = stage.mesh(cylY(0.11, 0.6, 12), 'rubber', { color: '#7c3e34' })
    dHandle.position.y = 1.05
    driver.add(dBlade, dHandle)
    driver.visible = false
    rocker.add(driver)
    const wrench = new THREE.Group()
    const wr = stage.mesh(new THREE.BoxGeometry(1.0, 0.05, 0.14), 'steel')
    wr.position.set(0.62, 0, 0)
    const wrHead = stage.mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 6).rotateX(Math.PI / 2), 'steel')
    wrench.add(wr, wrHead)
    wrench.visible = false
    rocker.add(wrench)

    // ---- штанга, толкатель, кулачок
    const push = new THREE.Group()
    const pRod = stage.mesh(cylY(0.055, 2.73, 12), 'steelDark')
    pRod.position.y = (Y_CUP - 3.0) / 2
    const cup = stage.mesh(new THREE.CylinderGeometry(0.12, 0.07, 0.12, 16), 'steelDark')
    cup.position.y = Y_CUP - 0.05
    const tappet = stage.mesh(cylY(0.17, 0.5, 20), 'steel')
    tappet.position.y = -3.25
    push.add(pRod, cup, tappet)
    push.position.x = -1.85
    root.add(push)

    const CAM_C = [-1.85, -3.95]
    const camShape = new THREE.Shape()
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2
      const r = 0.45 + 0.3 * Math.pow(Math.max(0, Math.cos(a)), 2)
      if (i === 0) camShape.moveTo(r * Math.cos(a), r * Math.sin(a))
      else camShape.lineTo(r * Math.cos(a), r * Math.sin(a))
    }
    const cam = new THREE.Group()
    cam.add(stage.mesh(new THREE.ExtrudeGeometry(camShape, { depth: 0.34, bevelEnabled: false }).translate(0, 0, -0.17), 'steelDark'))
    const camBase = stage.mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.36, 40, 1, true).rotateX(Math.PI / 2), stage.mat('ok', { transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, emissive: PALETTE.ok, emissiveIntensity: 0.5 }))
    cam.add(camBase)
    cam.position.set(CAM_C[0], CAM_C[1], 0)
    root.add(cam)
    const camShaft = stage.mesh(cylZ(0.18, 1.3, 20), 'steel')
    camShaft.position.copy(cam.position)
    root.add(camShaft)

    // ---- щуп
    const feeler = new THREE.Group()
    const bladeMat = stage.mat('chrome', { color: '#e3ddd0', emissive: PALETTE.ok, emissiveIntensity: 0 })
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, BLADE * 0.92, 1.7), bladeMat)
    const handle = stage.mesh(new THREE.BoxGeometry(0.62, 0.2, 0.6), 'steelBlack')
    handle.position.z = 1.1
    feeler.add(blade, handle)
    feeler.position.set(0, BLADE / 2, 3.0)
    feeler.visible = false
    root.add(feeler)

    // ---- подписи
    const L = {
      rocker: stage.label('Коромысло', rocker, { offset: [0.45, 0.2, 0], side: 'top' }),
      screw: stage.label('Регулировочный винт', screw, { offset: [0, 0.6, 0], side: 'left' }),
      nut: stage.label('Контргайка', nut, { offset: [0.14, 0, 0], side: 'right' }),
      valve: stage.label('Клапан', stem, { offset: [0.07, 0.6, 0], side: 'right' }),
      gap: stage.label('Зазор', new THREE.Vector3(0.12, 0.1, 0), { side: 'right', tone: 'accent' }),
      cam: stage.label('', cam, { offset: [0.6, -0.3, 0], side: 'right' }),
      feel: stage.label('', new THREE.Vector3(0.25, -0.25, 0.4), { side: 'right' }),
    }

    const S = { step: 0, s: sFromGap(G_BIG), camAng: -Math.PI / 2, camSpin: 0, feelerZ: 3.0, nutAng: 0, screwAng: 0, hiNut: 0, hiScrew: 0, showGap: false, glow: 0 }
    let gapNow = G_BIG

    stage.onFrame((dt, t) => {
      if (S.camSpin > 0 && stage.playing) S.camAng += dt * 1.4 * S.camSpin
      cam.rotation.z = S.camAng
      const phi = S.camAng - Math.PI / 2
      const lift = 0.3 * Math.pow(Math.max(0, Math.cos(phi)), 2)
      push.position.y = lift
      const th = thetaFrom(S.s, lift)
      const toeY = gapFrom(th)
      // кулачок давит — коромысло открывает клапан
      const D = Math.max(0, -toeY)
      rocker.rotation.z = th
      valve.position.y = -D
      spring.position.y = -0.36 - D
      spring.scale.y = 1.675 - 0.36 - D
      gapNow = Math.max(0, toeY)
      L.gap.show(S.showGap && gapNow > 0.02)
      screw.position.y = -S.s
      screw.rotation.y = S.screwAng
      nut.rotation.y = S.nutAng
      driver.position.set(-0.85, 0.6 - S.s, 0)
      driver.rotation.y = S.screwAng
      wrench.position.set(-0.85, 0.235, 0)
      wrench.rotation.y = S.nutAng - 0.6
      nutMat.emissiveIntensity = S.hiNut * (0.25 + 0.15 * Math.sin(t * 6))
      screwMat.emissiveIntensity = S.hiScrew * (0.25 + 0.15 * Math.sin(t * 6))
      // кулачок: подсветка тыльной части и подпись
      const onBase = lift < 0.005
      camBase.material.opacity = S.step === 1 && onBase ? 0.45 : 0
      if (S.step === 1) L.cam.set(onBase ? 'Тыльная часть: клапан закрыт' : 'Кулачок давит: клапан открыт').tone(onBase ? 'ok' : 'warn')
      // щуп: не войдёт, если зазор меньше толщины
      const zStop = gapNow < BLADE * 0.9 ? 1.05 : -9
      const fz = Math.max(S.feelerZ, zStop)
      feeler.position.z = fz
      const inside = fz < 1.0
      const loose = inside && gapNow > BLADE + 0.05
      feeler.position.y = BLADE / 2 + (loose ? Math.abs(Math.sin(t * 7)) * (gapNow - BLADE) * 0.6 : 0)
      feeler.rotation.x = loose ? Math.sin(t * 9) * 0.05 : 0
      bladeMat.emissiveIntensity = inside ? S.glow * 0.4 : 0
    })

    const feel = (text, tone) => {
      S.glow = tone === 'ok' ? 1 : 0
      L.feel.set(text).tone(tone).show(true)
    }

    // сценарии шагов по времени шага
    stage.onFrame((dt, t) => {
      const c = clock.t
      if (S.step === 2) {
        S.feelerZ = lerp(3.0, 0.35, ease(clamp01((c - 0.6) / 1.2)))
        if (c > 1.8) feel('Болтается — зазор велик', 'warn')
      }
      if (S.step === 3) {
        // 0–1.3: ослабить контргайку
        const k1 = ease(clamp01(c / 1.3))
        S.nutAng = -k1 * Math.PI * 1.5
        S.hiNut = c < 1.4 ? 1 : 0
        wrench.visible = c < 1.5
        driver.visible = c >= 1.4
        // 1.4–3.6: винт заворачиваем — зазор уменьшается до «перебора»
        const k2 = ease(clamp01((c - 1.4) / 2.2))
        // 4.0–5.0: чуть назад — до лёгкого протягивания
        const k3 = ease(clamp01((c - 4.0) / 1.0))
        const g = lerp(lerp(G_BIG, G_TIGHT, k2), BLADE, k3)
        S.s = sFromGap(g)
        S.screwAng = -(S.s - sFromGap(G_BIG)) * 40
        S.hiScrew = c >= 1.4 && c < 5.2 ? 1 : 0
        // щуп ходит туда-сюда
        S.feelerZ = 0.35 + 0.22 * Math.sin(t * 2.2)
        if (c < 1.4) feel('Контргайку — ослабить', '')
        else if (g > BLADE + 0.05) feel('Винт заворачиваем, щуп двигаем', '')
        else if (c < 4.0) feel('Щуп зажат — перебор', 'warn')
        else feel('Лёгкое протягивание', 'ok')
      }
      if (S.step === 4) {
        S.s = sFromGap(BLADE)
        driver.visible = c < 1.8
        wrench.visible = c < 1.8
        const k1 = ease(clamp01(c / 1.4))
        S.nutAng = -Math.PI * 1.5 + k1 * Math.PI * 1.5
        S.hiNut = c < 1.5 ? 1 : 0
        S.hiScrew = 0
        // перепроверка: щуп вынуть и снова ввести
        const k2 = clamp01((c - 1.8) / 0.8), k3 = ease(clamp01((c - 2.8) / 1.4))
        S.feelerZ = c < 1.8 ? 0.35 : c < 2.8 ? lerp(0.35, 3.0, ease(k2)) : lerp(3.0, 0.35, k3)
        if (c < 1.8) feel('Держим винт, затягиваем контргайку', '')
        else if (c < 4.2) feel('Перепроверка щупом', '')
        else feel('Лёгкое протягивание — готово', 'ok')
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
      S.camSpin = i === 1 ? 1 : 0
      if (i !== 1) {
        // кулачок вернуть тыльной частью к толкателю (кратчайшим путём)
        const base = -Math.PI / 2
        const k = Math.round((S.camAng - base) / (Math.PI * 2))
        to(S, 'camAng', base + k * Math.PI * 2, d)
      }
      if (i <= 2) {
        to(S, 's', sFromGap(G_BIG), d)
        S.nutAng = 0
        S.screwAng = 0
      }
      S.hiNut = S.hiScrew = 0
      driver.visible = wrench.visible = false
      feeler.visible = i >= 2
      if (i < 2) S.feelerZ = 3.0
      if (i === 2) S.feelerZ = 3.0
      for (const k in L) L[k].show(false)
      S.showGap = i <= 1
      S.glow = 0
      if (i === 0) for (const k of ['rocker', 'screw', 'nut', 'valve']) L[k].show(true)
      if (i === 1) L.cam.show(true)
      if (i === 3) {
        L.nut.show(true)
        L.screw.show(true)
      }
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
