// Стопорение резьбы: гровер, стопорная шайба с усиками, корончатая гайка со шплинтом, контргайка, фиксатор.
// Общий стенд: шпилька в детали; на каждом шаге — свой способ, собирается анимацией.
import { createStage, THREE, PALETTE, lathe } from '../stage.js'
import { threadGeo, hexGeo, smooth, lerpRange, arcArrow } from './fastenersKit.js'

const STEPS = [
  { title: 'Пружинная шайба (гровер)', text: 'Разрезная шайба-пружина: гайка сжимает её, и она упруго подпирает гайку. Затяжку по моменту не заменяет. В двигателе её ставят только там, где указано в ТК.' },
  { title: 'Стопорная шайба с усиком', text: 'После затяжки один усик загибают на грань гайки, другой — за край детали. Гайка больше не провернётся. Шайба всегда новая, загиб без трещин.' },
  { title: 'Корончатая гайка и шплинт', text: 'Прорезь гайки совмещают с отверстием в болте, вставляют шплинт и разводят концы: один вверх, другой вниз по грани. Шплинт — всегда новый.' },
  { title: 'Контргайка', text: 'Основную гайку затягивают, затем вторую (контргайку) прижимают к ней, придерживая основную. Гайки «заклинивают» друг друга. Моменты — по ТК.' },
  { title: 'Фиксатор резьбы', text: 'Анаэробный фиксатор капают на чистую обезжиренную резьбу, затем наворачивают гайку. Без воздуха состав твердеет в резьбе. Марка — только из ТК.' },
]

const R = 0.4, P = 0.18, STUD_TOP = 1.75
const S = 1.2, NUT_H = 0.6
const EDGE = -1.0 // левый край детали (за него загибают усик)
const PERIOD = 7.5
const HOLD = 6.5

