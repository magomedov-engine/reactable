// Разъёмные соединения: шпонка, шлицы, штифты, стопорное кольцо. Каждому — свой шаг
// и короткая анимация сборки. Валы — вдоль X.
import { createStage, THREE, PALETTE, cylX, cylY } from '../stage.js'
import { ph } from './joints-kit.js'

const STEPS = [
  { title: 'Шпонка', text: 'Шпонку ставят в паз вала плотно, без качки. Ступицу (шестерню, шкив) надевают, совместив её паз со шпонкой, ровно и без перекоса. Теперь вал и шестерня крутятся вместе: вращение передаёт шпонка.' },
  { title: 'Шлицы', text: 'Шлицы — много «шпонок» прямо на валу. Передают большой момент, а ступица может сдвигаться вдоль вала. Шлицы чистые, без забоин; если есть метки положения — совместить по ТК.' },
  { title: 'Штифты', text: 'Крышка садится на штифты: они задают точное положение. Если не идёт — не подбивать, а искать перекос. Потом болты: болт только прижимает, положение держат штифты.' },
  { title: 'Стопорное кольцо', text: 'Щипцами разводят кольцо ровно настолько, чтобы прошло по валу, и отпускают в канавку. Перегнутое кольцо ослабевает. Проверка: кольцо полностью в канавке и проворачивается.' },
]

// тело выдавливания вдоль X (профиль в плоскости YZ: x фигуры → −z, y → y)
const extrudeX = (shape, len) => new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 40 }).rotateY(Math.PI / 2).translate(-len / 2, 0, 0)
// профиль «круг с пазом сверху»
function notchedCircle(path, r, w, yBottom) {
  const x = w / 2
  const y = Math.sqrt(r * r - x * x)
  const a = Math.atan2(y, x)
  path.moveTo(x, y)
  path.absarc(0, 0, r, a, Math.PI - a, true)
  path.lineTo(-x, yBottom)
  path.lineTo(x, yBottom)
  path.closePath()
  return path
}
// шлицевой профиль: n выступов шириной w, вершины R, впадины r
function splinePts(n, R, r, w) {
  const pts = []
  const at = Math.asin(w / 2 / R), ar = Math.asin(w / 2 / r)
  for (let k = 0; k < n; k++) {
    const c = (k / n) * Math.PI * 2 + Math.PI / 2
    pts.push([r, c - ar], [R, c - at], [R, c], [R, c + at], [r, c + ar])
    const next = ((k + 1) / n) * Math.PI * 2 + Math.PI / 2
    for (let j = 1; j < 4; j++) pts.push([r, c + ar + ((next - ar - c - ar) * j) / 4])
  }
  return pts.map(([rr, a]) => new THREE.Vector2(rr * Math.cos(a), rr * Math.sin(a)))
}
function gearShape(z, rRoot, rTip) {
  const s = new THREE.Shape()
  const pts = []
  for (let k = 0; k < z; k++) {
    const a = (k / z) * Math.PI * 2, d = Math.PI / z
    pts.push([rRoot, a - d * 0.5], [rTip, a - d * 0.28], [rTip, a + d * 0.28], [rRoot, a + d * 0.5])
  }
  pts.forEach(([r, a], i) => (i ? s.lineTo(r * Math.cos(a), r * Math.sin(a)) : s.moveTo(r * Math.cos(a), r * Math.sin(a))))
  s.closePath()
  return s
}

const BOX = new THREE.Box3(new THREE.Vector3(-3, -1.5, -1.6), new THREE.Vector3(3.3, 2.2, 1.6))

