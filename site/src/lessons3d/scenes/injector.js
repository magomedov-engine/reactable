// Механическая форсунка в разрезе: давление топлива поднимает иглу, топливо распыляется через отверстия сопла.
// Ход иглы и размеры каналов увеличены, чтобы было видно (об этом сказано в тексте шага).
import { createStage, animator, THREE, PALETTE, cylX, cylY, ringY, lathe, clamp01, ease } from '../stage.js'
import { cutLathe, polyPath, flow, springGeo, gauge, stepClock } from './es-kit.js'

const STEPS = [
  { title: 'Из чего состоит', text: 'Форсунка показана в разрезе. Корпус, внутри пружина давит через штангу на иглу. Игла запирает распылитель — сопло с несколькими крошечными отверстиями. Внизу медная уплотнительная шайба.' },
  { title: 'Топливо приходит', text: 'ТНВД гонит топливо по трубке высокого давления. Через штуцер оно идёт по каналу в корпусе вниз, в камеру вокруг иглы. Игла пока закрыта: давление растёт.' },
  { title: 'Игла поднимается — впрыск', text: 'Давление под иглой побеждает пружину: игла приподнимается, и топливо мелким облаком вылетает из всех отверстий сразу. Ход иглы на модели увеличен.' },
  { title: 'Давление упало — закрылась', text: 'ТНВД закончил подачу, давление падает. Пружина сразу сажает иглу на место — впрыск резко обрывается, без подтекания. Давление открытия задают регулировочные шайбы над пружиной.' },
  { title: 'Установка в головку', text: 'Старую шайбу снять — ставится только новая. Гнездо чистое, без нагара. Затяжка строго по ТК. Игла и распылитель — прецизионная пара: не разукомплектовывать, не трогать руками рабочие поверхности, отверстия не прочищать.' },
]

const VIEWS = [
  { p: [5.4, 3.4, 8.4], t: [0.15, 2.05, 0] },
  { p: [4.6, 3.4, 8.0], t: [0.3, 2.2, 0] },
  { p: [2.6, 1.0, 5.0], t: [0, 0.2, 0] },
  { p: [1.8, 2.1, 5.8], t: [0, 1.5, 0] },
  { p: [5.0, 4.0, 9.4], t: [0, 1.9, 0] },
]

