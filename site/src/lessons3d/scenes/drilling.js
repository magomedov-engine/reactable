// Сверление на сверлильном станке: разметка и керн, деталь в машинных тисках, ключ из патрона,
// сверление перпендикулярно с выводом сверла, стружка и СОЖ, выход сверла, зенковка, безопасность.
import { createStage, THREE, PALETTE, cylX, cylY, lathe } from '../stage.js'
import { holeBlock, drillGeo, particles, smooth, lerpRange } from './fastenersKit.js'

const STEPS = [
  { title: 'Разметка и керн', text: 'Центр отверстия размечают и накернивают: керн ставят точно в перекрестье и бьют молотком. Без керна сверло «уходит» в сторону.' },
  { title: 'Деталь в тисках, ключ — из патрона', text: 'Деталь только в машинных тисках, тиски закреплены или упёрты в стол. Сверло зажимают ключом и сразу вынимают ключ из патрона — при пуске он вылетит.' },
  { title: 'Сверлить перпендикулярно', text: 'Обороты — по таблице или ТК. Подавать плавно и часто выводить сверло, чтобы ушла стружка. Охлаждать или смазывать по технологии. Деталь показана в разрезе.' },
  { title: 'Выход сверла', text: 'Когда сверло выходит из детали, нажим уменьшают: сверло может «закусить» и провернуть деталь.' },
  { title: 'Зенковка', text: 'Зенковкой снимают фаску у входа в отверстие: под потайной винт, перед нарезанием резьбы и просто чтобы не было острой кромки.' },
  { title: 'Безопасность', text: 'Без перчаток: перчатку, рукав или волосы наматывает на сверло. Рукава застёгнуты, волосы убраны, очки на глазах. Стружку убирают щёткой и только при остановленном шпинделе, патрон рукой не тормозят.' },
]

const TOP = 0, H = 1.0
const R_H = 0.3, R_C = 0.48
const BIT = 2.0 // вылет сверла из патрона
const REST = 2.75 // низ патрона в верхнем положении
const TIP = R_H * Math.tan((31 * Math.PI) / 180)

