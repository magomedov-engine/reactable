// Схематичная 3D-модель V12-дизеля на three.js.
// Оси: X вдоль коленвала (перед двигателя: −X, маховик: +X), Y вверх, Z вбок.
// Ряды цилиндров наклонены на ±30° (развал 60°): левый ряд 1–6 (−Z), правый 7–12 (+Z).
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { PARTS, PART, SYSTEMS, STROKES } from './partsInfo.js'
import { createSection, createFlows } from './features.js'
import { createOperation } from './operation.js'

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
const TAP_H = 0.28 // высота толкателя
const SCR = 0.2 // кончик регулировочного винта ниже оси коромысла
const SPR_SEAT = 3.45 // опора пружины в головке
const RET = 0.8 // тарелка пружины: от седла клапана по стержню
// толкатели и кулачки стоят не точно под клапанами: на одной шейке вала два цилиндра
// разных рядов, и их кулачки иначе налезли бы друг на друга. Коромысла чуть развёрнуты.
// [впускной, выпускной] — смещение толкателя вдоль вала от оси цилиндра
const TAP_X = { L: [-0.32, 0.16], R: [-0.16, 0.32] }
// впускной патрубок входит в головку между двумя штангами своего цилиндра
const RUN_X = { L: -0.08, R: 0.08 }
const RUN_R = 0.14 // радиус впускного патрубка
const PORT_R = 0.11 // радиус канала в головке

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
// зубчатый венец: кольцо с мелкими зубьями снаружи
function ringGearShape(n, rp, rin) {
  const ro = rp + 0.04, rr = rp - 0.03, p = (2 * Math.PI) / n
  const pts = []
  for (let i = 0; i < n; i++) {
    const a0 = i * p
    pts.push(P(a0, rr), P(a0 + 0.22 * p, ro), P(a0 + 0.48 * p, ro), P(a0 + 0.7 * p, rr))
  }
  const s = new THREE.Shape(pts)
  const hole = new THREE.Path()
  hole.absarc(0, 0, rin, 0, Math.PI * 2, true)
  s.holes.push(hole)
  return s
}
// половина нижней головки шатуна: sign=+1 — верх (шатун), −1 — крышка; профиль в (y, z)
function bigEndShape(sign) {
  const pts = [[0, -0.52], [0.13, -0.52], [0.2, -0.4]]
  for (let i = 0; i <= 8; i++) pts.push(P(-1.05 + (2.1 * i) / 8, 0.43).toArray())
  pts.push([0.2, 0.4], [0.13, 0.52], [0, 0.52], [0, 0.3])
  for (let i = 1; i < 12; i++) pts.push(P(Math.PI / 2 - (Math.PI * i) / 12, 0.3).toArray())
  pts.push([0, -0.3])
  return new THREE.Shape(pts.map(([y, z]) => new THREE.Vector2(sign * y, z)))
}
// полукольцо (нижняя половина) в плоскости (y, z)
function halfRingShape(rIn, rOut, n = 16) {
  const pts = []
  for (let i = 0; i <= n; i++) pts.push(P(Math.PI / 2 + (Math.PI * i) / n, rOut))
  for (let i = n; i >= 0; i--) pts.push(P(Math.PI / 2 + (Math.PI * i) / n, rIn))
  return new THREE.Shape(pts)
}
// ремень вокруг шкивов: выпуклая оболочка окружностей [y, z, r], толщина t; профиль в (y, z)
function hull(pts) {
  pts = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lo = [], hi = []
  for (const p of pts) {
    while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop()
    lo.push(p)
  }
  for (const p of pts.slice().reverse()) {
    while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop()
    hi.push(p)
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1))
}
function beltShape(pulleys, t) {
  const ring = (dr) => hull(pulleys.flatMap(([y, z, r]) => Array.from({ length: 64 }, (_, i) => P((i / 64) * Math.PI * 2, r + dr).add(new THREE.Vector2(y, z)))))
  const s = new THREE.Shape(ring(t))
  s.holes.push(new THREE.Path(ring(0).reverse()))
  return s
}
// кольцо вокруг оси X (манжеты): профиль прямоугольник
const ringX = (rIn, rOut, t, seg = 32) =>
  new THREE.LatheGeometry([[rIn, -t / 2], [rOut, -t / 2], [rOut, t / 2], [rIn, t / 2], [rIn, -t / 2]].map(([r, y]) => new THREE.Vector2(r, y)), seg).rotateZ(-Math.PI / 2)
// цилиндр между двумя точками
const UP = new THREE.Vector3(0, 1, 0)
function cylBetween(a, b, r, seg = 10) {
  const d = new THREE.Vector3().subVectors(b, a)
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()))
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  return g
}
// склейка нескольких геометрий в одну (меньше вызовов отрисовки)
function merge(list) {
  const prepared = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k)
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((n.attributes.position.count) * 2), 2))
    return n
  })
  const out = mergeGeometries(prepared)
  new Set([...list, ...prepared]).forEach((g) => g.dispose())
  return out
}
const at = (g, x, y, z) => g.translate(x, y, z)
const V3 = (x, y, z) => new THREE.Vector3(x, y, z)
// пружина: винтовая линия единичной высоты (растягивается по Y через scale)
class Helix extends THREE.Curve {
  constructor(r, turns) {
    super()
    this.r = r
    this.turns = turns
  }
  getPoint(t, v = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2
    return v.set(this.r * Math.cos(a), t, this.r * Math.sin(a))
  }
}

// палитра сцены (графит / молоко)
const INK = '#141517' // графит
const MILK = '#ece6da' // молочный акцент
const BADGE_FONT = "600 66px 'Oswald Variable', 'Oswald', 'Arial Narrow', sans-serif"