export default {
  title: 'Форсунка в разрезе',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: VIEWS[0].p, target: VIEWS[0].t, fov: 30 })
    const to = animator(stage)
    const clock = stepClock(stage)
    const { root } = stage

    // всё, что относится к форсунке (опускается в гнездо на шаге «Установка»)
    const inj = new THREE.Group()
    root.add(inj)

    // распылитель (прецизионная пара с иглой)
    const nozzle = cutLathe(stage, [
      [0.09, 1.5], [0.09, 0.75], [0.16, 0.72], [0.16, 0.5], [0.09, 0.47], [0.09, 0.26], [0.035, 0.14], [0, 0.11],
      [0, 0.03], [0.07, 0.035], [0.17, 0.16], [0.17, 0.85], [0.28, 0.88], [0.28, 1.5],
    ], 'steel', { over: { color: '#c3beb3' } })
    inj.add(nozzle)

    // гайка распылителя
    const nut = cutLathe(stage, [[0.18, 0.78], [0.37, 0.78], [0.37, 2.0], [0.295, 2.0], [0.295, 0.875], [0.18, 0.875]], 'steelDark')
    inj.add(nut)

    // корпус с камерой пружины
    const body = cutLathe(stage, [
      [0.08, 1.5], [0.29, 1.5], [0.29, 2.0], [0.42, 2.0], [0.42, 4.0], [0.0, 4.0], [0.0, 3.62], [0.2, 3.62], [0.2, 1.75], [0.08, 1.75],
    ], 'iron')
    inj.add(body)
    // штуцер слива (обратка) сверху
    const ret = stage.mesh(cylY(0.1, 0.3, 20), 'steelDark')
    ret.position.y = 4.15
    inj.add(ret)

    // регулировочные шайбы
    const shimMat = stage.mat('steel', { color: '#7f93a4' })
    for (const y of [3.585, 3.54]) {
      const s = new THREE.Mesh(cylY(0.19, 0.04, 28), shimMat)
      s.position.y = y
      inj.add(s)
    }

    // игла + штанга + тарелка пружины (поднимаются вместе)
    const needleGrp = new THREE.Group()
    const needle = stage.mesh(lathe([[0, 0.135], [0.02, 0.15], [0.085, 0.26], [0.085, 0.46], [0.07, 0.5], [0.07, 0.7], [0.085, 0.74], [0.085, 1.55], [0.05, 1.6], [0, 1.6]], 32), 'chrome')
    const rod = stage.mesh(cylY(0.065, 0.5, 16), 'steel')
    rod.position.y = 1.85
    const seat = stage.mesh(cylY(0.17, 0.05, 28), 'steelDark')
    seat.position.y = 2.12
    needleGrp.add(needle, rod, seat)
    inj.add(needleGrp)

    // пружина: верх у шайб (y=3.52), низ на тарелке (y=2.145)
    const SPR_TOP = 3.52, SPR_LEN = 3.52 - 2.145
    const spring = stage.mesh(springGeo(0.14, 0.032, 1, 9), 'steelBlack')
    spring.position.y = SPR_TOP
    inj.add(spring)

    // штуцер подвода и канал с топливом
    const inlet = new THREE.Group()
    const inTube = stage.mesh(cylX(0.11, 0.7, 20), 'steel')
    inTube.position.set(0.77, 3.8, 0)
    const inNut = stage.mesh(cylX(0.17, 0.26, 6), 'steelDark')
    inNut.position.set(0.98, 3.8, 0)
    inlet.add(inTube, inNut)
    inj.add(inlet)
    const fuelMat = stage.mat('fuel', { emissive: PALETTE.fuel, emissiveIntensity: 0.1, side: THREE.DoubleSide })
    const chPts = [[1.2, 3.8, 0], [0.235, 3.8, 0], [0.235, 0.92, 0], [0.13, 0.72, 0]]
    for (let i = 0; i < chPts.length - 1; i++) {
      const a = new THREE.Vector3(...chPts[i]), b = new THREE.Vector3(...chPts[i + 1])
      const len = a.distanceTo(b)
      const c = new THREE.Mesh(cylY(0.035, len, 10), fuelMat)
      c.position.copy(a).add(b).multiplyScalar(0.5)
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
      inj.add(c)
    }
    // камера вокруг иглы, заполненная топливом
    const chamber = cutLathe(stage, [[0.072, 0.51], [0.158, 0.51], [0.158, 0.71], [0.072, 0.71]], fuelMat, { caps: false })
    inj.add(chamber)

    // медная уплотнительная шайба
    const copper = stage.mat('bronze', { color: '#c27a4e' })
    const washer = new THREE.Mesh(ringY(0.175, 0.34, 0.05, 40), copper)
    washer.position.y = 0.75
    inj.add(washer)
    // старая (обжатая) шайба для шага установки
    const oldWasher = new THREE.Mesh(ringY(0.175, 0.34, 0.035, 40), stage.mat('bronze', { color: '#6b4a36', roughness: 0.8, transparent: true }))
    oldWasher.position.y = 0.75
    oldWasher.visible = false
    inj.add(oldWasher)

    // головка цилиндра (гнездо) — только на шаге установки
    const head = cutLathe(stage, [[0.2, 0.15], [1.6, 0.15], [1.6, 0.725], [0.4, 0.725], [0.4, 0.42], [0.2, 0.36]], 'ironDark')
    head.visible = false
    root.add(head)
    const seatRing = new THREE.Mesh(ringY(0.36, 0.5, 0.01, 40), stage.mat('ok', { transparent: true, opacity: 0, emissive: PALETTE.ok, emissiveIntensity: 0.5 }))
    seatRing.position.y = 0.73
    head.add(seatRing)
    const torque = stage.arrow(new THREE.Vector3(0, 5.3, 0), new THREE.Vector3(0, 4.45, 0), PALETTE.milk, { head: 0.25, width: 0.2 })
    torque.visible = false
    root.add(torque)

    // индикатор давления
    const gP = gauge(stage, { h: 2.0, r: 0.06, color: PALETTE.fuel })
    gP.position.set(-1.05, 1.2, 0)
    root.add(gP)

    // поток топлива по каналу
    const fFlow = flow(stage, polyPath(chPts), { n: 26, color: '#f2c39a', size: 0.11, speed: 0.9, front: true, parent: inj })
    fFlow.amount = 0

    // распыл: 6 отверстий, капли разлетаются конусами (аддитивно — гаснут к чёрному)
    const HOLES = 6, NS = 168
    const sprayPos = new Float32Array(NS * 3)
    const sprayCol = new Float32Array(NS * 3)
    const sGeo = new THREE.BufferGeometry()
    sGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3))
    sGeo.setAttribute('color', new THREE.BufferAttribute(sprayCol, 3))
    const sMat = new THREE.PointsMaterial({ size: 0.085, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, map: fFlow.mat.map })
    const spray = new THREE.Points(sGeo, sMat)
    spray.frustumCulled = false
    inj.add(spray)
    const dirs = Array.from({ length: HOLES }, (_, i) => {
      const a = (i / HOLES) * Math.PI * 2 + 0.3, e = 0.55
      return new THREE.Vector3(Math.cos(a) * Math.cos(e), -Math.sin(e), Math.sin(a) * Math.cos(e))
    })
    const sp = Array.from({ length: NS }, (_, i) => ({ h: i % HOLES, off: Math.random(), j: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5) }))
    const sprayCo = new THREE.Color('#ffd6b0')

    // подписи
    const L = {
      body: stage.label('Корпус', new THREE.Vector3(-0.42, 3.4, 0), { side: 'left' }),
      spring: stage.label('Пружина', new THREE.Vector3(0.18, 2.9, 0), { side: 'right' }),
      needle: stage.label('Игла', new THREE.Vector3(-0.09, 1.2, 0), { side: 'left' }),
      nozzle: stage.label('Распылитель', new THREE.Vector3(0.17, 0.35, 0), { side: 'right' }),
      washer: stage.label('Медная шайба', new THREE.Vector3(-0.34, 0.75, 0), { side: 'left' }),
      inlet: stage.label('Подвод от ТНВД', new THREE.Vector3(1.1, 3.95, 0), { side: 'top' }),
      press: stage.label('Давление', gP, { offset: [0, 2.1, 0], side: 'top' }),
      torque: stage.label('Затяжка по ТК', new THREE.Vector3(0.2, 5.0, 0), { side: 'right', tone: 'accent' }),
      pair: stage.label('Пара игла + распылитель: руками не трогать', new THREE.Vector3(0.17, 0.3, 0), { side: 'right', tone: 'warn' }),
    }
    for (const l of [L.body, L.spring, L.needle, L.nozzle, L.washer, L.inlet, L.pair]) {
      // подписи едут вместе с форсункой
      const p = l.anchor.clone()
      l.anchor = inj
      l.offset.copy(p)
    }

    const S = { step: 0, mode: 'still', P: 0, lift: 0, sprayAmt: 0, period: 2.4, drop: 0, injY: 0 }

    stage.onFrame((dt, t) => {
      // цикл впрыска
      if (S.mode === 'cycle') {
        const ph = (t / S.period) % 1
        let P
        if (ph < 0.45) P = ease(ph / 0.45)
        else if (ph < 0.68) P = 1 - 0.1 * ((ph - 0.45) / 0.23)
        else if (ph < 0.78) P = 0.9 - 0.75 * ease((ph - 0.68) / 0.1)
        else P = 0.15 * (1 - (ph - 0.78) / 0.22)
        const open = ph > 0.43 && ph < 0.72
        S.P = P
        S.lift += ((open ? 1 : 0) - S.lift) * Math.min(1, dt * 30)
        fFlow.speed = 0.5 + 1.6 * S.lift
      }
      gP.set(S.P)
      gP.userData.fillMat.emissiveIntensity = 0.15 + S.P * 0.6
      fuelMat.emissiveIntensity = 0.08 + S.P * 0.45
      const LIFT = 0.075
      needleGrp.position.y = S.lift * LIFT
      spring.scale.y = SPR_LEN - S.lift * LIFT
      // распыл
      S.sprayAmt += ((S.lift > 0.5 ? 1 : 0) - S.sprayAmt) * Math.min(1, dt * 14)
      spray.visible = S.sprayAmt > 0.02
      if (spray.visible) {
        const tt = stage.time
        for (let i = 0; i < NS; i++) {
          const s = sp[i]
          const age = (tt * 2.4 + s.off) % 1
          const d = dirs[s.h]
          const r = 0.07 + age * 1.3
          sprayPos[i * 3] = d.x * r + s.j.x * age * 0.35
          sprayPos[i * 3 + 1] = 0.06 + d.y * r + s.j.y * age * 0.35 - age * age * 0.15
          sprayPos[i * 3 + 2] = d.z * r + s.j.z * age * 0.35
          const k = S.sprayAmt * (1 - age) * (1 - age)
          sprayCol[i * 3] = sprayCo.r * k
          sprayCol[i * 3 + 1] = sprayCo.g * k
          sprayCol[i * 3 + 2] = sprayCo.b * k
        }
        sGeo.attributes.position.needsUpdate = true
        sGeo.attributes.color.needsUpdate = true
      }
      // шаг установки: сценарий по времени шага
      if (S.step === 4) {
        const c = clock.t
        inj.position.y = 1.7 * (1 - ease(clamp01((c - 2.0) / 1.3)))
        // старая шайба уезжает
        const k1 = ease(clamp01((c - 0.4) / 0.8))
        oldWasher.visible = k1 < 1
        oldWasher.position.set(k1 * 1.6, 0.75 - k1 * 0.4, 0)
        oldWasher.material.opacity = 1 - k1
        // новая шайба надевается снизу
        const k2 = ease(clamp01((c - 1.1) / 0.6))
        washer.visible = c > 1.1
        washer.position.y = 0.75 - (1 - k2) * 0.7
        washer.scale.setScalar(1)
        // чистое гнездо — подсветка
        seatRing.material.opacity = 0.9 * clamp01((c - 1.4) / 0.4) * (1 - clamp01((c - 2.6) / 0.6))
        torque.visible = c > 3.4
        L.torque.show(c > 3.4)
        if (torque.visible) torque.position.y = 5.3 - Math.sin(Math.min(1, (c - 3.4) / 0.6) * Math.PI) * 0.15
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
      const d = instant ? 0 : 0.6
      // по умолчанию
      head.visible = i === 4
      oldWasher.visible = false
      washer.visible = true
      washer.position.y = 0.75
      torque.visible = false
      if (i !== 4) inj.position.y = 0
      for (const k of ['body', 'spring', 'needle', 'nozzle', 'washer', 'inlet', 'torque', 'pair']) L[k].show(false)
      L.press.show(i >= 1 && i <= 3)
      L.washer.set('Медная шайба')
      gP.visible = i >= 1 && i <= 3
      if (i === 0) {
        S.mode = 'still'
        to(S, 'P', 0, d)
        to(S, 'lift', 0, d)
        fFlow.amount = 0
        for (const k of ['body', 'spring', 'needle', 'nozzle', 'washer', 'inlet']) L[k].show(true)
      } else if (i === 1) {
        S.mode = 'still'
        to(S, 'lift', 0, d)
        to(S, 'P', 0.72, instant ? 0 : 2.2)
        fFlow.amount = 1
        fFlow.speed = 0.9
        L.inlet.show(true)
        L.needle.show(true)
      } else if (i === 2) {
        S.mode = 'cycle'
        S.period = 2.4
        fFlow.amount = 1
        L.nozzle.show(true)
        L.needle.show(true)
      } else if (i === 3) {
        S.mode = 'cycle'
        S.period = 4.2
        fFlow.amount = 1
        L.spring.show(true)
        L.needle.show(true)
      } else if (i === 4) {
        S.mode = 'still'
        to(S, 'P', 0, d)
        to(S, 'lift', 0, d)
        fFlow.amount = 0
        oldWasher.visible = !instant
        L.washer.set('Шайба — только новая').show(true)
        L.pair.show(true)
      }
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
