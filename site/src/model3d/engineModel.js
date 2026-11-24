// Схематичная 3D-модель V12-дизеля на three.js.
// Оси: X вдоль коленвала (перед двигателя: −X, маховик: +X), Y вверх, Z вбок.
// Ряды цилиндров наклонены на ±30° (развал 60°): левый ряд 1–6 (−Z), правый 7–12 (+Z).
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { PARTS, PART, SYSTEMS, STROKES } from './partsInfo.js'

const DEG = Math.PI / 180

// ---------- размеры (1 ед. ≈ 130 мм)
const R = 0.54 // радиус кривошипа (ход ≈ 140 мм)
const ROD = 2.0 // длина шатуна
const PITCH = 1.7 // шаг цилиндров в ряду
const OFF = 0.28 // сдвиг рядов вдоль вала (два шатуна на одной шейке)
const BETA = 30 * DEG // половина развала
const DECK = 3.1 // плоскость блока (по оси цилиндра)
const SEAT = 3.14 // сёдла клапанов
const CAM_Y = 2.1 // распредвал в развале
const CAM_R = 0.22 // базовый радиус кулачка
const LIFT_V = 0.2 // ход клапана
const ARM_V = 0.45 // плечо коромысла к клапану
const ARM_P = 0.5 // плечо коромысла к штанге
const LIFT_P = (LIFT_V * ARM_P) / ARM_V
const PIVOT = 4.14 // ось коромысел
const PUSH_W = 1.05 // штанги: расстояние от оси цилиндра в сторону развала
const GEAR_X = -6.05

export const FIRING = [1, 12, 5, 8, 3, 10, 6, 7, 2, 11, 4, 9]
const FIRE_AT = {} // цилиндр → угол начала рабочего хода (0…720°)
FIRING.forEach((c, i) => (FIRE_AT[c] = i * 60))
// углы шатунных шеек выводим из порядка работы: ВМТ левого цилиндра k — при θ ≡ −30° − o_k
const PIN_OFF = [0, 1, 2, 3, 4, 5].map((k) => (((-30 - FIRE_AT[k + 1]) % 360) + 360) % 360)

const IN_WIN = [340, 590] // впуск: открыт за 20° до ВМТ, закрыт через 50° после НМТ
const EX_WIN = [130, 380] // выпуск: открыт за 50° до НМТ, закрыт через 20° после ВМТ

function lift(psi, [a, b]) {
  if (psi < a || psi > b) return 0
  return Math.pow(Math.sin((Math.PI * (psi - a)) / (b - a)), 1.4)
}
const mod = (a, m) => ((a % m) + m) % m

export function strokeOf(psi) {
  return Math.floor(mod(psi, 720) / 180) // 0 рабочий ход, 1 выпуск, 2 впуск, 3 сжатие
}
export function cycleAt(thetaDeg) {
  const out = {}
  for (let c = 1; c <= 12; c++) out[c] = strokeOf(thetaDeg - FIRE_AT[c])
  return out
}

// ---------- помощники геометрии
const cylX = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2)
const cylZ = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2)
const PROFILE_M = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0))
// профиль в плоскости (y, z) → выдавливание вдоль X
function profile(shape, t, curveSegments = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments })
  g.translate(0, 0, -t / 2)
  g.applyMatrix4(PROFILE_M)
  g.computeVertexNormals()
  return g
}
const P = (a, r) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a))

function webShape(o) {
  const R1 = 0.52, R2 = 0.36
  const a = Math.acos((R1 - R2) / R)
  const s = new THREE.Shape()
  const c2 = new THREE.Vector2(R * Math.cos(o), R * Math.sin(o))
  s.moveTo(...P(o + a, R1).toArray())
  s.absarc(0, 0, R1, o + a, o + 2 * Math.PI - a, false)
  const t1 = P(o - a, R2).add(c2)
  s.lineTo(t1.x, t1.y)
  s.absarc(c2.x, c2.y, R2, o - a, o + a, false)
  s.closePath()
  return s
}
function counterweightShape(o) {
  const s = new THREE.Shape()
  const a1 = o + Math.PI - 1.15, a2 = o + Math.PI + 1.15
  s.moveTo(0, 0)
  s.lineTo(...P(a1, 0.95).toArray())
  s.absarc(0, 0, 0.95, a1, a2, false)
  s.closePath()
  return s
}
function gearShape(n, rp) {
  const ro = rp + 0.055, rr = rp - 0.065, p = (2 * Math.PI) / n
  const pts = []
  for (let i = 0; i < n; i++) {
    const a0 = i * p
    pts.push(P(a0, rr), P(a0 + 0.2 * p, ro), P(a0 + 0.45 * p, ro), P(a0 + 0.65 * p, rr))
  }
  const s = new THREE.Shape(pts)
  const hole = new THREE.Path()
  hole.absarc(0, 0, Math.min(0.22, rp * 0.35), 0, Math.PI * 2, true)
  s.holes.push(hole)
  return s
}
function lobeShape() {
  const pts = []
  const half = 62.5 * DEG
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    const d = Math.atan2(Math.sin(a), Math.cos(a)) // −π…π от «носика»
    const l = Math.abs(d) <= half ? Math.pow(Math.sin((Math.PI * (d + half)) / (2 * half)), 1.4) : 0
    pts.push(P(a, CAM_R + LIFT_P * l))
  }
  return new THREE.Shape(pts)
}

