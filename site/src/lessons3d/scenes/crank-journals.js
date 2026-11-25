// Коленчатый вал V12 (упрощённо): 7 коренных шеек, 6 шатунных (по два шатуна на шейку),
// щёки, противовесы, носок, фланец маховика, масляные каналы. Углы колен условные.
import { createStage, animator, THREE, PALETTE, cylX } from '../stage.js'
import { merge, cylBetween, annulusZ, particles, fitBox } from './ep-kit.js'

const STEPS = [
  { title: 'Коленчатый вал V12', text: 'Стальной вал с «коленями». Спереди носок, сзади фланец маховика. Обычно у V12 7 коренных и 6 шатунных шеек.' },
  { title: 'Коренные шейки', text: 'Коренные шейки — опоры вала. Они лежат во вкладышах в постелях блока (номера 1–7). Упорные полукольца держат вал от сдвига вдоль оси. Шейки не царапать и не трогать железом.' },
  { title: 'Шатунные шейки', text: 'Шатунные шейки смещены от оси вала — это «педали». В V-образном двигателе на каждой шейке работают два шатуна: от левого и от правого ряда.' },
  { title: 'Щёки и противовесы', text: 'Щёки соединяют коренные и шатунные шейки. Противовесы стоят напротив шатунных шеек и уравновешивают вал, чтобы он вращался без тряски.' },
  { title: 'Масляные каналы', text: 'Внутри вала просверлены каналы. Масло из блока приходит к коренной шейке и по каналу уходит к шатунной. Каналы должны быть чистыми и продутыми.' },
  { title: 'Носок и фланец', text: 'На носке — шестерня привода и шкив. На фланце сзади — маховик. Вал укладывают краном на мягких стропах, ровно, не ударяя шейками; после каждой крышки проверяют, что он крутится от руки.' },
]