export default {
  title: 'Стопорение крепежа',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { fov: 30, position: [3.2, 3.4, 6.2], target: [0, 0.7, 0] })
    const { root } = stage

    // деталь и шпилька
    const block = stage.mesh(new THREE.BoxGeometry(2.9, 0.7, 2.2), 'iron')
    block.position.set(EDGE + 1.45, -0.35, 0)
    root.add(block)
    const stud = stage.mesh(threadGeo({ rMin: R - 0.1, rMaj: R, P, y0: -0.2, y1: STUD_TOP, fadeEnd: 0.12 }, { cols: 36 }), 'steel')
    root.add(stud)
    // поперечное отверстие под шплинт
    const crossHole = stage.mesh(new THREE.CylinderGeometry(0.075, 0.075, 2 * R + 0.02, 16).rotateZ(Math.PI / 2), 'rubber')
    root.add(crossHole)

    const nutGeo = hexGeo(S, NUT_H, R - 0.07)
    const nut = stage.mesh(nutGeo, 'steelDark')
    const jam = stage.mesh(hexGeo(S, 0.4, R - 0.07), 'steel')
    root.add(nut, jam)
    // гайка идёт по резьбе: поворот согласован с ходом (по часовой — вниз)
    const place = (m, y, y0 = 0) => {
      m.position.y = y
      m.rotation.y = ((y - y0) / P) * Math.PI * 2
    }

    // --- гровер: разрезное кольцо, концы разведены по высоте
    const grH = 0.12, grGap = 0.35
    const grGeo = new THREE.LatheGeometry(
      [[0.43, 0], [0.72, 0], [0.72, grH], [0.43, grH], [0.43, 0]].map(([r, y]) => new THREE.Vector2(r, y)),
      40, grGap / 2, Math.PI * 2 - grGap,
    )
    const grBase = grGeo.attributes.position.array.slice()
    const grFrac = new Float32Array(grBase.length / 3)
    for (let i = 0; i < grFrac.length; i++) {
      let a = Math.atan2(grBase[i * 3], grBase[i * 3 + 2]) // φ лате: x = r·sinφ, z = r·cosφ
      if (a < 0) a += Math.PI * 2
      grFrac[i] = (a - grGap / 2) / (Math.PI * 2 - grGap)
    }
    const grover = stage.mesh(grGeo, 'steelBlack')
    grover.rotation.y = Math.PI / 2 // разрез смотрит на зрителя
    root.add(grover)
    const setGrover = (off) => {
      const a = grGeo.attributes.position.array
      for (let i = 0; i < grFrac.length; i++) a[i * 3 + 1] = grBase[i * 3 + 1] + grFrac[i] * off
      grGeo.attributes.position.needsUpdate = true
      grGeo.computeVertexNormals()
    }

    // --- стопорная шайба с двумя усиками
    const tabW = new THREE.Group()
    const ringT = 0.06
    tabW.add(stage.mesh(lathe([[0.43, 0], [0.72, 0], [0.72, ringT], [0.43, ringT], [0.43, 0]], 40), 'chrome'))
    const flatUp = stage.mesh(new THREE.BoxGeometry(0.36, ringT, 0.08), 'chrome') // перемычка к усику вверх
    flatUp.position.set(0, ringT / 2, 0.66)
    const flatDn = stage.mesh(new THREE.BoxGeometry(-EDGE - 0.62, ringT, 0.36), 'chrome')
    flatDn.position.set((EDGE - 0.62) / 2, ringT / 2, 0)
    tabW.add(flatUp, flatDn)
    const hingeUp = new THREE.Group()
    hingeUp.position.set(0, 0, 0.7)
    const tabUp = stage.mesh(new THREE.BoxGeometry(0.36, ringT, 0.5), 'chrome')
    tabUp.position.set(0, ringT / 2, 0.25)
    hingeUp.add(tabUp)
    const hingeDn = new THREE.Group()
    hingeDn.position.set(EDGE, ringT, 0)
    const tabDn = stage.mesh(new THREE.BoxGeometry(0.45, ringT, 0.36), 'chrome')
    tabDn.position.set(-0.225, -ringT / 2, 0)
    hingeDn.add(tabDn)
    tabW.add(hingeUp, hingeDn)
    root.add(tabW)

    // --- корончатая гайка и шплинт
    const castle = new THREE.Group()
    castle.add(stage.mesh(hexGeo(S, 0.5, R - 0.07), 'steelDark').translateY(0.25).rotateY(Math.PI / 6)) // грань смотрит на шплинт
    const slotW = 0.32
    for (let k = 0; k < 6; k++) {
      const a0 = Math.PI / 2 + (k * Math.PI) / 3 + slotW / 2
      const g = new THREE.LatheGeometry([[R - 0.05, 0.5], [0.54, 0.5], [0.54, 0.84], [R - 0.05, 0.84], [R - 0.05, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 6, a0, Math.PI / 3 - slotW)
      castle.add(stage.mesh(g, 'steelDark'))
    }
    root.add(castle)
    const HOLE_Y = 0.7
    crossHole.position.y = HOLE_Y
    const pin = new THREE.Group()
    const wire = 0.045
    const legLen = 1.2
    const mkLeg = (dy) => {
      const leg = stage.mesh(new THREE.CylinderGeometry(wire, wire, legLen, 10).rotateZ(Math.PI / 2), 'brass')
      leg.position.set(-0.6 + legLen / 2, dy, 0)
      pin.add(leg)
      const hinge = new THREE.Group()
      hinge.position.set(0.64, dy, 0)
      const tail = stage.mesh(new THREE.CylinderGeometry(wire, wire, 0.42, 10).rotateZ(Math.PI / 2), 'brass')
      tail.position.x = 0.21
      hinge.add(tail)
      pin.add(hinge)
      return hinge
    }
    const tailUp = mkLeg(wire)
    const tailDn = mkLeg(-wire)
    const eye = stage.mesh(new THREE.TorusGeometry(0.1, wire, 8, 24), 'brass')
    eye.position.set(-0.7, 0, 0)
    pin.add(eye)
    pin.position.y = HOLE_Y
    root.add(pin)

    // --- фиксатор: флакон, капли, плёнка на резьбе
    const bottle = new THREE.Group()
    bottle.add(stage.mesh(lathe([[0, 0], [0.22, 0.05], [0.24, 0.6], [0.1, 0.72], [0.05, 0.95], [0, 0.98]], 24), 'milk'))
    bottle.rotation.z = Math.PI * 0.85
    bottle.position.set(0.805, 3.07, 0.2)
    root.add(bottle)
    const dropMat = stage.mat('water', { color: '#5f86b8', emissive: '#203a5a', roughness: 0.2 })
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), dropMat)
    root.add(drop)
    const filmMat = stage.mat('water', { color: '#5f86b8', transparent: true, opacity: 0.5, depthWrite: false })
    const film = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 1, 36, 1, true), filmMat)
    root.add(film)

    // --- стрелки
    const lockArrows = new THREE.Group()
    lockArrows.add(stage.arrow(new THREE.Vector3(0.9, 0.62, 0.7), new THREE.Vector3(0.9, 1.1, 0.7), PALETTE.bad, { head: 0.14, width: 0.12 }))
    lockArrows.add(stage.arrow(new THREE.Vector3(0.9, 0.58, 0.7), new THREE.Vector3(0.9, 0.1, 0.7), PALETTE.bad, { head: 0.14, width: 0.12 }))
    root.add(lockArrows)
    const turnArrow = arcArrow(0.95, 0.3, -1.4, PALETTE.milk)
    root.add(turnArrow)

    // подписи
    const L = {
      grover: stage.label('гровер', new THREE.Vector3(-0.72, 0.1, 0), { side: 'left' }),
      grNote: stage.label('пружинит', new THREE.Vector3(0.75, 0.15, 0.2), { side: 'right', tone: 'accent' }),
      tabUp: stage.label('усик на грань гайки', new THREE.Vector3(0, 0.55, 0.75), { side: 'right' }),
      tabDn: stage.label('усик за край детали', new THREE.Vector3(EDGE - 0.05, -0.3, 0), { side: 'left' }),
      pin: stage.label('шплинт — новый', new THREE.Vector3(-0.8, HOLE_Y, 0), { side: 'left' }),
      castle: stage.label('корончатая гайка', new THREE.Vector3(0.6, 0.3, 0.4), { side: 'right' }),
      jam: stage.label('контргайка', new THREE.Vector3(-0.65, 0.8, 0), { side: 'left' }),
      main: stage.label('основная', new THREE.Vector3(-0.65, 0.3, 0), { side: 'left' }),
      lock: stage.label('прижаты друг к другу', new THREE.Vector3(0.9, 1.15, 0.7), { side: 'top', tone: 'accent' }),
      drop: stage.label('фиксатор — марка по ТК', new THREE.Vector3(1.0, 3.0, 0.2), { side: 'right' }),
      clean: stage.label('резьба чистая, сухая', new THREE.Vector3(-0.45, 1.3, 0), { side: 'left', tone: 'accent' }),
    }
    const SHOW = [
      ['grover', 'grNote'],
      ['tabUp', 'tabDn'],
      ['pin', 'castle'],
      ['jam', 'main', 'lock'],
      ['drop', 'clean'],
    ]

    let step = 0, t = 0
    stage.onFrame((dt) => {
      if (stage.playing) t += dt
      const k = t % PERIOD
      const all = [nut, jam, grover, tabW, castle, pin, crossHole, bottle, drop, film, lockArrows, turnArrow]
      all.forEach((m) => (m.visible = false))
      const lockShown = k > 5.0
      if (step === 0) {
        grover.visible = nut.visible = true
        const ny = lerpRange(2.05, 0.42, smooth(0.2, 4.6, k))
        place(nut, ny)
        const flat = smooth(0.56, 0.42, ny)
        setGrover(0.16 * (1 - flat))
        L.grNote.show(flat > 0.95)
      } else if (step === 1) {
        tabW.visible = nut.visible = true
        place(nut, lerpRange(2.05, ringT + NUT_H / 2, smooth(0.2, 3.0, k)), ringT + NUT_H / 2)
        hingeUp.rotation.x = -Math.PI / 2 * smooth(3.3, 4.3, k)
        hingeDn.rotation.z = (Math.PI / 2) * smooth(4.5, 5.5, k)
      } else if (step === 2) {
        castle.visible = pin.visible = crossHole.visible = true
        place(castle, lerpRange(1.9, 0, smooth(0.2, 2.2, k)), 0)
        pin.position.x = lerpRange(-1.8, 0, smooth(2.5, 3.6, k))
        tailUp.rotation.z = (Math.PI / 2) * smooth(3.9, 4.7, k)
        tailDn.rotation.z = -(Math.PI / 2) * smooth(4.9, 5.7, k)
      } else if (step === 3) {
        nut.visible = jam.visible = true
        place(nut, lerpRange(2.05, NUT_H / 2, smooth(0.2, 2.4, k)))
        place(jam, lerpRange(1.95, NUT_H + 0.2, smooth(2.6, 4.6, k)))
        jam.visible = k > 2.4
        lockArrows.visible = lockShown
        turnArrow.visible = k > 2.6 && k < 4.8
        turnArrow.position.y = jam.position.y
        L.lock.show(lockShown)
      } else if (step === 4) {
        nut.visible = bottle.visible = true
        const d = (k - 0.4) % 0.8
        drop.visible = k > 0.4 && k < 2.8
        drop.position.set(0.36, lerpRange(2.2, 1.35, d / 0.8), 0.2)
        const grow = smooth(0.8, 2.8, k)
        film.visible = grow > 0.01
        film.scale.y = 0.9 * grow
        film.position.y = 1.4 - film.scale.y / 2
        place(nut, lerpRange(2.05, NUT_H / 2, smooth(3.2, 6.0, k)))
        nut.visible = k > 3.0
        bottle.visible = k < 3.2
        L.drop.show(k < 3.2)
        L.clean.show(k < 3.2)
      }
    })

    const fit = new THREE.Box3(new THREE.Vector3(-1.5, -0.7, -1.1), new THREE.Vector3(1.5, 2.0, 1.1))
    const fitTall = new THREE.Box3(new THREE.Vector3(-1.5, -0.7, -1.1), new THREE.Vector3(1.5, 3.2, 1.1))
    const apply = (i, instant) => {
      step = i
      t = stage.playing ? 0 : HOLD
      for (const [name, l] of Object.entries(L)) l.show(SHOW[i].includes(name))
      const ms = instant ? 0 : 800
      if (i === 1) stage.fit(fit, { dir: [-0.55, 0.6, 1], ms, pad: 0.78 })
      else stage.fit(i === 4 ? fitTall : fit, { dir: [0.5, 0.5, 1], ms, pad: 0.78 })
      if (instant) stage.setHome()
    }
    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