export default {
  title: 'Шпонка, шлицы, штифты, стопорные кольца',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [4.2, 3.4, 7], target: [0, 0.3, 0], fov: 30, fit: BOX, pad: 0.95 })
    const { root } = stage
    const disposeList = []
    const v = new THREE.Vector3()

    // ================= 1. Шпонка
    const g1 = new THREE.Group()
    const turn1 = new THREE.Group() // всё, что вращается вместе
    g1.add(turn1)
    const sL = stage.mesh(cylX(0.6, 2.3, 40), 'steel')
    sL.position.x = -1.85
    const sR = stage.mesh(cylX(0.6, 2.3, 40), 'steel')
    sR.position.x = 1.85
    const sMid = stage.mesh(extrudeX(notchedCircle(new THREE.Shape(), 0.6, 0.3, 0.45), 1.4), 'steel')
    const key = stage.mesh(new THREE.BoxGeometry(1.3, 0.3, 0.29), 'steelBlack')
    const hubShape = gearShape(22, 1.32, 1.5)
    hubShape.holes.push(notchedCircle(new THREE.Path(), 0.61, 0.31, 0.77))
    const hub = stage.mesh(extrudeX(hubShape, 1.1), 'steelDark')
    turn1.add(sL, sR, sMid, key, hub)
    root.add(g1)

    // ================= 2. Шлицы
    const g2 = new THREE.Group()
    const turn2 = new THREE.Group()
    g2.add(turn2)
    const spShaft = stage.mesh(extrudeX(new THREE.Shape(splinePts(8, 0.6, 0.47, 0.2)), 4.2), 'steel')
    spShaft.position.x = 0.3
    const spEnd = stage.mesh(cylX(0.47, 1.4, 32), 'steel')
    spEnd.position.x = -2.4
    const hs = new THREE.Shape()
    hs.absarc(0, 0, 1.15, 0, Math.PI * 2, false)
    hs.holes.push(new THREE.Path(splinePts(8, 0.63, 0.5, 0.23).reverse()))
    const spHub = new THREE.Group()
    spHub.add(stage.mesh(extrudeX(hs, 1.2), 'steelDark'))
    // кольцевая канавка под вилку (две «щеки»)
    for (const x of [-0.6, 0.6]) {
      const ring = stage.mesh(cylX(1.35, 0.14, 48), 'steelDark')
      ring.position.x = x
      spHub.add(ring)
    }
    // метки положения на торцах
    const m2 = stage.mesh(new THREE.BoxGeometry(0.02, 0.2, 0.06), 'mark')
    m2.position.set(0.68, 0.95, 0)
    spHub.add(m2)
    const m3 = stage.mesh(new THREE.BoxGeometry(0.02, 0.12, 0.06), 'mark')
    m3.position.set(2.41, 0.53, 0)
    turn2.add(spShaft, spEnd, spHub, m3)
    root.add(g2)

    // ================= 3. Штифты
    const g3 = new THREE.Group()
    const block = stage.mesh(new THREE.BoxGeometry(3.6, 1.0, 2.4), 'ironDark')
    block.position.y = -1.0
    g3.add(block)
    const PIN = [[-1.4, 0.7], [1.4, -0.7]]
    const BOLT = [[-1.4, -0.7], [1.4, 0.7]]
    for (const [x, z] of PIN) {
      const p = stage.mesh(cylY(0.14, 0.9, 20), 'chrome')
      p.position.set(x, -0.5, z)
      g3.add(p)
    }
    for (const [x, z] of BOLT) {
      const h = stage.mesh(new THREE.CircleGeometry(0.2, 20).rotateX(-Math.PI / 2), 'rubber')
      h.position.set(x, -0.495, z)
      g3.add(h)
    }
    const cs = new THREE.Shape()
    cs.moveTo(-1.8, -1.2); cs.lineTo(1.8, -1.2); cs.lineTo(1.8, 1.2); cs.lineTo(-1.8, 1.2); cs.closePath()
    // фигура в XY, затем поворот: y фигуры → −z
    for (const [x, z] of PIN) cs.holes.push(new THREE.Path().absarc(x, -z, 0.15, 0, Math.PI * 2, true))
    for (const [x, z] of BOLT) cs.holes.push(new THREE.Path().absarc(x, -z, 0.21, 0, Math.PI * 2, true))
    const cover = stage.mesh(new THREE.ExtrudeGeometry(cs, { depth: 0.6, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2), 'steelDark')
    g3.add(cover)
    const bolts = BOLT.map(([x, z]) => {
      const b = new THREE.Group()
      const head = stage.mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 6), 'steelBlack')
      head.position.y = 0.12
      const sh = stage.mesh(cylY(0.17, 1.3, 16), 'steelBlack')
      sh.position.y = -0.65
      b.add(head, sh)
      b.position.set(x, 0, z)
      g3.add(b)
      return b
    })
    root.add(g3)

    // ================= 4. Стопорное кольцо
    const g4 = new THREE.Group()
    const c1 = stage.mesh(cylX(0.6, 3.82, 40), 'steel')
    c1.position.x = -1.09
    const c2 = stage.mesh(cylX(0.515, 0.1, 40), 'steel')
    c2.position.x = 0.87
    const c3 = stage.mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 40).rotateZ(Math.PI / 2), 'steel')
    c3.position.x = 1.72
    const c3e = stage.mesh(new THREE.CylinderGeometry(0.54, 0.6, 0.06, 40).rotateZ(-Math.PI / 2), 'steel')
    c3e.position.x = 2.55
    const part = stage.mesh(cylX(1.1, 0.9, 48), 'brass') // деталь, которую держит кольцо (втулка/шестерня)
    part.position.x = 0.36
    g4.add(c1, c2, c3, c3e, part)
    // кольцо с ушками
    const gap = 0.36, rIn = 0.53, rOut = 0.68, rLug = 0.88
    const a1 = Math.PI / 2 + gap, a2 = Math.PI / 2 - gap + Math.PI * 2, lug = 0.42
    const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)]
    const rs = new THREE.Shape()
    rs.moveTo(...P(rIn, a1))
    rs.lineTo(...P(rLug, a1))
    rs.absarc(0, 0, rLug, a1, a1 + lug, false)
    rs.lineTo(...P(rOut, a1 + lug))
    rs.absarc(0, 0, rOut, a1 + lug, a2 - lug, false)
    rs.lineTo(...P(rLug, a2 - lug))
    rs.absarc(0, 0, rLug, a2 - lug, a2, false)
    rs.lineTo(...P(rIn, a2))
    rs.absarc(0, 0, rIn, a2, a1, true)
    const lugA = [a1 + lug * 0.45, a2 - lug * 0.45]
    for (const a of lugA) rs.holes.push(new THREE.Path().absarc(...P(0.77, a), 0.05, 0, Math.PI * 2, true))
    const clip = new THREE.Group()
    const clipMesh = stage.mesh(new THREE.ExtrudeGeometry(rs, { depth: 0.08, bevelEnabled: false, curveSegments: 32 }).rotateY(Math.PI / 2).translate(-0.04, 0, 0), stage.mat('steelBlack', { color: '#2b2b2e', metalness: 0.6, roughness: 0.35 }))
    clip.add(clipMesh)
    g4.add(clip)
    // щипцы: две губки с наконечниками в ушках кольца + ручки
    const pliers = new THREE.Group()
    const jaws = lugA.map((a) => {
      const j = new THREE.Group()
      const tip = stage.mesh(cylX(0.035, 0.3, 8), 'chrome')
      tip.position.x = 0.1
      const arm = stage.mesh(new THREE.BoxGeometry(0.1, 1.3, 0.12), 'steelDark')
      arm.position.set(0.3, 0.55, 0)
      arm.rotation.z = -0.3
      const grip = stage.mesh(new THREE.BoxGeometry(0.16, 0.9, 0.18), stage.mat('bad', { color: '#8a3a30' }))
      grip.position.set(0.62, 1.55, 0)
      grip.rotation.z = -0.3
      j.add(tip, arm, grip)
      j.userData.a = a
      pliers.add(j)
      return j
    })
    g4.add(pliers)
    root.add(g4)

    const groups = [g1, g2, g3, g4]

    // ================= подписи
    const L = {
      key: stage.label('Шпонка', key, { offset: [0, 0.16, 0], side: 'top' }),
      slot: stage.label('Паз вала', new THREE.Vector3(-0.5, 0.6, 0), { side: 'top', tone: 'accent' }),
      hub: stage.label('Ступица (шестерня)', hub, { offset: [0, -1.5, 0], side: 'bottom' }),
      torque: stage.label('Вращение передаёт шпонка', new THREE.Vector3(-2.6, 0.6, 0), { side: 'top', tone: 'ok' }),
      spl: stage.label('Шлицы', new THREE.Vector3(2.0, 0.6, 0), { side: 'top' }),
      slide: stage.label('Ступица скользит вдоль вала', spHub, { offset: [0, -1.35, 0], side: 'bottom', tone: 'accent' }),
      mark: stage.label('Метки положения', new THREE.Vector3(2.42, 1.1, 0), { side: 'right' }),
      pin: stage.label('Штифт: точное положение', new THREE.Vector3(1.4, 0.1, -0.7), { side: 'right', tone: 'accent' }),
      bolt: stage.label('Болт: прижимает', bolts[0], { offset: [0, 0.3, 0], side: 'left' }),
      noHit: stage.label('Не идёт — не подбивать', new THREE.Vector3(-1.8, 0.7, 1.2), { side: 'left', tone: 'warn' }),
      clip: stage.label('Стопорное кольцо', clip, { offset: [0, -0.75, 0], side: 'bottom' }),
      groove: stage.label('Канавка', new THREE.Vector3(0.87, 0.55, 0.3), { side: 'right' }),
      pl: stage.label('Щипцы', pliers, { offset: [0.62, 2.1, 0], side: 'top' }),
      ok: stage.label('✔ Полностью в канавке', clip, { offset: [0, 0.8, 0], side: 'top', tone: 'ok' }),
    }
    const SHOW = [['key', 'hub', 'slot'], ['spl', 'slide', 'mark'], ['pin'], ['clip', 'groove', 'pl']]

    let step = 0, lt = 0, cyc = 0, rot = 0

    function pose(dt) {
      groups.forEach((g, i) => (g.visible = i === step))
      if (step === 0) {
        key.position.set(0, 0.6 + 1.3 * (1 - ph(lt, 0.2, 1.1)), 0)
        hub.position.x = 3.6 * (1 - ph(lt, 1.3, 2.7))
        L.slot.show(lt < 0.9)
        L.torque.show(lt > 2.8)
        if (lt > 2.8 && stage.playing) rot += dt * 1.4
        turn1.rotation.x = rot
      } else if (step === 1) {
        spHub.position.x = 0.8 + 0.8 * Math.sin(cyc * 1.4) * ph(lt, 0, 0.8)
        turn2.rotation.x = cyc * 0.9
      } else if (step === 2) {
        // крышка: сверху со сдвигом → совмещаем → опускаем на штифты → болты
        const dx = 0.3 * (1 - ph(lt, 1.6, 2.4))
        const y = -0.5 + 2.2 * (1 - ph(lt, 0, 1.4)) * 1 + 0.55 * (1 - ph(lt, 2.4, 3.3))
        cover.position.set(dx, Math.max(-0.5, y), 0)
        bolts.forEach((b, i) => {
          const k = ph(lt, 3.5 + i * 0.4, 4.4 + i * 0.4)
          b.visible = lt > 3.4 + i * 0.4
          b.position.y = 0.1 + 1.6 * (1 - k)
          b.rotation.y = k * 6
        })
        L.noHit.show(lt > 0.8 && lt < 2.2)
        L.bolt.show(lt > 4.6)
      } else if (step === 3) {
        // кольцо разводят, ведут по валу к канавке, отпускают; щипцы уходят; кольцо проворачивают
        const spread = ph(lt, 0.2, 0.8) * (1 - ph(lt, 2.6, 2.9))
        const s = 1 + 0.22 * spread
        const x = 3.4 - (3.4 - 0.87) * ph(lt, 1.0, 2.4)
        clip.position.x = x
        clip.scale.set(1, s, s)
        const away = ph(lt, 3.1, 3.7)
        pliers.position.set(x, 1.6 * away, 0)
        pliers.visible = away < 0.99
        jaws.forEach((j) => {
          const a = j.userData.a
          j.position.set(0, 0.77 * Math.sin(a) * s, -0.77 * Math.cos(a) * s)
        })
        clip.rotation.x = lt > 3.8 ? 0.35 * Math.sin((lt - 3.8) * 2.2) * ph(lt, 3.8, 4.3) : 0
        L.pl.show(away < 0.5)
        L.ok.show(lt > 3.8)
        L.groove.show(lt < 2.6)
      }
    }

    stage.onFrame((dt) => {
      lt += dt
      if (stage.playing) cyc += dt
      pose(dt)
    })

    function apply(i, instant) {
      step = i
      lt = instant ? 99 : 0
      rot = 0
      Object.entries(L).forEach(([k, l]) => l.show(SHOW[i].includes(k)))
      pose(0)
    }

    stage.ready()
    return stage.controller({
      setStep: (i, o) => apply(i, o?.instant),
      dispose() {
        disposeList.forEach((d) => d.dispose())
      },
    })
  },
}