export default {
  title: 'Коленчатый вал: шейки и каналы',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [5, 4, 11], target: [0, 0, 0], fov: 30 })
    const to = animator(stage)
    const { root } = stage

    const LM = 0.5, LW = 0.22, LP = 0.9, E = 0.85, RM = 0.45, RP = 0.4
    const PER = LM + 2 * LW + LP
    const X0 = -5.3
    const xMain = (j) => X0 + LM / 2 + PER * j
    const xPin = (j) => X0 + LM + LW + LP / 2 + PER * j
    const ANG = [0, 240, 120, 120, 240, 0].map((d) => (d * Math.PI) / 180)
    const pinPos = (j) => new THREE.Vector3(xPin(j), E * Math.cos(ANG[j]), E * Math.sin(ANG[j]))

    // ---------- щека и противовес: плоские фигуры, вытянутые вдоль X
    const webShape = new THREE.Shape()
    webShape.moveTo(0.6, -0.15)
    webShape.lineTo(0.62, E)
    webShape.absarc(0, E, 0.62, 0, Math.PI, false)
    webShape.lineTo(-0.6, -0.15)
    webShape.closePath()
    const R = 1.3, a0 = (215 * Math.PI) / 180, a1 = (325 * Math.PI) / 180
    const cwShape = new THREE.Shape()
    cwShape.moveTo(-0.6, -0.15)
    cwShape.lineTo(R * Math.cos(a0), R * Math.sin(a0))
    cwShape.absarc(0, 0, R, a0, a1, false)
    cwShape.lineTo(0.6, -0.15)
    cwShape.closePath()
    const plate = (shape, x, ang) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth: LW, bevelEnabled: false, curveSegments: 14 })
      g.rotateY(Math.PI / 2)
      g.rotateX(ang)
      g.translate(x, 0, 0)
      return g
    }

    const crank = new THREE.Group()
    root.add(crank)
    const mats = {
      main: stage.mat('chrome', {}),
      pin: stage.mat('chrome', {}),
      web: stage.mat('brass', {}),
      cw: stage.mat('brass', { color: '#94814f' }),
      nose: stage.mat('steel', {}),
      flange: stage.mat('steel', {}),
    }
    const mains = [], pins = [], webs = [], cws = []
    for (let j = 0; j < 7; j++) mains.push(cylX(RM, LM, 32).translate(xMain(j), 0, 0))
    for (let j = 0; j < 6; j++) {
      const p = pinPos(j)
      pins.push(cylX(RP, LP, 28).translate(p.x, p.y, p.z))
      for (const x of [X0 + LM + PER * j, X0 + LM + LW + LP + PER * j]) {
        webs.push(plate(webShape, x, ANG[j]))
        cws.push(plate(cwShape, x, ANG[j]))
      }
    }
    const meshes = {
      main: new THREE.Mesh(merge(mains), mats.main),
      pin: new THREE.Mesh(merge(pins), mats.pin),
      web: new THREE.Mesh(merge(webs), mats.web),
      cw: new THREE.Mesh(merge(cws), mats.cw),
    }
    // носок: вал, шестерня (зубья — короткие бруски), шкив
    const xs = X0 - 0.05
    const noseParts = [cylX(0.32, 1.6, 24).translate(xs - 0.8, 0, 0), cylX(0.55, 0.28, 32).translate(xs - 0.45, 0, 0), cylX(0.75, 0.3, 36).translate(xs - 1.35, 0, 0)]
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2
      noseParts.push(new THREE.BoxGeometry(0.28, 0.08, 0.08).translate(xs - 0.45, 0.6 * Math.cos(a), 0.6 * Math.sin(a)))
    }
    meshes.nose = new THREE.Mesh(merge(noseParts), mats.nose)
    // фланец с отверстиями под болты маховика
    const xe = xMain(6) + LM / 2
    const fl = new THREE.Shape()
    fl.absarc(0, 0, 1.15, 0, Math.PI * 2, false)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const h = new THREE.Path()
      h.absarc(0.82 * Math.cos(a), 0.82 * Math.sin(a), 0.09, 0, Math.PI * 2, true)
      fl.holes.push(h)
    }
    const flGeo = new THREE.ExtrudeGeometry(fl, { depth: 0.25, bevelEnabled: false, curveSegments: 20 })
    flGeo.rotateY(Math.PI / 2)
    flGeo.translate(xe + 0.3, 0, 0)
    meshes.flange = new THREE.Mesh(merge([cylX(0.5, 0.32, 28).translate(xe + 0.15, 0, 0), flGeo]), mats.flange)
    Object.values(meshes).forEach((m) => crank.add(m))

    // ---------- масляные каналы (внутри вала): коренная → шатунная
    const PATHS = []
    for (let j = 0; j < 6; j++) {
      const p = pinPos(j)
      const b = ANG[j] + Math.PI / 2 // вход масла на коренной шейке — сбоку от колена
      const m0 = new THREE.Vector3(xMain(j), RM * Math.cos(b), RM * Math.sin(b))
      const m1 = new THREE.Vector3(xMain(j), 0, 0)
      const out = new THREE.Vector3(p.x, p.y + RP * Math.cos(ANG[j]), p.z + RP * Math.sin(ANG[j]))
      PATHS.push([m0, m1, p, out])
    }
    const oilMat = stage.mat('oil', { emissive: PALETTE.oil, emissiveIntensity: 0.35 })
    const chanGeo = []
    for (const pts of PATHS) for (let k = 0; k < 3; k++) chanGeo.push(cylBetween(pts[k], pts[k + 1], 0.06, 8))
    const channels = new THREE.Mesh(merge(chanGeo), oilMat)
    crank.add(channels)
    const NP = 5
    const drops = particles(stage, 6 * NP, 0.07, '#f0cf7a')
    crank.add(drops)
    const segLen = PATHS.map((pts) => [0, 1, 2].map((k) => pts[k].distanceTo(pts[k + 1])))

    // ---------- вкладыши и упорные полукольца (не вращаются)
    const shellGeo = []
    for (let j = 0; j < 7; j++) shellGeo.push(annulusZ(RM + 0.01, RM + 0.07, Math.PI, Math.PI * 2, LM - 0.04, 32).rotateY(Math.PI / 2).translate(xMain(j), 0, 0))
    const shells = stage.mesh(merge(shellGeo), 'bronze')
    root.add(shells)
    const thrustGeo = [-1, 1].map((s) => annulusZ(RM + 0.02, 0.78, Math.PI, Math.PI * 2, 0.05, 32).rotateY(Math.PI / 2).translate(xMain(3) + s * (LM / 2 - 0.03), 0, 0))
    const thrust = stage.mesh(merge(thrustGeo), 'bronze')
    root.add(thrust)

    // ---------- два шатуна на первой шатунной шейке
    const rods = [-1, 1].map((side) => {
      const ring = new THREE.Mesh(annulusZ(RP + 0.01, 0.66, 0, Math.PI * 2 - 0.001, LP / 2 - 0.04, 32).rotateY(Math.PI / 2), stage.mat('steelDark'))
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 1).translate(0, 0, 0.5), stage.mat('steelDark'))
      root.add(ring, beam)
      const bank = new THREE.Vector3(0, Math.cos(Math.PI / 6), side * Math.sin(Math.PI / 6))
      return { ring, beam, bank, dx: side * (LP / 4) }
    })
    const ROD_L = 2.6
    const X_AXIS = new THREE.Vector3(1, 0, 0)
    const tmp = new THREE.Vector3(), sEnd = new THREE.Vector3()

    // ---------- стрелки «масло из блока»
    const inlets = [0, 1].map((j) => {
      const a = stage.arrow(new THREE.Vector3(xMain(j), -1.9, 0), new THREE.Vector3(xMain(j), -0.6, 0), PALETTE.oil, { head: 0.25, width: 0.18 })
      root.add(a)
      return a
    })

    // ---------- якоря подписей (вращаются с валом)
    const anchor = (x, y, z, parent = crank) => {
      const o = new THREE.Object3D()
      o.position.set(x, y, z)
      parent.add(o)
      return o
    }
    const aWeb = anchor(X0 + LM + PER * 1 + LW / 2, 0, 0)
    aWeb.rotation.x = ANG[1]
    const aWebP = anchor(0, 0.4, 0, aWeb)
    const aCwP = anchor(0, -1.2, 0, aWeb)
    const aPin = anchor(0, 0, 0)
    const aChan = anchor(0, 0, 0)
    aPin.position.copy(pinPos(2))
    aChan.position.copy(PATHS[1][2]).lerp(PATHS[1][1], 0.5)

    const L = {
      nose: stage.label('Носок', new THREE.Vector3(xs - 1.35, 0.8, 0), { side: 'top' }),
      flange: stage.label('Фланец маховика', new THREE.Vector3(xe + 0.42, 1.2, 0), { side: 'top' }),
      count: stage.label('7 коренных · 6 шатунных', new THREE.Vector3(0, -1.4, 0), { side: 'bottom', tone: 'accent' }),
      main: stage.label('Коренные шейки 1–7', new THREE.Vector3(xMain(2), -0.55, 0), { side: 'bottom', tone: 'accent' }),
      shell: stage.label('Вкладыши в постелях', new THREE.Vector3(xMain(5), -0.55, 0), { side: 'bottom' }),
      thrust: stage.label('Упорные полукольца', new THREE.Vector3(xMain(3), 0.78, 0), { side: 'top' }),
      pin: stage.label('Шатунная шейка', aPin, { side: 'right', tone: 'accent' }),
      rods: stage.label('Два шатуна: левый и правый ряд', new THREE.Vector3(xPin(0), 3.2, 0), { side: 'top' }),
      web: stage.label('Щека', aWebP, { side: 'top', tone: 'accent' }),
      cw: stage.label('Противовес', aCwP, { side: 'bottom', tone: 'accent' }),
      chan: stage.label('Масляный канал', aChan, { side: 'right', tone: 'accent' }),
      inlet: stage.label('Масло из блока', new THREE.Vector3(xMain(0), -1.9, 0), { side: 'bottom' }),
    }
    const showLabels = (keys) => Object.entries(L).forEach(([k, l]) => l.show(keys.includes(k)))

    // ---------- состояние
    const st = { speed: 0.4, xray: 0, rods: 0, shells: 0, hMain: 0, hPin: 0, hWeb: 0, hCw: 0, hEnds: 0, oil: 0 }
    const glow = new THREE.Color(PALETTE.oil)
    const glowCw = new THREE.Color(PALETTE.mark)
    let rot = 0, oilT = 0

    stage.onFrame((dt) => {
      if (stage.playing) {
        rot += dt * st.speed
        oilT += dt
      }
      crank.rotation.x = rot
      // подсветка
      const hl = { main: st.hMain, pin: st.hPin, web: st.hWeb, cw: st.hCw, nose: st.hEnds, flange: st.hEnds }
      for (const [k, m] of Object.entries(mats)) {
        m.emissive.copy(k === 'cw' ? glowCw : glow)
        m.emissiveIntensity = 0.5 * hl[k]
        const op = k === 'main' || k === 'pin' ? 1 - 0.55 * st.xray : 1 - 0.8 * st.xray
        const tr = op < 0.999
        if (m.transparent !== tr) {
          m.transparent = tr
          m.needsUpdate = true
        }
        m.opacity = op
        m.depthWrite = op > 0.999
      }
      shells.visible = thrust.visible = st.shells > 0.02
      shells.material.opacity = st.shells
      if (shells.material.transparent !== st.shells < 0.999) {
        shells.material.transparent = st.shells < 0.999
        shells.material.needsUpdate = true
      }
      channels.visible = drops.visible = st.oil > 0.02
      if (drops.visible) {
        drops.place((i, p) => {
          const j = Math.floor(i / NP)
          const k = ((oilT * 0.45 + (i % NP) / NP) % 1)
          const lens = segLen[j], tot = lens[0] + lens[1] + lens[2]
          let d = k * tot, s = 0
          while (s < 2 && d > lens[s]) d -= lens[s++]
          p.lerpVectors(PATHS[j][s], PATHS[j][s + 1], d / lens[s])
          return st.oil
        })
      }
      inlets.forEach((a) => (a.visible = st.oil > 0.5))
      // шатуны следуют за шейкой, стержень смотрит в свой ряд
      const pin0 = pinPos(0).applyAxisAngle(X_AXIS, rot)
      for (const r of rods) {
        const vis = st.rods > 0.02
        r.ring.visible = r.beam.visible = vis
        if (!vis) continue
        tmp.copy(pin0)
        tmp.x += r.dx
        r.ring.position.copy(tmp)
        r.ring.scale.setScalar(st.rods)
        const pd = tmp.y * r.bank.y + tmp.z * r.bank.z
        const perp2 = tmp.y * tmp.y + tmp.z * tmp.z - pd * pd
        const along = pd + Math.sqrt(Math.max(0, ROD_L * ROD_L - perp2))
        sEnd.set(tmp.x, r.bank.y * along, r.bank.z * along)
        r.beam.position.copy(tmp)
        r.beam.lookAt(sEnd)
        r.beam.scale.set(st.rods, st.rods, tmp.distanceTo(sEnd) * st.rods)
      }
    })

    const box = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b))
    const ALL = box([X0 - 1.6, -1.3, -1.3], [xe + 0.6, 1.3, 1.3])
    const VIEWS = [
      [ALL, [0.3, 0.45, 1]],
      [ALL, [0.2, 0.12, 1]],
      [box([X0 - 0.3, -1.3, -1.8], [X0 + PER + 0.5, 3.0, 1.8]), [-1, 0.3, 0.45]],
      [box([X0 - 1.8, -1.4, -1.4], [X0 + PER, 1.4, 1.4]), [-1, 0.5, 0.75]],
      [box([X0 - 0.3, -1.9, -1.2], [X0 + 2 * PER + 0.3, 1.3, 1.2]), [0.25, 0.4, 1]],
      [ALL, [-0.35, 0.45, 1]],
    ]

    const apply = (i, instant) => {
      const d = instant ? 0 : 0.7
      const set = (k, v) => to(st, k, v, d)
      set('speed', [0.4, 0.3, 0.6, 0.5, 0.25, 0.4][i])
      set('xray', i === 4 ? 1 : 0)
      set('rods', i === 2 ? 1 : 0)
      set('shells', i === 1 ? 1 : 0)
      set('hMain', i === 1 ? 1 : 0)
      set('hPin', i === 2 ? 1 : 0)
      set('hWeb', i === 3 ? 1 : 0)
      set('hCw', i === 3 ? 1 : 0)
      set('hEnds', i === 5 ? 1 : 0)
      set('oil', i === 4 ? 1 : 0)
      showLabels([['nose', 'flange', 'count'], ['main', 'shell', 'thrust'], ['pin', 'rods'], ['web', 'cw'], ['chan', 'inlet'], ['nose', 'flange']][i])
      const [bx, dir] = VIEWS[i]
      fitBox(stage, bx, dir, { pad: 1.12, ms: instant ? 0 : 900 })
      if (instant) stage.setHome()
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