// номер цилиндра: строгий квадратный значок.
// обычный — графит с молочной рамкой и цифрой; active — сплошной молочный с графитовой цифрой
function drawBadge(c, n, active) {
  const g = c.getContext('2d')
  g.clearRect(0, 0, 128, 128)
  g.fillStyle = active ? MILK : 'rgba(20,21,23,0.9)'
  g.fillRect(10, 10, 108, 108)
  if (!active) {
    g.strokeStyle = MILK
    g.lineWidth = 5
    g.strokeRect(12.5, 12.5, 103, 103)
  }
  g.fillStyle = active ? INK : MILK
  g.font = BADGE_FONT
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(n), 64, 68)
}
function numberTexture(n, active = false) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  drawBadge(c, n, active)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  // перерисовка после загрузки шрифта Oswald
  t.userData.redraw = () => {
    drawBadge(c, n, active)
    t.needsUpdate = true
  }
  return t
}
function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  // градиент до самого края квадрата: на краях плоскости тень полностью прозрачна
  // (на тёмной сцене тень чуть плотнее, но остаётся едва заметной)
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 127)
  grd.addColorStop(0, 'rgba(0,0,0,0.42)')
  grd.addColorStop(0.6, 'rgba(0,0,0,0.16)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

// каналы в головке (координаты ряда): x — ось цилиндра
const portIn = (x, side) => {
  const o = side === 'R' ? 1 : -1, rx = x + RUN_X[side]
  return [V3(rx, 3.45, -o * 0.78), V3(rx - 0.06, 3.42, -o * 0.45), V3(x - 0.28, 3.3, -o * 0.15), V3(x - 0.3, 3.17, 0)]
}
const portEx = (x, o) => [V3(x + 0.3, 3.17, 0), V3(x + 0.3, 3.3, o * 0.15), V3(x + 0.12, 3.43, o * 0.45), V3(x, 3.5, o * 0.82)]

// ================================================================
// opts.inline — модель внутри урока: без зума колесом (оно листает страницу) и без сдвига
export function createEngine(host, cb = {}, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  host.appendChild(renderer.domElement)
  renderer.domElement.style.touchAction = 'none'

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  // тёмная графитовая сцена: тёплый ключевой свет, холодноватый контровой
  // (отделяет силуэт от фона) и мягкое заполнение «молоко сверху / графит снизу»
  const sun = new THREE.DirectionalLight('#fff4e4', 1.45)
  sun.position.set(-6, 14, 9)
  const rim = new THREE.DirectionalLight('#dde2e8', 0.85)
  rim.position.set(9, 6, -12)
  const hemi = new THREE.HemisphereLight('#efe8dc', '#1a1b1e', 0.22)
  scene.add(sun, rim, hemi, new THREE.AmbientLight('#ece6da', 0.08))

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200)
  camera.position.set(-15, 9, 15)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 1.3, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.09
  controls.minDistance = 4
  controls.maxDistance = 45
  if (opts.inline) {
    controls.enableZoom = false
    controls.enablePan = false
  }
  controls.update()

  // ---------- материалы: по одному на тип детали (подсветка всего типа сразу)
  const mats = {}
  for (const p of PARTS) {
    mats[p.id] = new THREE.MeshStandardMaterial({
      color: p.color,
      metalness: p.metal ?? 0.5,
      roughness: p.rough ?? 0.45,
      side: p.double ? THREE.DoubleSide : THREE.FrontSide,
      envMapIntensity: 1.0,
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
    pin: cylX(0.27, 0.96),
    // вкладыши короче шейки: не заходят в щёки вала
    bearing: new THREE.CylinderGeometry(0.37, 0.37, 0.34, 32, 1, true).rotateZ(Math.PI / 2),
    // шатунный вкладыш между шейкой (r 0.27) и постелью шатуна (r 0.3)
    rodBearing: new THREE.CylinderGeometry(0.285, 0.285, 0.3, 28, 1, true).rotateZ(Math.PI / 2),
    liner: new THREE.LatheGeometry(
      [[0.5, -1.075], [0.56, -1.075], [0.56, 0.98], [0.64, 0.98], [0.64, 1.075], [0.5, 1.075], [0.5, -1.075]].map(([r, y]) => new THREE.Vector2(r, y)),
      40,
    ),
    jacket: new THREE.CylinderGeometry(0.72, 0.72, 1.75, 32, 1, true),
    // поршень с ω-образной камерой сгорания в днище; кромка днища чуть ниже — зазор до клапанов в ВМТ;
    // внутри полый (юбка),
    // снизу видно бобышки, палец и верхнюю головку шатуна
    piston: merge([
      new THREE.LatheGeometry(
        [[0.42, -0.475], [0.48, -0.475], [0.48, 0.455], [0.34, 0.455], [0.3, 0.43], [0.32, 0.37], [0.28, 0.29], [0.18, 0.26], [0.09, 0.31], [0.0, 0.39], [0, 0.2], [0.3, 0.2], [0.42, 0.1], [0.42, -0.475]].map(([r, y]) => new THREE.Vector2(r, y)),
        36,
      ),
      // бобышки под палец (палец на 0.025 ниже центра поршня)
      ...[-0.3, 0.3].flatMap((x) => [at(cylX(0.17, 0.2, 20), x, -0.025, 0), at(new THREE.BoxGeometry(0.2, 0.25, 0.3), x, 0.09, 0)]),
    ]),
    // кольцо: прижато к гильзе (внутренний радиус гильзы 0.5), лежит в канавке поршня
    ring: new THREE.LatheGeometry([[0.44, -0.0225], [0.497, -0.0225], [0.497, 0.0225], [0.44, 0.0225], [0.44, -0.0225]].map(([r, y]) => new THREE.Vector2(r, y)), 40),
    ppin: cylX(0.13, 0.78, 20),
    rodBig: profile(bigEndShape(1), 0.34, 4),
    // стержень шатуна двутаврового сечения
    rodShank: new THREE.ExtrudeGeometry(
      new THREE.Shape([[-0.15, -0.11], [0.15, -0.11], [0.15, -0.06], [0.045, -0.06], [0.045, 0.06], [0.15, 0.06], [0.15, 0.11], [-0.15, 0.11], [-0.15, 0.06], [-0.045, 0.06], [-0.045, -0.06], [-0.15, -0.06]].map(([a, b]) => new THREE.Vector2(a, b))),
      { depth: ROD - 0.45, bevelEnabled: false },
    ).rotateX(-Math.PI / 2).translate(0, 0.28, 0),
    rodSmall: cylX(0.19, 0.34, 20),
    rodCap: merge([
      profile(bigEndShape(-1), 0.34, 4),
      at(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8), 0, -0.05, 0.45),
      at(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8), 0, -0.05, -0.45),
      at(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 6), 0, -0.24, 0.45),
      at(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 6), 0, -0.24, -0.45),
    ]),
    tappet: merge([new THREE.CylinderGeometry(0.11, 0.11, TAP_H - 0.06, 14), at(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 14), 0, -TAP_H / 2 + 0.03, 0)]),
    spring: new THREE.TubeGeometry(new Helix(0.1, 5), 48, 0.02, 4),
    retainer: merge([new THREE.CylinderGeometry(0.13, 0.11, 0.04, 16), at(new THREE.CylinderGeometry(0.065, 0.05, 0.07, 8), 0, 0.05, 0)]),
    adjscrew: merge([
      at(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 8), 0, -0.02, 0),
      at(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 6), 0, 0.09, 0),
      at(new THREE.SphereGeometry(0.045, 8, 6), 0, -SCR + 0.045, 0),
    ]),
    head: new RoundedBoxGeometry(1.5, 0.8, 1.5, 3, 0.07),
    stem: new THREE.CylinderGeometry(0.045, 0.045, 0.95, 12),
    vhead: new THREE.CylinderGeometry(0.19, 0.06, 0.08, 24),
    rocker: new THREE.BoxGeometry(0.16, 0.12, 1.05),
    pushrod: new THREE.CylinderGeometry(0.045, 0.045, PIVOT - SCR - (CAM_Y * Math.cos(BETA) + CAM_R + TAP_H), 10),
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

  // крышки коренных подшипников: полукольцо снизу шейки + два болта
  const capShape = new THREE.Shape([new THREE.Vector2(0, -0.7), new THREE.Vector2(-0.75, -0.7), new THREE.Vector2(-0.75, 0.7), new THREE.Vector2(0, 0.7)])
  for (let i = 0; i <= 12; i++) capShape.lineTo(...P(Math.PI / 2 + (Math.PI * i) / 12, 0.38).toArray())
  const capGeo = merge([
    profile(capShape, 0.32, 4),
    ...[-0.52, 0.52].flatMap((z) => [at(new THREE.CylinderGeometry(0.05, 0.05, 0.78, 8), 0, -0.41, z), at(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 6), 0, -0.8, z)]),
  ])
  geos.add(capGeo)
  for (let i = 0; i < 7; i++) {
    const m = mk(capGeo, 'maincap', { label: `Крышка коренного подшипника № ${i + 1}` })
    m.position.x = PITCH * (i - 3)
    root.add(reg(m, 'maincap', 'world'))
  }
  // упорные полукольца по бокам средней (4-й) коренной шейки: между крышкой и щекой вала
  const thrustGeo = profile(halfRingShape(0.33, 0.56), 0.03, 4)
  for (const dx of [-0.19, 0.19]) {
    const m = mk(thrustGeo, 'thrust')
    m.position.x = dx
    root.add(reg(m, 'thrust', 'world'))
  }
  // манжеты на выходе вала из блока: спереди на носке, сзади на фланце
  const sealF = mk(ringX(0.3, 0.44, 0.1), 'seal', { label: 'Передняя манжета' })
  sealF.position.x = -5.64
  root.add(reg(sealF, 'seal', 'world'))
  const sealR = mk(ringX(0.78, 0.92, 0.1, 48), 'seal', { label: 'Задняя манжета' })
  sealR.position.x = 5.64
  root.add(reg(sealR, 'seal', 'world'))
  sealR.userData.exp.x *= -1
  // гаситель крутильных колебаний на носке вала
  const damper = reg(
    mk(
      merge([
        cylX(0.75, 0.2, 40),
        // шкив привода генератора перед диском гасителя
        at(cylX(0.5, 0.22, 40), -0.21, 0, 0),
        at(cylX(0.3, 0.34, 24), -0.04, 0, 0),
        ...[0, 1, 2, 3, 4, 5].map((i) => at(cylX(0.05, 0.08, 6), -0.36, 0.3 * Math.cos(i * Math.PI / 3), 0.3 * Math.sin(i * Math.PI / 3))),
      ]),
      'damper',
    ),
    'damper',
    'world',
  )
  damper.position.x = -6.44
  damper.userData.base.copy(damper.position)
  root.add(damper)

  // главная масляная магистраль: вдоль блока над валом справа, отводы к коренным опорам
  {
    const gy = 0.2, gz = 1.35
    const dir = new THREE.Vector3(0, gy, gz).normalize()
    const parts = [at(cylX(0.07, 10.8, 10), 0, gy, gz)]
    for (let i = 0; i < 7; i++) {
      const x = PITCH * (i - 3)
      parts.push(cylBetween(new THREE.Vector3(x, gy, gz), new THREE.Vector3(x, 0, 0).addScaledVector(dir, 0.4), 0.045, 8))
    }
    root.add(reg(mk(merge(parts), 'oilgallery'), 'oilgallery', 'world'))
  }

  // маховик
  const fly = reg(new THREE.Group(), 'flywheel', 'world')
  fly.position.x = 6.42
  fly.userData.base.copy(fly.position)
  const flyDisc = mk(cylX(1.35, 0.45, 64), 'flywheel')
  // зубчатый венец под шестерню стартера
  const ring = mk(profile(ringGearShape(100, 1.47, 1.3), 0.22, 40), 'flywheel')
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
  const blueMat = new THREE.MeshStandardMaterial({ color: '#5f86a8', roughness: 0.45, metalness: 0.2 })
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
  // опорные шейки распредвала между парами кулачков
  const camJ = mk(merge([0, 1, 2, 3, 4, 5, 6].map((i) => at(cylX(0.3, 0.24, 24), PITCH * (i - 3), CAM_Y, 0))), 'camshaft', { label: 'Опорные шейки распредвала' })
  camG.add(camJ)

  // ---------- ряды цилиндров
  const rockerShaftGeo = merge([cylX(0.05, 9.7, 10), ...[0, 1, 2, 3, 4, 5].map((k) => at(new THREE.BoxGeometry(0.14, 0.24, 0.18), PITCH * (k - 2.5), -0.12, 0))])
  const boltGeo = merge(
    [[-0.52, -0.52], [0.52, -0.52], [-0.52, 0.52], [0.52, 0.52]].flatMap(([x, z]) => [
      at(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 6), x, 0.04, z),
      at(new THREE.CylinderGeometry(0.11, 0.11, 0.015, 12), x, 0.0075, z),
      at(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), x, -0.45, z),
    ]),
  )
  geos.add(rockerShaftGeo).add(boltGeo)
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
    banks[side].comp = comp
    // воздушный фильтр: патрубок в колесо компрессора, корпус с фильтрующим элементом, заборник
    const af = reg(
      mk(
        merge([
          at(cylX(0.25, 0.55, 20), 7.35, 0, 0),
          at(cylX(0.48, 1.1, 36), 8.15, 0, 0),
          at(cylX(0.51, 0.07, 36), 7.63, 0, 0),
          at(cylX(0.51, 0.07, 36), 8.67, 0, 0),
          at(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 16), 8.4, 0.62, 0),
          at(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 16), 8.4, 0.84, 0),
        ]),
        'airfilter',
      ),
      'airfilter', 'bank', out,
    )
    af.position.set(shift, 3.5, out * 1.35)
    af.userData.base.copy(af.position)
    g.add(af)
    // выпускная труба за турбиной: газы уходят вверх, в глушитель
    const ep = reg(
      mk(
        merge([
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(5.75, 3.9, out * 1.35), V3(5.82, 4.5, out * 1.45), V3(5.98, 5.2, out * 1.6), V3(6.12, 5.8, out * 1.75)], false, 'centripetal'), 32, 0.2, 14),
          at(new THREE.CylinderGeometry(0.29, 0.29, 0.07, 20), 5.75, 4.12, out * 1.35),
        ]),
        'exhaustpipe',
      ),
      'exhaustpipe', 'bank', out,
    )
    ep.position.set(shift, 0, 0)
    ep.userData.base.copy(ep.position)
    g.add(ep)
    // ось коромысел со стойками над каждой головкой
    const shaft = mk(rockerShaftGeo, 'rocker', { label: 'Ось коромысел' })
    shaft.position.set(shift, PIVOT, -out * 0.55)
    g.add(reg(shaft, 'rocker', 'bank', out))
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
  // навесное: детали собраны в одну геометрию и стоят в мировых координатах
  const addWorld = (geo, id, x, y, z, extra) => {
    const m = mk(geo, id, extra)
    m.position.set(x, y, z)
    root.add(reg(m, id, 'world'))
    return m
  }
  // стартер: шестерня входит в венец маховика, корпус за маховиком слева внизу
  {
    const sy = -1.24, sz = -1.09
    const ou = new THREE.Vector2(sy, sz).normalize().multiplyScalar(0.44)
    addWorld(
      merge([
        at(cylX(0.3, 1.0, 24), 0.75, 0, 0),
        at(cylX(0.33, 0.12, 24), 0.3, 0, 0),
        at(cylX(0.07, 0.4, 10), 0.05, 0, 0),
        at(profile(gearShape(11, 0.13), 0.2, 2), -0.1, 0, 0),
        at(cylX(0.14, 0.6, 14), 0.75, ou.x, ou.y),
      ]),
      'starter', 6.65, sy, sz,
    )
  }
  // генератор спереди справа, шкив перед блоком
  addWorld(
    merge([cylX(0.42, 0.8, 28), at(cylX(0.22, 0.14, 20), -0.6, 0, 0), at(cylX(0.08, 0.3, 8), -0.45, 0, 0), at(new THREE.BoxGeometry(0.3, 0.5, 0.2), 0, -0.4, -0.25)]),
    'generator', -6.05, 0.9, 1.95,
  )
  // приводной ремень: шкив вала (на гасителе) → шкив генератора, плоскость x = −6.65
  addWorld(profile(beltShape([[0, 0, 0.5], [0.9, 1.95, 0.22]], 0.045), 0.12, 6), 'belt', -6.65, 0, 0)
  // маслоприёмник: сетка в самой глубокой части поддона, трубка к масляному насосу
  {
    const pts = [V3(1.6, -2.82, 0), V3(1.5, -2.45, 0.2), V3(0.2, -2.18, 0.5), V3(-4.4, -2.05, 0.85), V3(-5.5, -1.75, 1.0), V3(-5.85, -1.42, 1.0)]
    addWorld(
      merge([
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 60, 0.07, 8),
        at(new THREE.CylinderGeometry(0.3, 0.32, 0.1, 24), 1.6, -2.88, 0),
        at(new THREE.CylinderGeometry(0.12, 0.3, 0.1, 24), 1.6, -2.8, 0),
      ]),
      'oilpickup', 0, 0, 0,
    )
  }
  // термостат: корпус спереди в развале, патрубок вверх и вперёд к радиатору
  addWorld(
    merge([
      new THREE.CylinderGeometry(0.22, 0.24, 0.32, 18),
      at(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 12), 0, 0.4, 0),
      cylBetween(new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(-0.9, 0.62, 0), 0.11, 12),
      at(new THREE.SphereGeometry(0.11, 12, 8), 0, 0.62, 0),
    ]),
    'thermostat', -5.55, 2.85, 0,
  )
  // топливный фильтр на левом боку блока
  addWorld(
    merge([
      new THREE.CylinderGeometry(0.28, 0.28, 0.75, 20),
      at(new RoundedBoxGeometry(0.66, 0.2, 0.66, 2, 0.05), 0, 0.47, 0),
      at(new THREE.BoxGeometry(0.3, 0.16, 0.4), 0, 0.47, 0.42),
    ]),
    'fuelfilter', 3.0, -0.6, -1.95,
  )
  // охладитель наддувочного воздуха сверху над ТНВД: сердцевина, рёбра, бачки
  const ic = addWorld(
    merge([
      new THREE.BoxGeometry(1.3, 0.5, 1.2),
      ...Array.from({ length: 11 }, (_, i) => at(new THREE.BoxGeometry(0.025, 0.62, 1.24), -0.6 + i * 0.12, 0, 0)),
      at(new RoundedBoxGeometry(1.36, 0.6, 0.2, 2, 0.06), 0, 0, 0.7),
      at(new RoundedBoxGeometry(1.36, 0.6, 0.2, 2, 0.06), 0, 0, -0.7),
    ]),
    'intercooler', 6.3, 4.45, 0,
  )

  // ---------- цилиндры
  const cyls = []
  const flashMats = []
  const sprites = []
  const badgeTex = []
  let alive = true
  // шрифт значков (Oswald) мог ещё не загрузиться: перерисуем, когда загрузится
  document.fonts?.load?.(BADGE_FONT).then(() => {
    if (!alive) return
    badgeTex.forEach((t) => t.userData.redraw())
    dirty = true
  }).catch(() => {})
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
    // стержень уже стоит в геометрии от нижней головки (y 0.28) до верхней (y ROD − 0.17)
    const rs = mk(G.rodShank, 'rod')
    const rsm = mk(G.rodSmall, 'rod')
    rsm.position.y = ROD
    // шатунный вкладыш едет вместе с шатуном
    const rbr = mk(G.rodBearing, 'rodbearing')
    rod.add(rb, rs, rsm, rbr)
    add(rod, 'rod')
    const rcap = mk(G.rodCap, 'rodcap', inf)
    add(rcap, 'rodcap')
    // болты крепления головки: 4 вокруг форсунки
    const hb = mk(boltGeo, 'headbolt', inf)
    hb.position.set(x, 3.9, 0)
    add(hb, 'headbolt')

    const fm = new THREE.MeshBasicMaterial({ color: '#e3874a', transparent: true, opacity: 0, depthWrite: false })
    flashMats.push(fm)
    const flash = new THREE.Mesh(G.flash, fm)
    flash.userData.noPick = true
    g.add(flash)

    const valves = []
    for (const [type, dx, xt] of [['valve_in', -0.3, x + TAP_X[side][0]], ['valve_ex', 0.3, x + TAP_X[side][1]]]) {
      const xv = x + dx
      const v = new THREE.Group()
      const stem = mk(G.stem, type)
      stem.position.y = 0.475
      const vh = mk(G.vhead, type)
      vh.position.y = -0.02
      // тарелка пружины с сухарями едет вместе с клапаном
      const ret = mk(G.retainer, 'spring', inf)
      ret.position.y = RET + 0.02
      v.add(stem, vh, ret)
      v.position.set(xv, SEAT, 0)
      add(v, type)
      const spr = mk(G.spring, 'spring', inf)
      spr.position.set(xv, SPR_SEAT, 0)
      add(spr, 'spring')
      const rk = new THREE.Group()
      // плечо коромысла: от торца клапана (x = xv, z = 0) к штанге (x = xt, z = −PUSH_W);
      // ось вращения вдоль X, поэтому развёрнутое коромысло качается так же
      const ax = xt - xv, az = -out * (PUSH_W - 0.55)
      const rkm = mk(G.rocker, 'rocker')
      rkm.position.set(ax / 2, 0, (out * 0.55 + az) / 2)
      rkm.rotation.y = Math.atan2(-ax, out * PUSH_W)
      rkm.scale.z = Math.hypot(ax, PUSH_W) / 1.05
      // регулировочный винт с контргайкой на плече штанги
      const scr = mk(G.adjscrew, 'adjscrew', inf)
      scr.position.set(ax, 0, az)
      rk.add(rkm, scr)
      rk.position.set(xv, PIVOT, -out * 0.55)
      add(rk, 'rocker')
      const pr = mk(G.pushrod, 'pushrod')
      pr.position.set(xt, 0, -out * PUSH_W)
      add(pr, 'pushrod')
      const tp = mk(G.tappet, 'tappet', inf)
      tp.position.set(xt, 0, -out * PUSH_W)
      add(tp, 'tappet')
      // кулачок: «носик» смотрит на штангу в момент максимального подъёма
      const peak = type === 'valve_in' ? (IN_WIN[0] + IN_WIN[1]) / 2 : (EX_WIN[0] + EX_WIN[1]) / 2
      const delta = (beta / DEG - (FIRE_AT[c] + peak) / 2) * DEG
      const lobe = mk(G.lobe, 'camshaft', inf)
      lobe.position.set(xt, CAM_Y, 0)
      camG.add(lobe)
      valves.push({ type, v, rk, pr, tp, spr, lobe, delta, xv, xt })
    }
    // каналы в головке: впускной — от патрубка к впускному клапану, выпускной — от клапана к коллектору
    const pin_ = portIn(x, side), pex = portEx(x, out)
    add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pin_, false, 'centripetal'), 24, PORT_R, 12), 'port_in', inf), 'port_in')
    add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pex, false, 'centripetal'), 24, PORT_R, 12), 'port_ex', inf), 'port_ex')

    const badge = numberTexture(c)
    const badgeOn = numberTexture(c, true)
    badgeTex.push(badge, badgeOn)
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: badge, depthTest: false, transparent: true, toneMapped: false }))
    sp.userData.tex = { off: badge, on: badgeOn }
    sp.scale.set(0.62, 0.62, 1)
    sp.position.set(x, 5.05, -out * 0.2)
    sp.renderOrder = 10
    sp.userData.noPick = true
    g.add(sp)
    sprites.push(sp)

    cyls.push({ c, side, out, x, beta, piston, rings, ppin, rod, rcap, inj, flash, fm, valves, sprite: sp })
  }

  // ---------- впускные патрубки: от впускного коллектора в развале к головке каждого цилиндра
  root.updateMatrixWorld(true)
  const runnerPts = (cy) => {
    const o = cy.out, rx = cy.x + RUN_X[cy.side]
    const W = (x, y, z) => banks[cy.side].localToWorld(V3(x, y, z))
    return [V3(rx, 3.1, o * 0.1), V3(rx, 3.28, o * 0.4), W(rx, 3.42, -o * 1.02), W(rx, 3.45, -o * 0.7)]
  }
  for (const cy of cyls) {
    const m = mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(runnerPts(cy), false, 'centripetal'), 24, RUN_R, 14), 'manifold_in', { cyl: cy.c, label: `Впускной патрубок цилиндра ${cy.c}` })
    mIn.add(m)
  }

  // ---------- гибкие трубки: строятся в координатах root по текущему положению концов
  // (перестраиваются при «разборке», чтобы не отрываться от ТНВД, форсунок, компрессоров)
  const tmpW = new THREE.Vector3()
  function cylTopWorld(c, dy = 0.67, dz = 0) {
    const cy = cyls.find((q) => q.c === c)
    if (!cy) return null
    cy.inj.updateWorldMatrix(true, false)
    return cy.inj.localToWorld(V3(0, dy, dz))
  }
  const tubes = []
  function tube(id, r, seg, pointsFn, extra) {
    const t = { r, seg, pointsFn }
    t.mesh = mk(new THREE.BufferGeometry(), id, extra)
    root.add(t.mesh)
    tubes.push(t)
  }
  function rebuildTubes() {
    root.updateMatrixWorld(true)
    for (const t of tubes) {
      const old = t.mesh.geometry
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(t.pointsFn(), false, 'centripetal'), t.seg, t.r, 5)
      t.mesh.geometry = g
      geos.delete(old)
      old.dispose()
      geos.add(g)
    }
  }
  // трубки высокого давления: от верха ТНВД вдоль развала к каждой форсунке
  for (const cy of cyls) {
    const k = (cy.c - 1) % 6
    const s = cy.out
    tube('hpline', 0.035, 40, () => {
      const pp = pump.position
      const ox = pp.x - 0.5 + 0.17 * k
      const ry = pp.y + 0.6 + 0.06 * k
      const rz = s * (0.36 + 0.06 * k)
      return [
        V3(ox, pp.y + 0.4, s * 0.25),
        V3(ox - 0.12, ry, rz),
        V3(cy.x + 0.5, ry, rz),
        V3(cy.x, ry + 0.02, rz + s * 0.1),
        cylTopWorld(cy.c, 0.6, -s * 0.6),
        cylTopWorld(cy.c, 0.6, -s * 0.13),
      ]
    }, { cyl: cy.c })
  }
  // патрубки наддува: компрессоры → охладитель → впускной коллектор
  for (const side of ['L', 'R']) {
    const s = side === 'R' ? 1 : -1
    tube('intercooler', 0.16, 32, () => {
      const c = banks[side].comp.getWorldPosition(tmpW).clone()
      const p = ic.position
      return [c, V3(c.x, c.y + 0.9, c.z - s * 0.25), V3(p.x + 0.35, p.y, s * 1.35), V3(p.x + 0.1, p.y, s * 0.72)]
    }, { label: 'Патрубок от компрессора к охладителю' })
  }
  tube('intercooler', 0.17, 24, () => {
    const p = ic.position, m = mIn.position
    return [V3(p.x - 0.4, p.y - 0.2, 0), V3(p.x - 0.85, p.y - 0.35, 0), V3(m.x + 5.05, m.y + 3.6, 0), V3(m.x + 4.95, m.y + 3.2, 0)]
  }, { label: 'Патрубок от охладителя во впускной коллектор' })
  rebuildTubes()

  // ---------- путь воздуха и газов одного цилиндра (координаты root)
  root.updateMatrixWorld(true)
  const inPath = (cy) => {
    const W = (v) => banks[cy.side].localToWorld(v.clone())
    return [...runnerPts(cy).slice(0, 3), ...portIn(cy.x, cy.side).map(W), W(V3(cy.x - 0.3, 2.85, 0))]
  }
  const exPath = (cy) => {
    const W = (v) => banks[cy.side].localToWorld(v.clone())
    return [W(V3(cy.x + 0.3, 2.85, 0)), ...portEx(cy.x, cy.out).map(W), W(V3(cy.x, 3.5, cy.out * 1.35))]
  }

  // ---------- потоки по системам (строятся по собранному двигателю, в координатах root)
  const flows = createFlows(root)
  {
    const W = (side, x, y, z) => banks[side].localToWorld(V3(x, y, z))
    const path = (...pts) => ({ pts })
    const sh = (side) => (side === 'R' ? OFF : -OFF)
    const tubePts = (id) => tubes.filter((t) => t.mesh.userData.part === id).map((t) => ({ pts: t.pointsFn().map((v) => v.clone()) }))
    const bankCyls = (side) => cyls.filter((c) => c.side === side)
    // масло: поддон → насос → фильтр → магистраль → коренные опоры → обратно в поддон
    const oil = [
      path(V3(1.6, -2.86, 0), V3(1.5, -2.45, 0.2), V3(0.2, -2.18, 0.5), V3(-4.4, -2.05, 0.85), V3(-5.5, -1.75, 1.0), V3(-5.85, -1.15, 1.0), V3(-4.6, -0.95, 1.7), V3(-2.2, -1.05, 1.95), V3(-2.2, -0.5, 1.95), V3(-2.2, 0.0, 1.6), V3(-2.2, 0.2, 1.35)),
      path(V3(-2.2, 0.2, 1.35), V3(5.4, 0.2, 1.35)),
      path(V3(-2.2, 0.2, 1.35), V3(-5.4, 0.2, 1.35)),
    ]
    const dir = new THREE.Vector3(0, 0.2, 1.35).normalize()
    for (let i = 0; i < 7; i++) {
      const x = PITCH * (i - 3)
      oil.push({ pts: [V3(x, 0.2, 1.35), V3(x, 0, 0).addScaledVector(dir, 0.38)], speed: 0.6 })
      oil.push({ pts: [V3(x, -0.35, 0.1), V3(x + 0.2, -1.2, 0.2), V3(x + 0.3, -2.05, 0.1)], speed: 0.45 })
    }
    flows.define('oil', '#d8b35c', oil)
    // охлаждающая жидкость: насос → рубашки рядов → головки → термостат → к радиатору
    const water = []
    for (const side of ['L', 'R']) {
      const o = side === 'R' ? 1 : -1
      water.push(path(V3(-6.0, -0.75, -1.35), V3(-5.6, -0.2, o * 1.1), W(side, -5.0, 1.35, o * 0.85), W(side, 5.1, 1.35, o * 0.85)))
      for (const cy of bankCyls(side)) water.push({ pts: [W(side, cy.x, 1.4, o * 0.8), W(side, cy.x, 2.4, o * 0.78), W(side, cy.x + 0.25, 3.3, o * 0.55)], speed: 0.6 })
      water.push(path(W(side, 5.0, 3.3, o * 0.55), W(side, -4.9, 3.3, o * 0.55), W(side, -5.3, 3.3, 0), V3(-5.55, 2.95, 0), V3(-5.55, 3.47, 0), V3(-6.45, 3.47, 0)))
    }
    flows.define('water', '#86a8c6', water)
    // воздух: фильтры → компрессоры → охладитель → коллектор → патрубки → каналы головок → впускные клапаны
    const airIn = (side) => {
      const o = side === 'R' ? 1 : -1
      return path(W(side, sh(side) + 8.4, 4.4, o * 1.35), W(side, sh(side) + 8.4, 3.75, o * 1.35), W(side, sh(side) + 8.0, 3.5, o * 1.35), W(side, sh(side) + 6.9, 3.5, o * 1.35))
    }
    const air = [airIn('L'), airIn('R'), ...tubePts('intercooler'), path(V3(4.95, 3.08, 0), V3(-5.0, 3.08, 0))]
    for (const cy of cyls) air.push({ pts: inPath(cy), speed: 0.5 })
    flows.define('air', '#a2c08f', air)
    // выхлоп: выпускные клапаны → каналы головок → коллектор ряда → турбина → выпускная труба
    const exOut = (side) => {
      const o = side === 'R' ? 1 : -1
      return [W(side, sh(side) + 5.75, 3.5, o * 1.35), W(side, sh(side) + 5.75, 3.9, o * 1.35), W(side, sh(side) + 5.82, 4.5, o * 1.45), W(side, sh(side) + 5.98, 5.2, o * 1.6), W(side, sh(side) + 6.12, 5.8, o * 1.75)]
    }
    const ex = []
    for (const cy of cyls) ex.push({ pts: exPath(cy), speed: 0.5 })
    for (const side of ['L', 'R']) {
      const o = side === 'R' ? 1 : -1
      ex.push(path(W(side, sh(side) - 4.9, 3.5, o * 1.35), ...exOut(side)))
    }
    flows.define('exhaust', '#cc6e5a', ex)
    // топливо: от бака → фильтр → ТНВД → трубки высокого давления → форсунки
    const fuel = [path(V3(1.2, -0.9, -2.6), V3(3.0, -0.7, -2.3), V3(3.0, -0.6, -1.95), V3(3.25, 0.0, -1.95), V3(4.6, 1.6, -1.3), V3(5.6, 2.7, -0.45), V3(5.85, 3.0, 0)), ...tubePts('hpline').map((p) => ({ ...p, speed: 1.6 }))]
    flows.define('fuel', '#de8d55', fuel)

    // режим «Работа»: общие потоки (по цилиндрам частицы рисует operation.js)
    const opAir = [...tubePts('intercooler'), path(V3(4.95, 3.08, 0), V3(-5.0, 3.08, 0))]
    const opExh = []
    for (const side of ['L', 'R']) {
      const o = side === 'R' ? 1 : -1
      // наружный воздух через воздушный фильтр в колесо компрессора
      opAir.push({ ...airIn(side), pts: [W(side, sh(side) + 8.4, 5.3, o * 1.35), ...airIn(side).pts] })
      opExh.push(path(W(side, sh(side) - 4.9, 3.5, o * 1.35), W(side, sh(side) + 5.75, 3.5, o * 1.35)))
      // за турбиной газы уходят вверх по выпускной трубе и дальше, в глушитель
      opExh.push({ pts: [...exOut(side), W(side, sh(side) + 6.3, 6.6, o * 1.95)], speed: 1.4 })
    }
    flows.define('op_air', '#a2c08f', opAir, { density: 6, size: 0.24 })
    flows.define('op_exh', '#958e84', opExh, { density: 6, size: 0.3 })
    flows.define('op_fuel', '#de8d55', [fuel[0]], { density: 7, size: 0.22, speed: 1.0 })
  }
  // режим «Работа двигателя»
  const hpCurves = {}
  const work = createOperation({
    root, banks, cyls, DECK, IN_WIN, EX_WIN, FIRE_AT, lift, inPath, exPath,
    hpCurve: (c) =>
      (hpCurves[c] ||= (() => {
        const t = tubes.find((q) => q.mesh.userData.part === 'hpline' && q.mesh.userData.cyl === c)
        return t ? new THREE.CatmullRomCurve3(t.pointsFn(), false, 'centripetal') : null
      })()),
  })

  // тень под двигателем
  const shadowTex = shadowTexture()
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(22, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }))
  shadow.position.y = -3.25
  shadow.userData.noPick = true
  root.add(shadow)

  // разрез: общая плоскость отсечения для всех материалов деталей
  const section = createSection(renderer, [...Object.values(mats), blueMat])
  let numbersOn = true

  // ================================================================
  // кинематика
  let theta = 40 // градусы, 0…720
  function update() {
    const th = theta * DEG
    crankG.rotation.x = th
    fly.rotation.x = th
    gearC.rotation.x = th
    damper.rotation.x = th
    gearI.rotation.x = rotI0 - th * (NC / NI)
    gearK.rotation.x = rotK0 + th * (NC / NK)
    for (const cy of cyls) {
      const kk = (cy.c - 1) % 6
      const d = th + PIN_OFF[kk] * DEG - cy.beta
      const sp = R * Math.cos(d)
      const np = R * Math.sin(d)
      const sPin = sp + Math.sqrt(ROD * ROD - np * np)
      cy.sPin = sPin
      setPos(cy.piston, cy.x, sPin + 0.025, 0)
      setPos(cy.rings, cy.x, sPin, 0)
      setPos(cy.ppin, cy.x, sPin, 0)
      setPos(cy.rod, cy.x, sp, np)
      cy.rod.rotation.x = Math.atan2(-np, sPin - sp)
      setPos(cy.rcap, cy.x, sp, np)
      cy.rcap.rotation.x = cy.rod.rotation.x
      const psi = mod(theta - FIRE_AT[cy.c], 720)
      // вспышка: начало рабочего хода
      const f = psi < 50 ? 1 - psi / 50 : 0
      cy.fm.opacity = f * 0.85 * flashScale
      cy.flash.visible = f > 0.01 && flashScale > 0 && (!soloOn() || soloOn() === cy.c)
      cy.flash.position.set(cy.x, sPin + 0.53 + explodeF * PART.piston.explode.bank[0], 0)
      for (const va of cy.valves) {
        const l = lift(psi, va.type === 'valve_in' ? IN_WIN : EX_WIN)
        setPos(va.v, va.xv, SEAT - l * LIFT_V, 0)
        va.rk.rotation.x = cy.out * Math.asin((l * LIFT_V) / ARM_V)
        const sBot = CAM_Y * Math.cos(BETA) + CAM_R + l * LIFT_P
        setPos(va.tp, va.xt, sBot + TAP_H / 2, -cy.out * PUSH_W)
        setPos(va.pr, va.xt, sBot + TAP_H + PUSH_LEN / 2, -cy.out * PUSH_W)
        va.spr.scale.y = SEAT + RET - l * LIFT_V - SPR_SEAT
        va.lobe.rotation.x = th / 2 + va.delta
      }
    }
    if (work.enabled) work.update(theta, 0, speed)
  }

  // ================================================================
  // внешний вид: подсветка, слои, прозрачность корпуса
  // hidden — детали, скрытые пользователем; solo — показывать детали только одного цилиндра
  const state = { selected: null, hover: null, layer: 'all', casing: 0.3, cylinder: null, only: null, fresh: null, op: false, glass: true, hidden: new Set(), solo: null, flows: null }
  const soloOn = () => (state.only ? null : state.solo)
  // «стеклянный» двигатель в режиме работы: стенки почти прозрачные, внутренности видно
  const GLASS = { block: 0.1, liner: 0.13, jacket: 0.05, head: 0.16, cover: 0.12, oilpan: 0.15, oil: 0.25, manifold_in: 0.35, manifold_ex: 0.4, intercooler: 0.55, headbolt: 0.5, maincap: 0.4 }
  let flashScale = 1
  // подсветка выбранной / наведённой детали: молочный тёплый белый
  const accent = new THREE.Color(MILK)
  function applyLook() {
    for (const p of PARTS) {
      const m = mats[p.id]
      let op = p.opacity ?? 1
      if (p.casing) op = state.casing
      // гильзы просвечивают вместе с корпусом: видно поршень, шатун и вал
      if (p.see != null && state.casing < 1) op = p.see
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
      if (state.op && state.glass && GLASS[p.id] != null && !state.selected) op = Math.min(op, GLASS[p.id])
      // режим сборки: показываем только поставленные детали, новые подсвечены
      if (state.only) {
        if (!state.only.has(p.id) && !(p.id === 'gearmark' && state.only.has('gear'))) op = 0
        else if (state.fresh?.has(p.id) && !state.selected) {
          emis = accent
          emisI = 0.22
        }
      }
      if (!state.only && state.hidden.has(p.id)) op = 0
      const tr = op < 0.99
      if (m.transparent !== tr) m.needsUpdate = true
      m.transparent = tr
      m.opacity = op
      m.depthWrite = op > 0.6
      m.emissive.set(emis)
      m.emissiveIntensity = emisI
      const solo = soloOn()
      for (const mesh of meshesByPart[p.id] || []) mesh.visible = op > 0.015 && (!solo || mesh.userData.cyl == null || mesh.userData.cyl === solo)
    }
    blueMat.opacity = mats.gearmark.opacity
    blueMat.transparent = mats.gearmark.transparent
    flashScale = state.op || (state.only && !state.only.has('piston')) || (!state.only && state.hidden.has('piston')) ? 0 : state.selected || state.layer !== 'all' ? 0.35 : 1
    const solo = soloOn()
    for (const cy of cyls) {
      // выбранный цилиндр — инверсный (сплошной молочный) значок
      cy.sprite.material.map = state.cylinder === cy.c || solo === cy.c ? cy.sprite.userData.tex.on : cy.sprite.userData.tex.off
      cy.sprite.visible = numbersOn && (!state.only || state.only.has('liner')) && (!solo || solo === cy.c)
    }
    work.setSolo(solo)
    if (state.op) flows.show([work.fx.air && 'op_air', work.fx.exhaust && 'op_exh', work.fx.fuel && 'op_fuel'].filter(Boolean))
    else if (state.layer === 'all' && state.flows) flows.show(!state.only && explodeF < 0.05 ? state.flows : null)
    else flows.show(state.layer !== 'all' && !state.only && explodeF < 0.05 ? state.layer : null)
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
      if (section.on && section.plane.distanceToPoint(h.point) < 0) return false
      const info = PART[p]
      if (info.pickable === false && state.selected !== p && state.layer !== 'water') return false
      return h.object.material.opacity > 0.12 || state.selected === p
    })
    if (!hits.length) return null
    // сквозь полупрозрачный корпус выбираем то, что внутри
    const solid = hits.find((h) => !(PART[h.object.userData.part].casing || PART[h.object.userData.part].see != null) || h.object.material.opacity > 0.9)
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
    // дистанция, при которой габарит детали помещается в кадр по ширине и высоте
    const vf = (camera.fov * Math.PI) / 180
    const fov = Math.min(vf, 2 * Math.atan(Math.tan(vf / 2) * camera.aspect))
    const dist = (size * 0.5) / Math.tan(fov / 2) + 1.5
    flyTo(c.clone().addScaledVector(dir, Math.min(Math.max(dist, 4.5), 40)), c)
  }
  // смотрим на цилиндр снаружи ряда и немного спереди-сверху, перпендикулярно оси цилиндра:
  // видно, как ходит поршень, шатун крутит вал, а кулачок через штангу открывает клапан
  function flyToCyl(c, dist = 10, mid = 2.0) {
    const cy = cyls.find((q) => q.c === c)
    if (!cy) return
    root.updateMatrixWorld(true)
    const center = banks[cy.side].localToWorld(V3(cy.x, mid, 0))
    const outDir = V3(0, 0, cy.out).applyQuaternion(banks[cy.side].quaternion)
    const dir = outDir.add(V3(-0.45, 0.8, 0)).normalize()
    flyTo(center.clone().addScaledVector(dir, dist * Math.max(1, fitScale() * 0.9)), center)
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
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
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
    if (flows.tick(dt * (state.op ? (playing ? Math.max(0.3, speed * 1.6) : 0.25) : playing ? Math.max(0.5, speed) : 0.6))) dirty = true
    if (work.enabled) {
      work.update(theta, dt, playing ? speed : 0.15)
      dirty = true
    }
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
      rebuildTubes()
      applyLook()
    },
    setPlaying(p) {
      playing = p
      last = performance.now()
    },
    setSpeed(s) {
      speed = s
    },
    // режим «Работа двигателя»
    setOperation(on) {
      state.op = on
      work.setEnabled(on)
      if (on) work.update(theta, 0, speed)
      applyLook()
    },
    setOpFx(key, v) {
      if (key === 'glass') state.glass = v
      else work.setFx(key, v)
      if (work.enabled) work.setEnabled(true)
      applyLook()
    },
    // c — цилиндр, за которым следим; all — стрелки сил у всех; fly — подлететь камерой
    opFollow(c, { fly = false, all = false } = {}) {
      work.setFollow(c, all)
      if (fly) flyToCyl(c, 10, 2.7)
      dirty = true
    },
    // скрытые пользователем детали (Set id); не действует в режиме сборки
    setHidden(ids) {
      state.hidden = new Set(ids || [])
      applyLook()
      update()
    },
    // только детали цилиндра c (общие детали — вал, распредвал, блок — остаются); null — все цилиндры
    setSolo(c) {
      state.solo = c || null
      applyLook()
      update()
    },
    focusCylinder: (c, dist) => flyToCyl(c, dist),
    // потоки систем без подсветки слоя (для наборов «Что показывать»): ['air', 'exhaust'] | null
    setFlows(ids) {
      state.flows = ids
      applyLook()
    },
    setNumbers(v) {
      numbersOn = v
      applyLook()
    },
    // режим сборки: ids — детали, которые уже стоят (null — все), fresh — поставленные на этом шаге
    setOnly(ids, fresh = null) {
      state.only = ids
      state.fresh = fresh
      applyLook()
    },
    // разрез: 'none' | 'x' (поперёк через пару цилиндров k и k+6) | 'bank' (вдоль правого ряда)
    setSection(mode, pair = 1) {
      if (mode === 'x') {
        const x = PITCH * (pair - 3.5)
        section.set(new THREE.Vector3(1, 0, 0), x)
        flyTo(new THREE.Vector3(x - 15, 5.5, 8).sub(V3(x, 1.4, 0)).multiplyScalar(fitScale()).add(V3(x, 1.4, 0)), V3(x, 1.4, 0))
      } else if (mode === 'bank') {
        section.set(new THREE.Vector3(0, Math.sin(BETA), -Math.cos(BETA)), 0)
        flyTo(new THREE.Vector3(-2, -2, 25).multiplyScalar(fitScale()).add(V3(0, 1.2, 0)), V3(0, 1.2, 0))
      } else section.set(null)
      dirty = true
    },
    setCylinder(c, { focus = true } = {}) {
      state.cylinder = c
      applyLook()
      const cy = cyls.find((x) => x.c === c)
      if (cy && focus) focusObject(cy.piston)
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
    // --- для 3D-блоков в уроках
    setZoom(v) {
      controls.enableZoom = v
      controls.enablePan = v
    },
    setInteractive(v) {
      controls.enabled = v
      renderer.domElement.style.touchAction = v ? 'none' : 'pan-y'
    },
    // пауза отрисовки, пока блок за экраном
    setActive(v) {
      cancelAnimationFrame(raf)
      if (v) {
        last = performance.now()
        dirty = true
        raf = requestAnimationFrame(frame)
      }
    },
    // перелёт камеры: позиция и цель в мировых координатах (дистанция подстраивается под форму окна)
    fly(pos, target, ms = 900) {
      const t = new THREE.Vector3(...target)
      const p = new THREE.Vector3(...pos).sub(t).multiplyScalar(fitScale()).add(t)
      flyTo(p, t, ms)
    },
    // мировая точка верха форсунки цилиндра c (THREE.Vector3)
    cylTopWorld: (c) => cylTopWorld(c),
    getRoot: () => root,
    getScene: () => scene,
    getCamera: () => camera,
    getRenderer: () => renderer,
    markDirty() {
      dirty = true
    },
    partIds: () => Object.keys(meshesByPart),
    dispose() {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      geos.forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
      blueMat.dispose()
      flashMats.forEach((m) => m.dispose())
      flows.dispose()
      work.dispose()
      sprites.forEach((s) => s.material.dispose())
      badgeTex.forEach((t) => t.dispose())
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