function numberTexture(n) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = 'rgba(17,22,30,0.82)'
  g.beginPath()
  g.arc(64, 64, 58, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#ffffff'
  g.font = 'bold 64px Inter, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(n), 64, 68)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  // градиент до самого края квадрата: на краях плоскости тень полностью прозрачна
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 127)
  grd.addColorStop(0, 'rgba(0,0,0,0.34)')
  grd.addColorStop(0.6, 'rgba(0,0,0,0.12)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

// ================================================================
export function createEngine(host, cb = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  host.appendChild(renderer.domElement)
  renderer.domElement.style.touchAction = 'none'

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  const sun = new THREE.DirectionalLight(0xffffff, 1.4)
  sun.position.set(-6, 14, 9)
  scene.add(sun, new THREE.AmbientLight(0xffffff, 0.25))

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200)
  camera.position.set(-15, 9, 15)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 1.3, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.09
  controls.minDistance = 4
  controls.maxDistance = 45
  controls.update()

  // ---------- материалы: по одному на тип детали (подсветка всего типа сразу)
  const mats = {}
  for (const p of PARTS) {
    mats[p.id] = new THREE.MeshStandardMaterial({
      color: p.color,
      metalness: p.metal ?? 0.5,
      roughness: p.rough ?? 0.45,
      side: p.double ? THREE.DoubleSide : THREE.FrontSide,
      envMapIntensity: 0.9,
    })
  }
  const root = new THREE.Group()
  scene.add(root)
  const placed = [] // объекты с базовой позицией и вектором «разборки»
  const meshesByPart = {}
  const geos = new Set()

  let explodeF = 0
  function reg(obj, partId, space, out = 1) {
    const e = PART[partId]?.explode
    const v = new THREE.Vector3()
    if (e?.bank && space === 'bank') v.set(0, e.bank[0], out * e.bank[1])
    if (e?.world) v.set(...e.world)
    obj.userData.base = obj.position.clone()
    obj.userData.exp = v
    placed.push(obj)
    return obj
  }
  function setPos(obj, x, y, z) {
    obj.userData.base.set(x, y, z)
    obj.position.copy(obj.userData.base).addScaledVector(obj.userData.exp, explodeF)
  }
  function mk(geo, partId, extra) {
    geos.add(geo)
    const m = new THREE.Mesh(geo, mats[partId])
    m.userData.part = partId
    if (extra) Object.assign(m.userData, extra)
    ;(meshesByPart[partId] ||= []).push(m)
    return m
  }

  // ---------- общие геометрии
  const G = {
    main: cylX(0.32, 0.42),
    pin: cylX(0.3, 0.96),
    bearing: new THREE.CylinderGeometry(0.37, 0.37, 0.5, 32, 1, true).rotateZ(Math.PI / 2),
    liner: new THREE.LatheGeometry(
      [[0.5, -1.075], [0.56, -1.075], [0.56, 0.98], [0.64, 0.98], [0.64, 1.075], [0.5, 1.075], [0.5, -1.075]].map(([r, y]) => new THREE.Vector2(r, y)),
      40,
    ),
    jacket: new THREE.CylinderGeometry(0.72, 0.72, 1.75, 32, 1, true),
    piston: new THREE.CylinderGeometry(0.48, 0.48, 0.95, 40),
    ring: new THREE.CylinderGeometry(0.505, 0.505, 0.045, 40),
    ppin: cylX(0.13, 0.78, 20),
    rodBig: cylX(0.4, 0.34, 28),
    rodShank: new THREE.BoxGeometry(0.3, ROD - 0.42, 0.2),
    rodSmall: cylX(0.19, 0.34, 20),
    head: new RoundedBoxGeometry(1.5, 0.8, 1.5, 3, 0.07),
    stem: new THREE.CylinderGeometry(0.045, 0.045, 0.95, 12),
    vhead: new THREE.CylinderGeometry(0.19, 0.06, 0.08, 24),
    rocker: new THREE.BoxGeometry(0.16, 0.12, 1.05),
    pushrod: new THREE.CylinderGeometry(0.045, 0.045, PIVOT - (CAM_Y * Math.cos(BETA) + CAM_R), 10),
    injector: new THREE.CylinderGeometry(0.085, 0.07, 1.2, 16),
    injTop: new THREE.CylinderGeometry(0.13, 0.13, 0.14, 16),
    lobe: profile(lobeShape(), 0.2, 4),
    flash: new THREE.CylinderGeometry(0.46, 0.46, 0.05, 32),
  }
  Object.values(G).forEach((g) => geos.add(g))
  const PUSH_LEN = G.pushrod.parameters.height

  // ---------- корпус
  const crankcase = reg(mk(new RoundedBoxGeometry(11.2, 2.3, 3.3, 3, 0.18), 'block'), 'block', 'world')
  crankcase.position.set(0, -0.35, 0)
  crankcase.userData.base.copy(crankcase.position)
  root.add(crankcase)

  const pan = reg(mk(new RoundedBoxGeometry(10.8, 0.95, 3.1, 3, 0.2), 'oilpan'), 'oilpan', 'world')
  pan.position.set(0, -1.98, 0)
  pan.userData.base.copy(pan.position)
  root.add(pan)
  const sump = mk(new RoundedBoxGeometry(3.6, 0.7, 1.8, 3, 0.15), 'oilpan')
  sump.position.set(1.6, -0.75, 0)
  pan.add(sump)
  const oil = reg(mk(new THREE.BoxGeometry(10.5, 0.4, 2.85), 'oil'), 'oil', 'world')
  oil.position.set(0, -2.2, 0)
  oil.userData.base.copy(oil.position)
  root.add(oil)
  const oilSump = mk(new THREE.BoxGeometry(3.4, 0.6, 1.6), 'oil')
  oilSump.position.set(1.6, -0.5, 0)
  oil.add(oilSump)

  // ---------- коленвал
  const crankG = reg(new THREE.Group(), 'crank', 'world')
  root.add(crankG)
  for (let i = 0; i < 7; i++) {
    const m = mk(G.main, 'crank')
    m.position.x = PITCH * (i - 3)
    crankG.add(m)
    const b = reg(mk(G.bearing, 'bearing'), 'bearing', 'world')
    b.position.x = PITCH * (i - 3)
    b.userData.base.copy(b.position)
    root.add(b)
  }
  for (let k = 0; k < 6; k++) {
    const xk = PITCH * (k - 2.5)
    const o = PIN_OFF[k] * DEG
    const pin = mk(G.pin, 'crank')
    pin.position.set(xk, R * Math.cos(o), R * Math.sin(o))
    crankG.add(pin)
    const web = profile(webShape(o), 0.16)
    const cw = profile(counterweightShape(o), 0.16)
    for (const dx of [-0.56, 0.56]) {
      const w = mk(web, 'crank')
      w.position.x = xk + dx
      const c = mk(cw, 'crank')
      c.position.x = xk + dx
      crankG.add(w, c)
    }
  }
  const nose = mk(cylX(0.3, 1.25), 'crank')
  nose.position.x = -5.31 - 0.62
  const flange = mk(cylX(0.78, 0.8), 'crank')
  flange.position.x = 5.31 + 0.4
  crankG.add(nose, flange)

  // маховик
  const fly = reg(new THREE.Group(), 'flywheel', 'world')
  fly.position.x = 6.42
  fly.userData.base.copy(fly.position)
  const flyDisc = mk(cylX(1.35, 0.45, 64), 'flywheel')
  const ring = mk(cylX(1.48, 0.22, 90), 'flywheel')
  ring.position.x = 0.1
  const flyMark = mk(new THREE.BoxGeometry(0.05, 0.42, 0.1), 'gearmark')
  flyMark.position.set(0.24, 1.1, 0)
  fly.add(flyDisc, ring, flyMark)
  root.add(fly)

  // ---------- шестерни ГРМ (плоскость перед блоком)
  const NC = 18, NI = 18, NK = 36
  const rpOf = (n) => n / 36 // модуль 1/18
  const gC = new THREE.Vector2(0, 0) // (y, z)
  const gK = new THREE.Vector2(CAM_Y, 0)
  const dCI = rpOf(NC) + rpOf(NI), dIK = rpOf(NI) + rpOf(NK), dCK = CAM_Y
  const A = Math.acos((dCI * dCI + dCK * dCK - dIK * dIK) / (2 * dCI * dCK))
  const gI = new THREE.Vector2(dCI * Math.cos(A), dCI * Math.sin(A))
  const th1 = Math.atan2(gI.y - gC.y, gI.x - gC.x)
  const th2 = Math.atan2(gK.y - gI.y, gK.x - gI.x)
  // начальные повороты, при которых зубья входят во впадины
  const meshOffset = (thetaLine, rotA, nA, nB) => {
    const pA = mod(((thetaLine - rotA) * nA) / (2 * Math.PI), 1)
    return thetaLine + Math.PI - ((0.5 - pA) * 2 * Math.PI) / nB
  }
  const rotI0 = meshOffset(th1, 0, NC, NI)
  const rotK0 = meshOffset(th2, rotI0, NI, NK)

  function gear(n, center, label) {
    const g = reg(mk(profile(gearShape(n, rpOf(n)), 0.3, 6), 'gear', { label }), 'gear', 'world')
    g.position.set(GEAR_X, center.x, center.y)
    g.userData.base.copy(g.position)
    root.add(g)
    return g
  }
  const gearC = gear(NC, gC, 'Шестерня коленвала')
  const gearI = gear(NI, gI, 'Промежуточная шестерня')
  const gearK = gear(NK, gK, 'Шестерня распредвала')
  const markGeo = new THREE.SphereGeometry(0.06, 16, 12)
  geos.add(markGeo)
  const blueMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.4 })
  function mark(g, localAngle, rp, blue) {
    const m = mk(markGeo, 'gearmark')
    if (blue) m.material = blueMat
    m.position.set(-0.17, (rp - 0.13) * Math.cos(localAngle), (rp - 0.13) * Math.sin(localAngle))
    g.add(m)
  }
  mark(gearC, th1, rpOf(NC))
  mark(gearI, th1 + Math.PI - rotI0, rpOf(NI))
  mark(gearI, th2 - rotI0, rpOf(NI), true)
  mark(gearK, th2 + Math.PI - rotK0, rpOf(NK), true)

  // ---------- распредвал в развале
  const camG = reg(new THREE.Group(), 'camshaft', 'world')
  root.add(camG)
  const camShaft = mk(cylX(0.16, 11.3), 'camshaft')
  camShaft.position.set(-0.4, CAM_Y, 0)
  camG.add(camShaft)

  // ---------- ряды цилиндров
  const banks = {}
  for (const side of ['L', 'R']) {
    const g = new THREE.Group()
    g.rotation.x = side === 'R' ? BETA : -BETA
    root.add(g)
    banks[side] = g
    const out = side === 'R' ? 1 : -1
    const shift = side === 'R' ? OFF : -OFF
    // блок ряда
    const bb = reg(mk(new RoundedBoxGeometry(10.2, 2.2, 1.6, 3, 0.12), 'block'), 'block', 'bank', out)
    bb.position.set(shift, 2.0, 0)
    bb.userData.base.copy(bb.position)
    g.add(bb)
    // клапанная крышка
    const cv = reg(mk(new RoundedBoxGeometry(10.3, 0.55, 2.1, 3, 0.16), 'cover'), 'cover', 'bank', out)
    cv.position.set(shift, 4.2, -out * 0.2)
    cv.userData.base.copy(cv.position)
    g.add(cv)
    // выпускной коллектор + турбокомпрессор
    const mex = reg(new THREE.Group(), 'manifold_ex', 'bank', out)
    mex.position.set(shift, 3.5, out * 1.35)
    mex.userData.base.copy(mex.position)
    const pipe = mk(cylX(0.27, 10.4), 'manifold_ex')
    pipe.position.x = 0.2
    mex.add(pipe)
    for (let k = 0; k < 6; k++) {
      const st = mk(cylZ(0.19, 0.62, 16), 'manifold_ex')
      st.position.set(PITCH * (k - 2.5), 0, -out * 0.3)
      mex.add(st)
    }
    g.add(mex)
    const tur = reg(new THREE.Group(), 'turbine', 'bank', out)
    tur.position.set(shift + 5.75, 3.5, out * 1.35)
    tur.userData.base.copy(tur.position)
    const tH = mk(cylX(0.62, 0.62, 40), 'turbine')
    const core = mk(cylX(0.26, 0.5, 20), 'turbine')
    core.position.x = 0.55
    tur.add(tH, core)
    g.add(tur)
    const comp = reg(mk(cylX(0.55, 0.55, 40), 'compressor'), 'compressor', 'bank', out)
    comp.position.set(shift + 6.85, 3.5, out * 1.35)
    comp.userData.base.copy(comp.position)
    g.add(comp)
  }

  // впускной коллектор в развале
  const mIn = reg(new THREE.Group(), 'manifold_in', 'world')
  root.add(mIn)
  const inPipe = mk(cylX(0.4, 10.2), 'manifold_in')
  inPipe.position.set(0, 3.08, 0)
  mIn.add(inPipe)
  // ТНВД, насосы, фильтр
  const pump = reg(mk(new RoundedBoxGeometry(1.2, 0.85, 0.8, 3, 0.1), 'pump'), 'pump', 'world')
  pump.position.set(5.85, 3.0, 0)
  pump.userData.base.copy(pump.position)
  root.add(pump)
  const wp = reg(new THREE.Group(), 'waterpump', 'world')
  wp.position.set(GEAR_X + 0.05, -0.75, -1.35)
  wp.userData.base.copy(wp.position)
  wp.add(mk(cylX(0.55, 0.45, 40), 'waterpump'))
  const wpPipe = mk(cylZ(0.17, 0.9, 16), 'waterpump')
  wpPipe.position.set(0, 0, -0.55)
  wp.add(wpPipe)
  root.add(wp)
  const op = reg(mk(new RoundedBoxGeometry(0.6, 0.6, 0.8, 3, 0.08), 'oilpump'), 'oilpump', 'world')
  op.position.set(-5.85, -1.15, 1.0)
  op.userData.base.copy(op.position)
  root.add(op)
  const of = reg(mk(new THREE.CylinderGeometry(0.36, 0.36, 1.0, 32), 'oilfilter'), 'oilfilter', 'world')
  of.position.set(-2.2, -0.5, 1.95)
  of.userData.base.copy(of.position)
  root.add(of)

  // ---------- цилиндры
  const cyls = []
  const flashMats = []
  const sprites = []
  for (let c = 1; c <= 12; c++) {
    const side = c <= 6 ? 'L' : 'R'
    const out = side === 'R' ? 1 : -1
    const k = (c - 1) % 6
    const g = banks[side]
    const x = PITCH * (k - 2.5) + (side === 'R' ? OFF : -OFF)
    const beta = side === 'R' ? BETA : -BETA
    const inf = { cyl: c }
    const add = (obj, partId) => {
      obj.traverse((o) => o.isMesh && Object.assign(o.userData, inf))
      g.add(obj)
      return reg(obj, partId, 'bank', out)
    }
    const liner = mk(G.liner, 'liner', inf)
    liner.position.set(x, 2.025, 0)
    add(liner, 'liner')
    const jacket = mk(G.jacket, 'jacket', inf)
    jacket.position.set(x, 2.05, 0)
    add(jacket, 'jacket')
    const head = mk(G.head, 'head', inf)
    head.position.set(x, 3.5, 0)
    add(head, 'head')
    const inj = new THREE.Group()
    const injBody = mk(G.injector, 'injector')
    injBody.position.y = 0
    const injTop = mk(G.injTop, 'injector')
    injTop.position.y = 0.6
    inj.add(injBody, injTop)
    inj.position.set(x, 3.75, 0)
    add(inj, 'injector')

    const piston = mk(G.piston, 'piston', inf)
    add(piston, 'piston')
    const rings = new THREE.Group()
    for (const dy of [0.4, 0.31, 0.22]) {
      const r = mk(G.ring, 'rings')
      r.position.y = dy
      rings.add(r)
    }
    add(rings, 'rings')
    const ppin = mk(G.ppin, 'pin', inf)
    add(ppin, 'pin')
    const rod = new THREE.Group()
    const rb = mk(G.rodBig, 'rod')
    const rs = mk(G.rodShank, 'rod')
    rs.position.y = 0.3 + (ROD - 0.42) / 2
    const rsm = mk(G.rodSmall, 'rod')
    rsm.position.y = ROD
    rod.add(rb, rs, rsm)
    add(rod, 'rod')

    const fm = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0, depthWrite: false })
    flashMats.push(fm)
    const flash = new THREE.Mesh(G.flash, fm)
    flash.userData.noPick = true
    g.add(flash)

    const valves = []
    for (const [type, dx] of [['valve_in', -0.3], ['valve_ex', 0.3]]) {
      const xv = x + dx
      const v = new THREE.Group()
      const stem = mk(G.stem, type)
      stem.position.y = 0.475
      const vh = mk(G.vhead, type)
      vh.position.y = -0.02
      v.add(stem, vh)
      v.position.set(xv, SEAT, 0)
      add(v, type)
      const rk = new THREE.Group()
      const rkm = mk(G.rocker, 'rocker')
      rkm.position.z = -out * 0.025
      rk.add(rkm)
      rk.position.set(xv, PIVOT, -out * 0.55)
      add(rk, 'rocker')
      const pr = mk(G.pushrod, 'pushrod')
      pr.position.set(xv, 0, -out * PUSH_W)
      add(pr, 'pushrod')
      // кулачок: «носик» смотрит на штангу в момент максимального подъёма
      const peak = type === 'valve_in' ? (IN_WIN[0] + IN_WIN[1]) / 2 : (EX_WIN[0] + EX_WIN[1]) / 2
      const delta = (beta / DEG - (FIRE_AT[c] + peak) / 2) * DEG
      const lobe = mk(G.lobe, 'camshaft', inf)
      lobe.position.set(xv, CAM_Y, 0)
      camG.add(lobe)
      valves.push({ type, v, rk, pr, lobe, delta, xv })
    }

    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTexture(c), depthTest: false, transparent: true }))
    sp.scale.set(0.62, 0.62, 1)
    sp.position.set(x, 5.05, -out * 0.2)
    sp.renderOrder = 10
    sp.userData.noPick = true
    g.add(sp)
    sprites.push(sp)

    cyls.push({ c, side, out, x, beta, piston, rings, ppin, rod, flash, fm, valves, sprite: sp })
  }

  // тень под двигателем
  const shadowTex = shadowTexture()
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(22, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }))
  shadow.position.y = -3.25
  shadow.userData.noPick = true
  root.add(shadow)

  // ================================================================
  // кинематика
  let theta = 40 // градусы, 0…720
  function update() {
    const th = theta * DEG
    crankG.rotation.x = th
    fly.rotation.x = th
    gearC.rotation.x = th
    gearI.rotation.x = rotI0 - th * (NC / NI)
    gearK.rotation.x = rotK0 + th * (NC / NK)
    for (const cy of cyls) {
      const kk = (cy.c - 1) % 6
      const d = th + PIN_OFF[kk] * DEG - cy.beta
      const sp = R * Math.cos(d)
      const np = R * Math.sin(d)
      const sPin = sp + Math.sqrt(ROD * ROD - np * np)
      setPos(cy.piston, cy.x, sPin + 0.025, 0)
      setPos(cy.rings, cy.x, sPin, 0)
      setPos(cy.ppin, cy.x, sPin, 0)
      setPos(cy.rod, cy.x, sp, np)
      cy.rod.rotation.x = Math.atan2(-np, sPin - sp)
      const psi = mod(theta - FIRE_AT[cy.c], 720)
      // вспышка: начало рабочего хода
      const f = psi < 50 ? 1 - psi / 50 : 0
      cy.fm.opacity = f * 0.85 * flashScale
      cy.flash.visible = f > 0.01 && flashScale > 0
      cy.flash.position.set(cy.x, sPin + 0.53 + explodeF * PART.piston.explode.bank[0], 0)
      for (const va of cy.valves) {
        const l = lift(psi, va.type === 'valve_in' ? IN_WIN : EX_WIN)
        setPos(va.v, va.xv, SEAT - l * LIFT_V, 0)
        va.rk.rotation.x = cy.out * Math.asin((l * LIFT_V) / ARM_V)
        const sBot = CAM_Y * Math.cos(BETA) + CAM_R + l * LIFT_P
        setPos(va.pr, va.xv, sBot + PUSH_LEN / 2, -cy.out * PUSH_W)
        va.lobe.rotation.x = th / 2 + va.delta
      }
    }
  }

  // ================================================================
  // внешний вид: подсветка, слои, прозрачность корпуса
  const state = { selected: null, hover: null, layer: 'all', casing: 0.3, cylinder: null }
  let flashScale = 1
  const accent = new THREE.Color('#f59e0b')
  function applyLook() {
    for (const p of PARTS) {
      const m = mats[p.id]
      let op = p.opacity ?? 1
      if (p.casing) op = state.casing
      let emis = 0x000000
      let emisI = 0
      if (state.layer !== 'all') {
        if (p.system === state.layer) {
          emis = new THREE.Color(SYSTEMS[p.system].color)
          emisI = 0.35
          if (p.casing || p.id === 'jacket') op = Math.max(op, 0.45)
        } else op *= p.casing ? 0.35 : 0.14
      }
      if (state.selected) {
        if (p.id === state.selected || (state.selected === 'gear' && p.id === 'gearmark')) {
          op = p.id === 'jacket' ? 0.55 : p.id === 'oil' ? 0.85 : 1
          emis = accent
          emisI = 0.32
        } else op *= p.casing ? 0.25 : 0.16
      } else if (state.hover === p.id) {
        emis = accent
        emisI = 0.18
      }
      const tr = op < 0.99
      if (m.transparent !== tr) m.needsUpdate = true
      m.transparent = tr
      m.opacity = op
      m.depthWrite = op > 0.6
      m.emissive.set(emis)
      m.emissiveIntensity = emisI
      for (const mesh of meshesByPart[p.id] || []) mesh.visible = op > 0.015
    }
    blueMat.opacity = mats.gearmark.opacity
    blueMat.transparent = mats.gearmark.transparent
    flashScale = state.selected || state.layer !== 'all' ? 0.35 : 1
    for (const cy of cyls) cy.sprite.material.color.set(state.cylinder === cy.c ? '#f59e0b' : '#ffffff')
    dirty = true
  }

  // ================================================================
  // выбор мышью / пальцем
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hits = ray.intersectObject(root, true).filter((h) => {
      const p = h.object.userData.part
      if (!p || h.object.userData.noPick || !h.object.visible) return false
      const info = PART[p]
      if (info.pickable === false && state.selected !== p && state.layer !== 'water') return false
      return h.object.material.opacity > 0.12 || state.selected === p
    })
    if (!hits.length) return null
    // сквозь полупрозрачный корпус выбираем то, что внутри
    const solid = hits.find((h) => !PART[h.object.userData.part].casing || h.object.material.opacity > 0.9)
    return solid || hits[0]
  }

  const el = renderer.domElement
  let down = null
  el.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() }
  })
  el.addEventListener('pointerup', (e) => {
    if (!down) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    down = null
    if (moved > 6) return
    const h = pick(e)
    if (h) {
      selectedMesh = h.object
      cb.onPick?.(h.object.userData.part, { cyl: h.object.userData.cyl, label: h.object.userData.label })
    } else cb.onPick?.(null)
  })
  el.addEventListener('dblclick', (e) => {
    const h = pick(e)
    if (h) focusObject(h.object)
  })
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return
    const h = pick(e)
    const p = h?.object.userData.part || null
    if (p !== state.hover) {
      state.hover = p
      el.style.cursor = p ? 'pointer' : 'grab'
      applyLook()
    }
    cb.onHover?.(p, e.clientX, e.clientY, h?.object.userData.cyl)
  })
  el.addEventListener('pointerleave', () => {
    if (state.hover) {
      state.hover = null
      applyLook()
    }
    cb.onHover?.(null)
  })

  // ================================================================
  // камера: плавные перелёты
  let tween = null
  // во «вытянутом вверх» окне отодвигаем камеру, чтобы двигатель помещался целиком
  // расстояние, на котором сфера радиусом ~7 ед. (двигатель) помещается и по ширине, и по высоте
  function fitScale() {
    const vf = (camera.fov * Math.PI) / 180
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect)
    const d = 7 / Math.sin(Math.min(vf, hf) / 2)
    return Math.min(3, Math.max(0.85, d / 22.6))
  }
  function viewPos(name) {
    const [p, tg] = VIEWS[name]
    return [tg.clone().add(p.clone().sub(tg).multiplyScalar(fitScale())), tg.clone()]
  }
  function flyTo(pos, target, ms = 750) {
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), ms }
  }
  const box = new THREE.Box3()
  const tmpV = new THREE.Vector3()
  function focusObject(obj) {
    box.setFromObject(obj)
    const c = box.getCenter(new THREE.Vector3())
    const size = Math.max(box.getSize(tmpV).length(), 1.2)
    const dir = camera.position.clone().sub(controls.target).normalize()
    flyTo(c.clone().addScaledVector(dir, size * 2.2 + 3), c)
  }
  function focusPart(id) {
    const list = (meshesByPart[id] || []).filter((m) => m.visible)
    if (!list.length) return
    box.makeEmpty()
    list.forEach((m) => box.expandByObject(m))
    const c = box.getCenter(new THREE.Vector3())
    const size = Math.max(box.getSize(tmpV).length(), 2)
    const dir = camera.position.clone().sub(controls.target).normalize()
    flyTo(c.clone().addScaledVector(dir, Math.min(size * 1.15 + 3, 34)), c)
  }
  const VIEWS = {
    iso: [new THREE.Vector3(-15, 9, 15), new THREE.Vector3(0, 1.3, 0)],
    front: [new THREE.Vector3(-21, 2.2, 0.01), new THREE.Vector3(0, 1.0, 0)],
    side: [new THREE.Vector3(0, 2.5, 23), new THREE.Vector3(0, 1.0, 0)],
    top: [new THREE.Vector3(0.01, 25, 0.5), new THREE.Vector3(0, 1.0, 0)],
    back: [new THREE.Vector3(18, 7, -13), new THREE.Vector3(0, 1.3, 0)],
  }

  // ================================================================
  // подпись к выбранной детали
  let selectedMesh = null
  const labelPos = new THREE.Vector3()
  function labelAnchor() {
    const id = state.selected
    if (!id) return null
    let m = selectedMesh && selectedMesh.userData.part === id ? selectedMesh : (meshesByPart[id] || []).find((x) => x.visible)
    if (!m) return null
    box.setFromObject(m)
    box.getCenter(labelPos)
    labelPos.y = box.max.y
    const v = labelPos.clone().project(camera)
    if (v.z > 1) return null
    const r = el.getBoundingClientRect()
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height }
  }

  // ================================================================
  // цикл отрисовки
  let playing = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  let speed = 1
  let dirty = true
  let raf = 0
  let last = performance.now()
  let tickAcc = 0
  function frame(now) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (playing) {
      theta = mod(theta + dt * 120 * speed, 720)
      update()
      dirty = true
    }
    if (tween) {
      const t = Math.min(1, (now - tween.start) / tween.ms)
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      camera.position.lerpVectors(tween.p0, tween.p1, e)
      controls.target.lerpVectors(tween.t0, tween.t1, e)
      if (t >= 1) tween = null
      dirty = true
    }
    if (controls.update()) dirty = true
    if (dirty) {
      renderer.render(scene, camera)
      dirty = false
      cb.onLabel?.(labelAnchor())
    }
    tickAcc += dt
    if (tickAcc > 0.1) {
      tickAcc = 0
      cb.onCycle?.(cycleAt(theta), theta)
    }
  }

  function resize() {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    // на узком экране отодвигаем камеру, чтобы мотор помещался
    camera.fov = w < 600 ? 46 : 34
    camera.updateProjectionMatrix()
    if (!fitted) {
      fitted = true
      const [p, tg] = viewPos('iso')
      camera.position.copy(p)
      controls.target.copy(tg)
      controls.update()
    }
    dirty = true
  }
  let fitted = false
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()
  update()
  applyLook()
  raf = requestAnimationFrame(frame)

  // ================================================================
  return {
    select(id, opts = {}) {
      state.selected = id
      if (!opts.keepMesh) selectedMesh = null
      applyLook()
      if (id && opts.focus) focusPart(id)
    },
    setLayer(l) {
      state.layer = l
      applyLook()
    },
    setCasing(v) {
      state.casing = v
      applyLook()
    },
    setExplode(f) {
      explodeF = f
      for (const o of placed) o.position.copy(o.userData.base).addScaledVector(o.userData.exp, explodeF)
      update()
      dirty = true
    },
    setPlaying(p) {
      playing = p
      last = performance.now()
    },
    setSpeed(s) {
      speed = s
    },
    setNumbers(v) {
      sprites.forEach((s) => (s.visible = v))
      dirty = true
    },
    setCylinder(c) {
      state.cylinder = c
      applyLook()
      const cy = cyls.find((x) => x.c === c)
      if (cy) focusObject(cy.piston)
    },
    step(deg) {
      theta = mod(theta + deg, 720)
      update()
      dirty = true
      cb.onCycle?.(cycleAt(theta), theta)
    },
    setTheta(deg) {
      theta = mod(deg, 720)
      update()
      dirty = true
      cb.onCycle?.(cycleAt(theta), theta)
    },
    view(name) {
      if (VIEWS[name]) flyTo(...viewPos(name))
    },
    focusPart,
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      geos.forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
      blueMat.dispose()
      flashMats.forEach((m) => m.dispose())
      sprites.forEach((s) => {
        s.material.map.dispose()
        s.material.dispose()
      })
      shadow.geometry.dispose()
      shadow.material.dispose()
      shadowTex.dispose()
      envTex.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

export { STROKES }