export default {
  title: 'Сверление и зенковка',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { fov: 30, position: [3, 3, 7], target: [0, 0.5, 0] })
    const { root } = stage

    // стол, тиски, параллели
    const table = stage.mesh(new THREE.BoxGeometry(6, 0.3, 3.4), 'ironDark')
    table.position.y = -1.95
    root.add(table)
    const vBase = stage.mesh(new THREE.BoxGeometry(4.0, 0.5, 1.8), 'iron')
    vBase.position.y = -1.55
    const fixedJaw = stage.mesh(new THREE.BoxGeometry(0.5, 1.2, 1.8), 'iron')
    fixedJaw.position.set(-1.45, -0.9, 0)
    const movJaw = stage.mesh(new THREE.BoxGeometry(0.5, 1.2, 1.8), 'iron')
    root.add(vBase, fixedJaw, movJaw)
    const screw = stage.mesh(cylX(0.08, 1.6, 12), 'steelDark')
    screw.position.set(2.2, -1.1, 0)
    root.add(screw)
    for (const x of [-0.85, 0.85]) {
      const par = stage.mesh(new THREE.BoxGeometry(0.3, 0.3, 1.6), 'steelDark')
      par.position.set(x, -1.15, 0)
      root.add(par)
    }

    // деталь с отверстием (разрез включается при сверлении)
    const hb = holeBlock(stage, { W: 2.4, Dz: 1.5, H, top: TOP, rH: R_H, rC: R_C, kind: 'brass' })
    root.add(hb.group)
    const setCut = (on) => {
      hb.cut.constant = on ? 0 : 50
      hb.cap.visible = on
    }

    // разметка: перекрестье и керн
    const marks = new THREE.Group()
    const scribe = stage.mat('steelBlack', { roughness: 0.9 })
    for (const r of [0, Math.PI / 2]) {
      const l = stage.mesh(new THREE.BoxGeometry(1.2, 0.006, 0.014), scribe)
      l.rotation.y = r
      l.position.y = TOP + 0.004
      marks.add(l)
    }
    const dent = stage.mesh(new THREE.CircleGeometry(0.06, 16).rotateX(-Math.PI / 2), 'steelBlack')
    dent.position.y = TOP + 0.006
    marks.add(dent)
    root.add(marks)
    const punch = new THREE.Group()
    punch.add(stage.mesh(lathe([[0, 0], [0.07, 0.12], [0.09, 0.3], [0.09, 1.3], [0.07, 1.36], [0, 1.36]], 20), 'steelBlack'))
    root.add(punch)
    const hammer = new THREE.Group()
    const hHead = stage.mesh(new THREE.BoxGeometry(0.7, 0.26, 0.26), 'steelDark')
    const hHandle = stage.mesh(cylX(0.06, 1.6, 10), stage.mat('milk', { color: '#8a6a45', roughness: 0.8 }))
    hHandle.position.x = 0.95
    hammer.add(hHead, hHandle)
    root.add(hammer)

    // шпиндель: пиноль, патрон, сверло / зенковка, ключ патрона
    const head = stage.mesh(new THREE.BoxGeometry(1.6, 1.0, 1.4), 'iron')
    head.position.y = REST + 2.9
    root.add(head)
    const spindle = new THREE.Group()
    root.add(spindle)
    const quill = stage.mesh(cylY(0.3, 4.0, 24), 'chrome')
    quill.position.y = 0.7 + 2.0
    spindle.add(quill)
    const rot = new THREE.Group() // вращающаяся часть
    spindle.add(rot)
    rot.add(stage.mesh(lathe([[0, 0.02], [0.16, 0], [0.42, 0.22], [0.45, 0.7], [0, 0.7]], 6), 'steelDark')) // патрон (грани видно при вращении)
    const bit = stage.mesh(drillGeo({ r: R_H, len: BIT + 0.2, lead: 1.15 }), 'steelBlack')
    bit.position.y = -BIT
    rot.add(bit)
    const csink = stage.mesh(lathe([[0, 0], [0.62, 0.62], [0.22, 0.85], [0.22, 1.5], [0, 1.5]], 6), 'steelBlack') // 6 граней — режущие кромки
    csink.position.y = -1.2
    rot.add(csink)
    const key = new THREE.Group()
    const kShaft = stage.mesh(cylX(0.06, 0.5, 10), 'steelBlack')
    kShaft.position.x = 0.25
    const kBar = stage.mesh(cylY(0.05, 0.8, 10), 'steelBlack')
    kBar.position.x = 0.5
    key.add(kShaft, kBar)
    spindle.add(key)

    // СОЖ: трубка и капли; стружка
    const pipe = new THREE.Group()
    const p1 = stage.mesh(cylY(0.05, 1.6, 10), 'steelBlack')
    p1.position.set(-1.1, 2.0, -0.4)
    const p2 = stage.mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.0, 10).rotateZ(-Math.PI / 3.2), 'steelBlack')
    p2.position.set(-0.7, 0.95, -0.4)
    pipe.add(p1, p2)
    root.add(pipe)
    const NOZ = new THREE.Vector3(-0.32, 0.62, -0.3)
    const cool = particles(stage, new THREE.SphereGeometry(0.035, 8, 6), stage.mat('water', { emissive: '#1e3242' }), 30, { gravity: -7 })
    const chips = particles(stage, new THREE.TorusGeometry(0.06, 0.012, 4, 10, Math.PI * 1.4), stage.mat('brass'), 60, { gravity: -6 })
    root.add(cool.mesh, chips.mesh)

    // безопасность: зона вращения и «перчатка — нельзя»
    const zoneMat = stage.mat('bad', { transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })
    const zone = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 2.4, 32, 1, true), zoneMat)
    root.add(zone)
    const glove = new THREE.Group()
    const fabric = stage.mat('milk', { color: '#c9c2b4', roughness: 0.95 })
    const palm = stage.mesh(new THREE.BoxGeometry(0.5, 0.6, 0.16), fabric)
    glove.add(palm)
    for (let i = 0; i < 4; i++) {
      const f = stage.mesh(cylY(0.055, 0.38, 8), fabric)
      f.position.set(-0.18 + i * 0.12, 0.48, 0)
      glove.add(f)
    }
    const thumb = stage.mesh(cylY(0.06, 0.32, 8), fabric)
    thumb.position.set(-0.33, 0.12, 0)
    thumb.rotation.z = 0.8
    glove.add(thumb)
    const noMat = new THREE.MeshBasicMaterial({ color: PALETTE.bad, toneMapped: false })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 40), noMat)
    ring.position.y = 0.15
    const slash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.09, 0.09), noMat)
    slash.rotation.z = -Math.PI / 4
    slash.position.y = 0.15
    glove.add(ring, slash)
    glove.position.set(1.75, 1.6, 0.2)
    root.add(glove)
    const brush = new THREE.Group()
    const bHandle = stage.mesh(cylX(0.05, 0.9, 8), stage.mat('milk', { color: '#8a6a45', roughness: 0.8 }))
    bHandle.position.x = 0.55
    const bristles = stage.mesh(new THREE.BoxGeometry(0.25, 0.2, 0.4), 'rubber')
    brush.add(bHandle, bristles)
    brush.position.set(-1.9, -1.7, 1.1)
    brush.rotation.y = 0.5
    root.add(brush)

    // подписи
    const L = {
      punch: stage.label('керн — в перекрестье', punch, { offset: [0.1, 1.2, 0], side: 'right' }),
      vise: stage.label('деталь в тисках', new THREE.Vector3(-1.5, -0.3, 0.9), { side: 'left' }),
      key: stage.label('ключ — вынуть до пуска!', key, { offset: [0.6, 0.4, 0], side: 'right', tone: 'warn' }),
      feed: stage.label('', new THREE.Vector3(0.5, 2.2, 0), { side: 'right', tone: 'accent' }),
      cool: stage.label('СОЖ — по технологии', NOZ.clone().add(new THREE.Vector3(-0.6, 0.6, 0)), { side: 'left' }),
      exit: stage.label('к выходу — нажим меньше', new THREE.Vector3(0.4, -1.0, 0), { side: 'right', tone: 'warn' }),
      cs: stage.label('фаска', new THREE.Vector3(-R_C, TOP, 0), { side: 'left', tone: 'accent' }),
      glove: stage.label('без перчаток!', glove, { offset: [0, 0.85, 0], side: 'top', tone: 'warn' }),
      eyes: stage.label('очки, рукава застёгнуты', new THREE.Vector3(0, REST + 1.5, 0), { side: 'top' }),
      brush: stage.label('стружку — щёткой, шпиндель стоит', brush, { offset: [0, 0.2, 0], side: 'top' }),
    }
    const SHOW = [['punch'], ['vise', 'key'], ['feed', 'cool'], ['exit'], ['cs'], ['glove', 'eyes', 'brush']]

    const v = new THREE.Vector3(), p = new THREE.Vector3()
    let step = 0, t = 0, chipT = 0, coolT = 0
    const HOLD = [3, 5, 6.5, 4, 4, 2]
    const JAW_OPEN = 2.05, JAW_SHUT = 1.45
    stage.onFrame((dt) => {
      if (stage.playing) t += dt
      let k = t
      let spinY = REST, depth = 0, ch = 0, spin = 0, jaw = JAW_SHUT
      punch.visible = hammer.visible = key.visible = pipe.visible = zone.visible = glove.visible = brush.visible = false
      bit.visible = step !== 4
      csink.visible = step === 4
      marks.visible = step <= 1
      dent.visible = step >= 1
      if (step === 0) {
        k = t % 5
        punch.visible = hammer.visible = true
        punch.position.set(0, TOP + 0.6 * (1 - smooth(0.2, 1.0, k)), 0)
        // три удара
        const hit = (c) => Math.exp(-Math.pow((k - c) / 0.12, 2))
        const strike = Math.max(hit(1.6), hit(2.4), hit(3.2))
        hammer.position.set(0, TOP + 1.36 + 0.13 + (1 - strike) * 0.7 + (1 - smooth(0.6, 1.2, k)) * 1.5, 0)
        hammer.rotation.z = (1 - strike) * 0.3
        punch.position.y -= strike * 0.03
        dent.visible = k > 1.6
        dent.scale.setScalar(k > 3.2 ? 1 : k > 2.4 ? 0.75 : 0.5)
      } else if (step === 1) {
        k = t % 6.5
        jaw = lerpRange(JAW_OPEN, JAW_SHUT, smooth(0.3, 1.6, k))
        key.visible = k < 5.0
        const out = smooth(3.4, 4.6, k)
        key.position.set(0.42 + out * 0.8, 0.35, 0)
        key.rotation.x = smooth(2.0, 3.2, k) * Math.PI
        L.key.show(k > 1.6 && k < 5.0)
      } else if (step === 2) {
        k = t % 8
        pipe.visible = true
        // подача с выводом сверла: три захода
        const feed = 0.3 * smooth(0.6, 2.0, k) + 0.3 * smooth(2.8, 4.2, k) + 0.25 * smooth(5.0, 6.4, k)
        const lift = Math.max(Math.sin(clampT((k - 2.0) / 0.8) * Math.PI), Math.sin(clampT((k - 4.2) / 0.8) * Math.PI)) * (TOP + 0.9)
        depth = feed * H
        spinY = TOP + BIT - depth + lift + (1 - smooth(0, 0.6, k)) * (REST - BIT - TOP)
        spin = 1
        const cutting = k > 0.6 && lift < 0.05 && k < 6.4
        L.feed.set(lift > 0.05 ? 'вывели сверло — ушла стружка' : 'подача плавно, сверло ⟂ детали')
        if (stage.playing && cutting) spawnChips(dt, 26)
        coolT += stage.playing ? dt : 0
        if (stage.playing && coolT > 0.12) {
          coolT = 0
          cool.spawn(NOZ, v.set(0.5, -0.4, 0.15), { life: 0.6, spin: 0 })
        }
      } else if (step === 3) {
        k = t % 6
        pipe.visible = true
        const feed = lerpRange(0.85, 1.0 + (TIP + 0.25) / H, smooth(0.4, 4.0, k))
        depth = feed * H
        spinY = TOP + BIT - depth + smooth(4.4, 5.6, k) * (REST - BIT - TOP + depth)
        spin = 1
        if (stage.playing && k < 4.0) spawnChips(dt, 18)
      } else if (step === 4) {
        k = t % 6
        depth = H + TIP + 0.3
        ch = smooth(1.2, 3.2, k)
        // зенковка: вершина конуса на оси; касание кромки отверстия при y = TOP - c
        const c = ch * (R_C - R_H)
        const tipY = TOP - c - R_H
        spinY = tipY + 1.2 + (1 - smooth(0.2, 1.2, k)) * 1.2 + smooth(4.0, 5.0, k) * 1.4
        spin = 0.5
      } else if (step === 5) {
        depth = H + TIP + 0.3
        ch = 1
        zone.visible = glove.visible = brush.visible = true
        spinY = REST
        spin = 1
        zone.position.y = REST - BIT + 1.4
        zoneMat.opacity = 0.16 + 0.1 * Math.sin(t * 5)
        glove.rotation.y = Math.sin(t * 1.5) * 0.3
      }
      spindle.visible = head.visible = step !== 0
      movJaw.position.set(jaw, -0.9, 0)
      screw.position.x = jaw + 0.8
      spindle.position.y = spinY
      if (stage.playing) rot.rotation.y -= dt * 22 * spin
      setCut(step >= 2 && step <= 4)
      hb.set({ depth, chamfer: ch })
      chips.update(dt, -1.0)
      cool.update(dt, TOP)
    })
    function clampT(x) {
      return Math.max(0, Math.min(1, x))
    }
    // стружка: вылетает из отверстия и раскручивается по спирали
    function spawnChips(dt, rate) {
      chipT += dt * rate
      while (chipT > 1) {
        chipT -= 1
        const a = Math.random() * Math.PI * 2
        p.set(Math.cos(a) * R_H * 0.9, TOP + 0.05, Math.sin(a) * R_H * 0.9)
        // касательная (по вращению сверла) + вверх и наружу
        v.set(Math.cos(a) * 0.9 + Math.sin(a) * 1.4, 1.6 + Math.random(), Math.sin(a) * 0.9 - Math.cos(a) * 1.4)
        chips.spawn(p, v, { life: 1.6, size: 0.8 + Math.random() * 0.7, spin: 10 })
      }
    }

    const boxMark = new THREE.Box3(new THREE.Vector3(-1.4, -0.8, -0.9), new THREE.Vector3(1.4, 2.2, 0.9))
    const boxAll = new THREE.Box3(new THREE.Vector3(-2.2, -2.0, -1.2), new THREE.Vector3(2.4, 3.2, 1.2))
    const boxCut = new THREE.Box3(new THREE.Vector3(-1.6, -1.4, -0.9), new THREE.Vector3(1.6, 2.4, 0.9))
    const VIEW = [
      { box: boxMark, dir: [0.4, 0.9, 1] },
      { box: boxAll, dir: [0.45, 0.45, 1] },
      { box: boxCut, dir: [0.25, 0.35, 1] },
      { box: boxCut, dir: [0.25, 0.2, 1] },
      { box: boxCut, dir: [0.25, 0.5, 1] },
      { box: boxAll, dir: [0.45, 0.4, 1] },
    ]
    const apply = (i, instant) => {
      step = i
      t = stage.playing ? 0 : HOLD[i]
      chips.clear()
      cool.clear()
      for (const [n, l] of Object.entries(L)) l.show(SHOW[i].includes(n))
      const vw = VIEW[i]
      stage.fit(vw.box, { dir: vw.dir, pad: 0.8, ms: instant ? 0 : 900 })
      if (instant) stage.setHome()
    }
    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
