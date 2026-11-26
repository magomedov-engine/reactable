// Схематичная 3D-модель V12-дизеля по образцу ЯМЗ-240М2 на three.js.
// Что взято от ЯМЗ-240: V12 с развалом 90°, порядок работы 1-12-5-8-3-10-6-7-2-11-4-9,
// два шатуна рядом на одной шейке (вспышки чередуются через 90° и 30°), один распредвал в развале,
// штанги и коромысла, 2 клапана на цилиндр, «мокрые» гильзы, шестерни распределения у заднего торца
// (со стороны маховика), секционный ТНВД в развале, без турбонаддува (у 240М2 его нет).
// Формы и размеры условные, детали упрощены.
// Оси: X вдоль коленвала (перёд двигателя: −X, маховик: +X), Y вверх, Z вбок.
// Ряды наклонены на ±45°: ряд цилиндров 1–6 (−Z), ряд 7–12 (+Z), номера от переднего торца.
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
const BETA = 45 * DEG // половина развала (развал 90°)
const DECK = 3.1 // плоскость блока (по оси цилиндра)
const SEAT = 3.14 // сёдла клапанов
const CAM_Y = 1.5 // распредвал в развале
const CAM_R = 0.22 // базовый радиус кулачка
const LIFT_V = 0.2 // ход клапана
const ARM_V = 0.45 // плечо коромысла к клапану
const ARM_P = 0.5 // плечо коромысла к штанге
const LIFT_P = (LIFT_V * ARM_P) / ARM_V
const PIVOT = 4.14 // ось коромысел
const PUSH_W = CAM_Y * Math.sin(BETA) // штанги: расстояние от оси цилиндра в сторону развала (точно над кулачком)
const GEAR_X = 6.05 // шестерни распределения у заднего торца блока, перед маховиком
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
// ТНВД: центр корпуса вдоль вала; секции наклонены от вертикали к своему ряду
const PUMP_X = 3.9
const PUMP_TILT = 30 * DEG
// точка на оси секции k (0 — передняя) ряда s (−1 / +1) на расстоянии d от основания, координаты группы ТНВД
const pumpOut = (k, s, d) => new THREE.Vector3(-1.25 + 0.5 * k, 0.5 + d * Math.cos(PUMP_TILT), s * (0.17 + d * Math.sin(PUMP_TILT)))
// штуцер форсунки: выходит из головки сбоку, со стороны развала, ниже клапанной крышки (координаты форсунки)
const INJ_FIT_Y = -0.03
// схема затяжки: что делать полупрозрачным, чтобы болты было видно
const TIGHT_SEE = { headbolt: ['cover'], maincap: ['oilpan', 'oil', 'oilpickup'] }
// вентилятор: плоскость лопастей и высота оси; передаточное отношение от шкива вала (r 0.5) к шкиву вентилятора (r 0.3)
const FAN_X = -7.05
const FAN_Y = 1.35
const injFitDx = (side) => (side === 'R' ? -0.5 : 0.5) // мимо штанг и впускного патрубка

export const FIRING = [1, 12, 5, 8, 3, 10, 6, 7, 2, 11, 4, 9]
// развал 90° и общие шейки: цилиндр второго ряда приходит в ВМТ через 90° после соседа по шейке,
// поэтому вспышки идут неравномерно — поочерёдно через 90° и 30° поворота вала
export const FIRE_ANGLES = [0, 90, 120, 210, 240, 330, 360, 450, 480, 570, 600, 690]
export const FIRE_AT = {} // цилиндр → угол начала рабочего хода (0…720°)
FIRING.forEach((c, i) => (FIRE_AT[c] = FIRE_ANGLES[i]))
// углы шатунных шеек выводим из порядка работы: ВМТ цилиндра k ряда 1–6 — при θ ≡ −45° − o_k
const PIN_OFF = [0, 1, 2, 3, 4, 5].map((k) => (((-BETA / DEG - FIRE_AT[k + 1]) % 360) + 360) % 360)

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
const hullRing = (circles, dr) => hull(circles.flatMap(([y, z, r]) => Array.from({ length: 64 }, (_, i) => P((i / 64) * Math.PI * 2, r + dr).add(new THREE.Vector2(y, z)))))
function beltShape(pulleys, t) {
  const s = new THREE.Shape(hullRing(pulleys, t))
  s.holes.push(new THREE.Path(hullRing(pulleys, 0).reverse()))
  return s
}
// прокладка головки: пластина по размеру головки, отверстие под цилиндр, болты и переходы воды; профиль в (x, z)
function headGasketShape() {
  const w = 0.73, r = 0.08
  const s = new THREE.Shape()
  s.moveTo(-w + r, -w)
  s.lineTo(w - r, -w)
  s.absarc(w - r, -w + r, r, -Math.PI / 2, 0, false)
  s.lineTo(w, w - r)
  s.absarc(w - r, w - r, r, 0, Math.PI / 2, false)
  s.lineTo(-w + r, w)
  s.absarc(-w + r, w - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-w, -w + r)
  s.absarc(-w + r, -w + r, r, Math.PI, Math.PI * 1.5, false)
  const hole = (x, z, rr) => {
    const h = new THREE.Path()
    h.absarc(x, z, rr, 0, Math.PI * 2, true)
    s.holes.push(h)
  }
  hole(0, 0, 0.52) // цилиндр
  for (const [x, z] of [[-0.52, -0.52], [0.52, -0.52], [-0.52, 0.52], [0.52, 0.52]]) hole(x, z, 0.06) // болты головки
  for (const z of [-0.64, 0.64]) hole(0, z, 0.045) // переходы воды из рубашки в головку
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
// round — круглый значок (номера болтов в схеме затяжки, чтобы не путать с номерами цилиндров)
function drawBadge(c, n, active, round = false) {
  const g = c.getContext('2d')
  g.clearRect(0, 0, 128, 128)
  g.fillStyle = active ? MILK : 'rgba(20,21,23,0.9)'
  g.strokeStyle = MILK
  g.lineWidth = 5
  if (round) {
    g.beginPath()
    g.arc(64, 64, 54, 0, Math.PI * 2)
    g.fill()
    if (!active) g.stroke()
  } else {
    g.fillRect(10, 10, 108, 108)
    if (!active) g.strokeRect(12.5, 12.5, 103, 103)
  }
  g.fillStyle = active ? INK : MILK
  g.font = BADGE_FONT
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(n), 64, 68)
}
function numberTexture(n, active = false, round = false) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  drawBadge(c, n, active, round)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  // перерисовка после загрузки шрифта Oswald
  t.userData.redraw = () => {
    drawBadge(c, n, active, round)
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
  // разнос отдельных деталей поверх общего: { id детали: доля 0…1 } — для анимации «деталь встаёт на место»
  const partExp = {}
  const expOf = (obj) => partExp[obj.userData.expPart] ?? explodeF
  function reg(obj, partId, space, out = 1) {
    const e = PART[partId]?.explode
    const v = new THREE.Vector3()
    if (e?.bank && space === 'bank') v.set(0, e.bank[0], out * e.bank[1])
    if (e?.world) v.set(...e.world)
    obj.userData.base = obj.position.clone()
    obj.userData.exp = v
    obj.userData.expPart = partId
    placed.push(obj)
    return obj
  }
  function setPos(obj, x, y, z) {
    obj.userData.base.set(x, y, z)
    obj.position.copy(obj.userData.base).addScaledVector(obj.userData.exp, expOf(obj))
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
    // прокладка головки с металлической окантовкой вокруг цилиндра
    headGasket: merge([
      new THREE.ExtrudeGeometry(headGasketShape(), { depth: 0.04, bevelEnabled: false, curveSegments: 20 }).translate(0, 0, -0.02).rotateX(-Math.PI / 2),
      new THREE.TorusGeometry(0.535, 0.02, 6, 40).rotateX(Math.PI / 2),
    ]),
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
  // хвостовик: на нём шестерня распределения, за ней фланец маховика
  const tail = mk(cylX(0.3, 1.3), 'crank')
  tail.position.x = 5.31 + 0.65
  const flange = mk(cylX(0.78, 0.3), 'crank')
  flange.position.x = 6.75
  crankG.add(nose, tail, flange)

  // крышки коренных подшипников: полукольцо снизу шейки + два болта
  const capShape = new THREE.Shape([new THREE.Vector2(0, -0.7), new THREE.Vector2(-0.75, -0.7), new THREE.Vector2(-0.75, 0.7), new THREE.Vector2(0, 0.7)])
  for (let i = 0; i <= 12; i++) capShape.lineTo(...P(Math.PI / 2 + (Math.PI * i) / 12, 0.38).toArray())
  const capGeo = merge([
    profile(capShape, 0.32, 4),
    ...[-0.52, 0.52].flatMap((z) => [at(new THREE.CylinderGeometry(0.05, 0.05, 0.78, 8), 0, -0.41, z), at(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 6), 0, -0.8, z)]),
    // горизонтальные стяжные болты: через стенки картера в бока крышки
    ...[-1, 1].flatMap((sd) => [at(cylZ(0.05, 0.95, 8), 0, -0.32, sd * 1.2), at(cylZ(0.1, 0.1, 6), 0, -0.32, sd * 1.72)]),
  ])
  geos.add(capGeo)
  const mainCaps = []
  for (let i = 0; i < 7; i++) {
    const m = mk(capGeo, 'maincap', { label: `Крышка коренного подшипника № ${i + 1}` })
    m.position.x = PITCH * (i - 3)
    root.add(reg(m, 'maincap', 'world'))
    mainCaps.push(m)
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
  const sealR = mk(ringX(0.3, 0.46, 0.1, 40), 'seal', { label: 'Задняя манжета' })
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
  fly.position.x = 7.15
  fly.userData.base.copy(fly.position)
  const flyDisc = mk(cylX(1.35, 0.45, 64), 'flywheel')
  // зубчатый венец под шестерню стартера
  const ring = mk(profile(ringGearShape(100, 1.47, 1.3), 0.22, 40), 'flywheel')
  ring.position.x = 0.1
  const flyMark = mk(new THREE.BoxGeometry(0.05, 0.42, 0.1), 'gearmark')
  flyMark.position.set(0.24, 1.1, 0)
  fly.add(flyDisc, ring, flyMark)
  root.add(fly)

  // ---------- шестерни распределения (плоскость за задним торцом блока, перед маховиком)
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
    // метки на задней стороне шестерён: их видно со стороны маховика
    m.position.set(0.17, (rp - 0.13) * Math.cos(localAngle), (rp - 0.13) * Math.sin(localAngle))
    g.add(m)
  }
  mark(gearC, th1, rpOf(NC))
  mark(gearI, th1 + Math.PI - rotI0, rpOf(NI))
  mark(gearI, th2 - rotI0, rpOf(NI), true)
  mark(gearK, th2 + Math.PI - rotK0, rpOf(NK), true)
  // шестерня привода ТНВД: над шестернёй распредвала, зубьев столько же —
  // насос крутится, как распредвал, вдвое медленнее коленвала (один впрыск в цилиндр за цикл)
  const gP = new THREE.Vector2(CAM_Y + 2 * rpOf(NK), 0)
  const rotP0 = meshOffset(0, rotK0, NK, NK)
  const gearP = gear(NK, gP, 'Шестерня привода ТНВД')
  mark(gearK, -rotK0, rpOf(NK), true)
  mark(gearP, Math.PI - rotP0, rpOf(NK), true)

  // картер маховика: литой «колокол» на заднем торце блока. Спереди в нём шестерни распределения,
  // за перегородкой — маховик; снизу-слева на нём стоит стартер. Контур (y, z): круг вокруг маховика
  // и выступ вверх над шестернями распредвала и привода ТНВД
  {
    const H = [[0, 0, 1.7], [CAM_Y, 0, 1.15], [gP.x, 0, 1.15]]
    const x0 = 5.6, x1 = 7.55
    const wall = new THREE.Shape(hullRing(H, 0.08))
    const hole = new THREE.Path()
    hole.absarc(0, 0, 0.36, 0, Math.PI * 2, true)
    wall.holes.push(hole)
    const geo = merge([
      at(profile(beltShape(H, 0.08), x1 - x0, 8), (x0 + x1) / 2, 0, 0), // стенки
      at(profile(wall, 0.08, 8), 6.44, 0, 0), // перегородка между шестернями и маховиком
      at(profile(beltShape(H, 0.22), 0.08, 8), x0 + 0.04, 0, 0), // фланец к блоку
      at(profile(beltShape(H, 0.25), 0.08, 8), x1 - 0.04, 0, 0), // фланец к коробке передач
    ])
    root.add(reg(mk(geo, 'flyhousing'), 'flyhousing', 'world'))
  }

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
  // приёмная труба выпуска в координатах ряда: от фланца коллектора вниз и наружу
  const EXH_PIPE = (o) => [V3(5.4, 3.5, o * 1.35), V3(5.85, 3.5, o * 1.4), V3(6.15, 3.2, o * 1.55), V3(6.3, 2.5, o * 1.7), V3(6.35, 1.8, o * 1.75)]
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
    // выпускной коллектор снаружи ряда
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
    // приёмная труба от заднего конца коллектора: газы уходят вниз-назад, дальше на машине к глушителю
    const ep = reg(
      mk(
        merge([
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(EXH_PIPE(out), false, 'centripetal'), 32, 0.2, 14),
          at(cylX(0.3, 0.07, 20), 5.42, 3.5, out * 1.35),
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
  // ТНВД в развале над впускным коллектором: начало координат группы — ось привода (ось шестерни привода).
  // Нижний корпус с кулачковым валом насоса, над ним два ряда по 6 секций (наклонены к своим рядам цилиндров),
  // на каждой секции штуцер трубки ВД. Спереди регулятор частоты вращения, сзади муфта опережения впрыска
  // и вал к шестерне привода, сбоку топливоподкачивающий насос с ручным насосом прокачки.
  const pump = reg(new THREE.Group(), 'pump', 'world')
  pump.position.set(PUMP_X, gP.x, 0)
  pump.userData.base.copy(pump.position)
  {
    const parts = [at(new RoundedBoxGeometry(3.2, 0.5, 0.76, 3, 0.08), 0, 0.25, 0)]
    for (const s of [-1, 1]) {
      const c = pumpOut(0, s, 0.3)
      parts.push(new RoundedBoxGeometry(2.9, 0.6, 0.34, 3, 0.06).rotateX(s * PUMP_TILT).translate(0, c.y, c.z))
      for (let k = 0; k < 6; k++) {
        parts.push(cylBetween(pumpOut(k, s, 0.58), pumpOut(k, s, 0.8), 0.05, 8))
        parts.push(cylBetween(pumpOut(k, s, 0.6), pumpOut(k, s, 0.7), 0.085, 6))
      }
    }
    // регулятор: корпус, задняя крышка и рычаг управления подачей
    parts.push(at(new RoundedBoxGeometry(0.95, 0.8, 0.82, 3, 0.1), -2.07, 0.42, 0))
    parts.push(at(cylX(0.3, 0.08, 24), -2.58, 0.42, 0))
    parts.push(at(new THREE.BoxGeometry(0.07, 0.34, 0.07), -2.2, 0.95, 0.24))
    // муфта опережения впрыска и вал к шестерне привода
    parts.push(at(cylX(0.3, 0.35, 28), 1.8, 0, 0))
    parts.push(at(cylX(0.12, 0.45, 12), 2.15, 0, 0))
    // топливоподкачивающий насос сбоку (сторона топливного фильтра) и ручной насос прокачки на нём
    parts.push(at(new RoundedBoxGeometry(0.42, 0.38, 0.3, 2, 0.05), 1.4, 0.22, -0.58))
    parts.push(at(new THREE.CylinderGeometry(0.06, 0.06, 0.36, 10), 1.4, 0.58, -0.68))
    parts.push(at(new THREE.SphereGeometry(0.09, 12, 8), 1.4, 0.78, -0.68))
    pump.add(mk(merge(parts), 'pump'))
  }
  root.add(pump)
  const wp = reg(new THREE.Group(), 'waterpump', 'world')
  wp.position.set(-6.0, -0.75, -1.35)
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
      'starter', 7.38, sy, sz,
    )
  }
  // генератор спереди справа, шкив перед блоком
  addWorld(
    merge([cylX(0.42, 0.8, 28), at(cylX(0.22, 0.14, 20), -0.6, 0, 0), at(cylX(0.08, 0.3, 8), -0.45, 0, 0), at(new THREE.BoxGeometry(0.3, 0.5, 0.2), 0, -0.4, -0.25)]),
    'generator', -6.05, 0.9, 1.95,
  )
  // шкив водяного насоса в плоскости ремня, на валу насоса
  wp.add(mk(merge([at(cylX(0.07, 0.45, 10), -0.42, 0, 0), at(cylX(0.25, 0.14, 28), -0.65, 0, 0)]), 'waterpump'))
  // вентилятор перед двигателем, между шкивами и радиатором: крыльчатка на своём валу в кронштейне на переднем
  // торце блока, шкив в плоскости ремня; кожух вокруг лопастей направляет воздух через радиатор
  const fanG = reg(new THREE.Group(), 'fan', 'world')
  fanG.position.set(FAN_X, FAN_Y, 0)
  fanG.userData.base.copy(fanG.position)
  fanG.add(
    mk(
      merge([
        cylX(0.24, 0.22, 24),
        at(cylX(0.07, 0.5, 10), 0.3, 0, 0),
        at(cylX(0.3, 0.14, 28), 0.4, 0, 0),
        ...Array.from({ length: 8 }, (_, i) => new THREE.BoxGeometry(0.03, 1.03, 0.32).rotateY(25 * DEG).translate(0, 0.735, 0).rotateX((i * Math.PI) / 4)),
      ]),
      'fan',
      { label: 'Крыльчатка вентилятора' },
    ),
  )
  root.add(fanG)
  addWorld(
    merge([
      ringX(1.32, 1.37, 0.36, 56),
      // стойки кожуха к радиатору
      ...[45, 135, 225, 315].map((a) => at(cylX(0.03, 0.14, 6), -0.24, 1.345 * Math.cos(a * DEG), 1.345 * Math.sin(a * DEG))),
      // кронштейн вала вентилятора: корпус подшипников, стойка вниз и лапа к переднему торцу блока
      at(cylX(0.17, 0.4, 16), 0.68, 0, 0),
      at(new THREE.BoxGeometry(0.08, FAN_Y - 0.85, 0.3), 0.89, -(FAN_Y - 0.85) / 2, 0),
      at(new THREE.BoxGeometry(0.58, 0.1, 0.3), 1.16, 0.9 - FAN_Y, 0),
    ]),
    'fan', FAN_X, FAN_Y, 0, { label: 'Кожух и кронштейн вентилятора' },
  )
  // приводные ремни в плоскости x = −6.65: шкив вала (на гасителе) → шкив вентилятора → генератор → насос
  addWorld(profile(beltShape([[0, 0, 0.5], [FAN_Y, 0, 0.3], [0.9, 1.95, 0.22], [-0.75, -1.35, 0.25]], 0.045), 0.12, 6), 'belt', -6.65, 0, 0)
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
  // топливный фильтр на левом боку блока: корпус с кронштейном, банка (центр y −0.6)
  addWorld(
    merge([
      new THREE.CylinderGeometry(0.28, 0.28, 0.75, 20),
      at(new RoundedBoxGeometry(0.66, 0.2, 0.66, 2, 0.05), 0, 0.47, 0),
      at(new THREE.BoxGeometry(0.3, 0.16, 0.4), 0, 0.47, 0.42),
      // штуцеры: вход (к баку) и выход (к ТНВД)
      at(cylX(0.06, 0.16, 10), -0.38, 0.47, 0),
      at(cylX(0.06, 0.16, 10), 0.38, 0.47, 0),
    ]),
    'fuelfilter', 3.0, -0.6, -1.95,
  )
  // элемент топливного фильтра: шторка и центральная трубка в корпус
  {
    const star = new THREE.Shape()
    for (let i = 0; i <= 40; i++) {
      const p = P((i / 40) * Math.PI * 2, i % 2 ? 0.19 : 0.23)
      i ? star.lineTo(p.x, p.y) : star.moveTo(p.x, p.y)
    }
    const hole = new THREE.Path()
    hole.absarc(0, 0, 0.09, 0, Math.PI * 2, true)
    star.holes.push(hole)
    const el = new THREE.ExtrudeGeometry(star, { depth: 0.6, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -0.32, 0)
    addWorld(merge([el, at(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 10, 1, true), 0, 0.12, 0)]), 'fuelel', 3.0, -0.6, -1.95)
  }
  // воздушный фильтр над развалом: корпус с элементом, заборник спереди, патрубок вниз во впускной коллектор.
  // На машине фильтр обычно стоит отдельно и соединён с двигателем патрубком
  addWorld(
    merge([
      cylX(0.55, 2.4, 36),
      at(cylX(0.58, 0.07, 36), -1.2, 0, 0),
      at(cylX(0.58, 0.07, 36), 1.2, 0, 0),
      at(cylX(0.22, 0.5, 16), -1.45, 0, 0),
      at(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 16), 0, -1.1, 0),
    ]),
    'airfilter', 0, 5.1, 0,
  )

  // ---------- цилиндры
  const injFitGeo = {}
  for (const side of ['L', 'R']) {
    const o = side === 'R' ? 1 : -1, dx = injFitDx(side), y = INJ_FIT_Y
    injFitGeo[side] = merge([
      cylBetween(V3(0, y, 0), V3(dx, y, -o * 0.6), 0.045, 8),
      cylBetween(V3(dx, y, -o * 0.6), V3(dx, y, -o * 0.86), 0.045, 8),
      at(cylZ(0.07, 0.1, 6), dx, y, -o * 0.82),
    ])
    geos.add(injFitGeo[side])
  }
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
    // прокладка в стыке головки и блока (плоскость блока)
    const gasket = mk(G.headGasket, 'headgasket', inf)
    gasket.position.set(x, DECK, 0)
    add(gasket, 'headgasket')
    const inj = new THREE.Group()
    const injBody = mk(G.injector, 'injector')
    injBody.position.y = 0
    const injTop = mk(G.injTop, 'injector')
    injTop.position.y = 0.6
    // боковой штуцер: внутри головки к стенке со стороны развала, гайка снаружи стенки
    const injFit = mk(injFitGeo[side], 'injector')
    inj.add(injBody, injTop, injFit)
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

    cyls.push({ c, side, out, x, beta, piston, rings, ppin, rod, rcap, inj, hb, flash, fm, valves, sprite: sp })
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

  // ================================================================
  // смазка: насос → фильтр → магистраль → коренные опоры → по сверлениям вала к шатунным;
  // от магистрали вверх к опорам распредвала и к осям коромысел. Все точки — координаты root,
  // они же служат маршрутами бегущих точек (см. «потоки»).
  const tubeG = (pts, r, seg = 40, rs = 8) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg, r, rs)
  const OILR = {
    // от насоса вверх по борту блока к корпусу фильтра
    toFilter: [V3(-5.6, -1.0, 1.3), V3(-4.6, -0.85, 2.0), V3(-3.2, -0.2, 2.05), V3(-2.52, 0.11, 1.98)],
    // из центральной трубки фильтра в главную магистраль
    toGallery: [V3(-2.2, 0.12, 1.95), V3(-2.2, 0.2, 1.62), V3(-2.2, 0.2, 1.35)],
    // сверления в блоке: от магистрали к опорам распредвала. Идут в промежутке между гильзами
    // правого ряда (x = опора + 0.28), под кулачками — вбок к шейке
    toCam: (m) => [V3(m + 0.28, 0.2, 1.35), V3(m + 0.28, 0.85, 0.85), V3(m + 0.28, 1.1, 0.3), V3(m + 0.28, 1.12, 0), V3(m, 1.12, 0), V3(m, CAM_Y - 0.28, 0)],
  }
  // каналы в координатах ряда: от второй опоры распредвала вверх между головками к оси коромысел
  const ROCK_M = -PITCH * 2
  const rockerFeed = (o) => {
    const gx = ROCK_M + o * OFF
    return [V3(ROCK_M, CAM_Y * Math.cos(BETA) + 0.3, -o * PUSH_W), V3(ROCK_M, 2.3, -o * PUSH_W), V3(gx, 2.7, -o * 0.98), V3(gx, 3.9, -o * 0.6), V3(gx, PIVOT, -o * 0.55)]
  }
  addWorld(merge([tubeG(OILR.toFilter, 0.06), tubeG(OILR.toGallery, 0.06, 12), ...[0, 1, 2, 3, 4, 5, 6].map((i) => tubeG(OILR.toCam(PITCH * (i - 3)), 0.035, 30, 6))]), 'oilchannel', 0, 0, 0, { label: 'Масляные трубки и сверления блока' })
  for (const side of ['L', 'R']) {
    const o = side === 'R' ? 1 : -1
    banks[side].add(reg(mk(tubeG(rockerFeed(o), 0.035, 30, 6), 'oilchannel', { label: 'Подвод масла к оси коромысел' }), 'oilchannel', 'bank', o))
  }
  // сверления коленвала: от коренной шейки через щёку в шатунную, к каждому из двух шатунов
  for (let k = 0; k < 6; k++) {
    const xk = PITCH * (k - 2.5), o = PIN_OFF[k] * DEG
    const parts = []
    for (const sx of [-1, 1]) {
      const a = V3(xk + sx * 0.78, -0.24 * Math.cos(o), -0.24 * Math.sin(o))
      const b = V3(xk + sx * 0.2, (R + 0.18) * Math.cos(o), (R + 0.18) * Math.sin(o))
      parts.push(cylBetween(a, b, 0.035, 8), at(new THREE.SphereGeometry(0.05, 8, 6), a.x, a.y, a.z))
    }
    crankG.add(mk(merge(parts), 'oilchannel', { label: 'Масляные каналы коленвала' }))
  }
  // масляный фильтр изнутри: корпус над банкой, гофрированная бумажная шторка, центральная трубка
  addWorld(new RoundedBoxGeometry(0.9, 0.22, 0.85, 2, 0.05), 'oilfilter', -2.2, 0.11, 1.95, { label: 'Корпус масляного фильтра' })
  {
    const star = new THREE.Shape()
    for (let i = 0; i <= 48; i++) {
      const p = P((i / 48) * Math.PI * 2, i % 2 ? 0.26 : 0.31)
      i ? star.lineTo(p.x, p.y) : star.moveTo(p.x, p.y)
    }
    const hole = new THREE.Path()
    hole.absarc(0, 0, 0.13, 0, Math.PI * 2, true)
    star.holes.push(hole)
    const el = new THREE.ExtrudeGeometry(star, { depth: 0.8, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -0.42, 0)
    // банка фильтра: y −1…0, центр −0.5; трубка выходит вверх в корпус
    addWorld(merge([el, at(new THREE.CylinderGeometry(0.085, 0.085, 1.0, 12, 1, true), 0, 0.08, 0)]), 'filterel', -2.2, -0.5, 1.95)
  }

  // ================================================================
  // топливо низкого давления: подвод (от бака) → фильтр → ТНВД. Дальше — трубки высокого давления
  const FUELR = {
    // от бака: конец трубки со штуцером у переднего края фильтра
    inlet: [V3(0.9, -0.62, -2.75), V3(2.0, -0.45, -2.55), V3(2.45, -0.15, -2.1), V3(2.62, -0.13, -1.95)],
    // от фильтра назад вдоль блока, за последним цилиндром левого ряда вверх к подкачивающему насосу на ТНВД
    toPump: [V3(3.38, -0.13, -1.95), V3(4.3, -0.05, -2.05), V3(5.4, 0.4, -2.0), V3(5.5, 1.6, -1.6), V3(5.5, 2.8, -1.15), V3(5.4, 3.5, -0.9), V3(PUMP_X + 1.4, 3.72, -0.74)],
  }
  addWorld(
    merge([
      tubeG(FUELR.inlet, 0.05, 24, 8),
      tubeG(FUELR.toPump, 0.05, 48, 8),
      // накидная гайка на конце подвода
      at(cylX(0.08, 0.12, 6), 0.9, -0.62, -2.75),
    ]),
    'fuelline', 0, 0, 0, { label: 'Топливопроводы низкого давления' },
  )

  // ================================================================
  // охлаждение: насос → трубы к рядам → водяные каналы блока → рубашки гильз → головки →
  // сборные каналы → термостат → радиатор (или перепуск обратно в насос, пока не прогрелся)
  const WTR = {
    // концы: начало водяного канала ряда (y 1.35, z ±0.9 в координатах ряда) при наклоне ряда 45°
    feedL: [V3(-5.95, -0.3, -1.4), V3(-5.72, 0.05, -1.55), V3(-5.33, 0.32, -1.59)],
    feedR: [V3(-5.95, -0.55, -0.95), V3(-5.76, -0.62, -0.3), V3(-5.76, -0.62, 0.45), V3(-5.76, -0.45, 0.95), V3(-5.7, 0.1, 1.5), V3(-4.77, 0.32, 1.59)],
    // перепуск (малый круг): из термостата вниз по передней стенке в насос
    bypass: [V3(-5.55, 2.72, 0), V3(-5.74, 2.5, -0.25), V3(-5.74, 2.0, -0.65), V3(-5.74, 1.0, -0.95), V3(-5.74, 0.2, -1.0), V3(-5.95, -0.38, -1.05)],
    // верхний патрубок: термостат → верхний бачок радиатора; нижний: нижний бачок → насос
    upper: [V3(-6.4, 3.47, 0), V3(-6.9, 3.45, 0), V3(-7.3, 3.25, 0), V3(-7.48, 3.08, 0)],
    lower: [V3(-7.48, -0.5, -1.1), V3(-7.2, -0.75, -1.9), V3(-6.6, -0.78, -2.35), V3(-6.0, -0.75, -2.3)],
  }
  const WGAL = 0.9 // водяной канал ряда: (y 1.35, z = o·0.9) в координатах ряда
  const WRAIL = 0.66 // сборный канал головок: (y 3.2, z = o·0.66)
  const wFront = (o) => (o > 0 ? OFF : -OFF) - 5.05
  // от сборного канала ряда к термостату (в координатах root)
  const toThermo = (side) => {
    const o = side === 'R' ? 1 : -1
    return [banks[side].localToWorld(V3(wFront(o), 3.2, o * WRAIL)), banks[side].localToWorld(V3(wFront(o) - 0.3, 3.25, o * 0.3)), V3(-5.5, 2.85, o * 0.45), V3(-5.55, 2.85, o * 0.18)]
  }
  addWorld(merge([tubeG(WTR.feedL, 0.09, 16, 10), tubeG(WTR.feedR, 0.09, 40, 10), tubeG(WTR.bypass, 0.06, 40, 8), tubeG(WTR.upper, 0.12, 20, 12), tubeG(WTR.lower, 0.12, 24, 12), tubeG(toThermo('L'), 0.07, 20, 8), tubeG(toThermo('R'), 0.07, 20, 8)]), 'waterpipe', 0, 0, 0, { label: 'Водяные трубы и патрубки' })
  for (const side of ['L', 'R']) {
    const o = side === 'R' ? 1 : -1, sh = o * OFF
    const list = [
      at(cylX(0.08, 10.1, 12), sh - 0.1, 1.35, o * WGAL), // канал вдоль ряда у рубашек
      at(cylX(0.06, 10.15, 10), sh - 0.1, 3.2, o * WRAIL), // сборный канал в головках
    ]
    for (const cy of cyls.filter((c) => c.side === side)) {
      list.push(cylBetween(V3(cy.x, 1.35, o * WGAL), V3(cy.x, 1.35, o * 0.68), 0.05, 8)) // вход в рубашку гильзы
      list.push(cylBetween(V3(cy.x, 2.8, o * 0.68), V3(cy.x, 3.2, o * 0.68), 0.04, 8)) // переход из рубашки в головку
    }
    banks[side].add(reg(mk(merge(list), 'waterpipe', { label: 'Водяные каналы блока и головок' }), 'waterpipe', 'bank', o))
  }
  // радиатор перед двигателем: сердцевина из трубок, верхний и нижний бачки
  addWorld(
    merge([
      new THREE.BoxGeometry(0.22, 3.2, 3.0),
      ...Array.from({ length: 17 }, (_, i) => at(new THREE.BoxGeometry(0.3, 3.2, 0.025), 0, 0, -1.44 + i * 0.18)),
      at(new RoundedBoxGeometry(0.38, 0.3, 3.15, 2, 0.06), 0, 1.75, 0),
      at(new RoundedBoxGeometry(0.38, 0.3, 3.15, 2, 0.06), 0, -1.75, 0),
    ]),
    'radiator', -7.5, 1.3, 0,
  )
  // крыльчатка внутри корпуса водяного насоса
  const impeller = mk(merge([cylX(0.12, 0.3, 12), ...Array.from({ length: 6 }, (_, i) => at(new THREE.BoxGeometry(0.22, 0.4, 0.05), 0, 0.22, 0).rotateX((i * Math.PI) / 3))]), 'impeller')
  wp.add(impeller)

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
  // трубки высокого давления: от штуцера своей секции ТНВД вверх и вбок на «дорожку» вдоль развала,
  // по ней вперёд к своему цилиндру и вниз к боковому штуцеру форсунки (под клапанной крышкой не проходят).
  // Дорожки разнесены вбок: чем дальше цилиндр, тем ближе к середине — трубки не пересекаются
  const injWorld = (cy, z) => {
    cy.inj.updateWorldMatrix(true, false)
    return cy.inj.localToWorld(V3(injFitDx(cy.side), INJ_FIT_Y, -cy.out * z))
  }
  for (const cy of cyls) {
    const k = (cy.c - 1) % 6
    const s = cy.out
    const lz = s * (0.75 + 0.09 * k)
    tube('hpline', 0.035, 64, () => {
      const a = pump.localToWorld(pumpOut(k, s, 0.8))
      const b = pump.localToWorld(pumpOut(k, s, 0.9))
      const ly = pump.position.y + 0.95
      const near = injWorld(cy, 1.3)
      const pts = [a, b, V3(a.x - 0.15, ly, lz)]
      if (a.x - 0.15 - near.x > 0.4) pts.push(V3(near.x, ly, lz))
      return [...pts, near, injWorld(cy, 0.88)]
    }, { cyl: cy.c })
  }
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
    // масло: маслоприёмник → насос → фильтр (снаружи внутрь через шторку, вверх по центральной трубке) →
    // главная магистраль → коренные опоры, опоры распредвала, оси коромысел → стекает в поддон
    const Wb = (side) => (v) => banks[side].localToWorld(v.clone())
    const oil = [
      path(V3(1.6, -2.86, 0), V3(1.5, -2.45, 0.2), V3(0.2, -2.18, 0.5), V3(-4.4, -2.05, 0.85), V3(-5.5, -1.75, 1.0), V3(-5.85, -1.15, 1.0)),
      path(V3(-5.85, -1.15, 1.0), ...OILR.toFilter),
      path(V3(-2.2, 0.2, 1.35), V3(5.4, 0.2, 1.35)),
      path(V3(-2.2, 0.2, 1.35), V3(-5.4, 0.2, 1.35)),
    ]
    for (const a of [100, 180, 260].map((d) => d * DEG)) {
      const c = (r) => [-2.2 + r * Math.cos(a), 1.95 + r * Math.sin(a)]
      const [ox, oz] = c(0.34), [ix, iz] = c(0.18)
      oil.push({ pts: [OILR.toFilter.at(-1), V3(ox, 0.04, oz), V3(ox, -0.7, oz), V3(ix, -0.72, iz), V3(-2.2, -0.68, 1.95), V3(-2.2, 0.06, 1.95), ...OILR.toGallery], speed: 0.6 })
    }
    const dir = new THREE.Vector3(0, 0.2, 1.35).normalize()
    for (let i = 0; i < 7; i++) {
      const x = PITCH * (i - 3)
      oil.push({ pts: [V3(x, 0.2, 1.35), V3(x, 0, 0).addScaledVector(dir, 0.38)], speed: 0.6 })
      oil.push({ pts: [V3(x, -0.35, 0.1), V3(x + 0.2, -1.2, 0.2), V3(x + 0.3, -2.05, 0.1)], speed: 0.45 })
      oil.push({ pts: OILR.toCam(x), speed: 0.6 })
    }
    for (const side of ['L', 'R']) {
      const o = side === 'R' ? 1 : -1, w = Wb(side), gx = ROCK_M + o * OFF
      oil.push({ pts: rockerFeed(o).map(w), speed: 0.6 })
      // внутри полой оси коромысел — к каждому коромыслу, оттуда стекает вниз вдоль штанг
      oil.push(path(w(V3(gx, PIVOT, -o * 0.55)), w(V3(sh(side) + 4.85, PIVOT, -o * 0.55))))
      oil.push(path(w(V3(gx, PIVOT, -o * 0.55)), w(V3(sh(side) - 4.85, PIVOT, -o * 0.55))))
      for (const cy of bankCyls(side)) {
        const xt = cy.x + TAP_X[side][0]
        oil.push({ pts: [w(V3(xt, PIVOT - 0.12, -o * PUSH_W)), w(V3(xt, 3.0, -o * (PUSH_W + 0.06))), w(V3(xt, 2.45, -o * (PUSH_W + 0.06)))], speed: 0.35 })
      }
    }
    flows.define('oil', '#d8b35c', oil)
    // охлаждающая жидкость: насос → трубы к рядам → каналы рядов → рубашки гильз → головки →
    // сборные каналы → термостат → радиатор → насос; пока холодно — перепуск сразу в насос
    const water = [
      path(V3(-6.0, -0.75, -1.35), ...WTR.feedL),
      path(V3(-6.0, -0.75, -1.35), ...WTR.feedR),
      path(V3(-5.55, 2.85, 0), V3(-5.55, 3.47, 0), ...WTR.upper),
      path(...WTR.lower),
      { pts: WTR.bypass, speed: 0.5 },
    ]
    for (const z of [-1.2, -0.6, 0, 0.6, 1.2]) water.push({ pts: [V3(-7.5, 3.05, 0), V3(-7.5, 3.05, z), V3(-7.5, -0.45, z), V3(-7.48, -0.5, -1.1)], speed: 0.7 })
    for (const side of ['L', 'R']) {
      const o = side === 'R' ? 1 : -1, w = Wb(side), f = wFront(o)
      water.push(path(w(V3(f, 1.35, o * WGAL)), w(V3(sh(side) + 4.95, 1.35, o * WGAL))))
      for (const cy of bankCyls(side)) water.push({ pts: [V3(cy.x, 1.35, o * WGAL), V3(cy.x, 1.35, o * 0.7), V3(cy.x, 1.9, o * 0.7), V3(cy.x, 2.8, o * 0.68), V3(cy.x, 3.2, o * 0.68)].map(w), speed: 0.6 })
      water.push(path(w(V3(sh(side) + 4.95, 3.2, o * WRAIL)), w(V3(f, 3.2, o * WRAIL)), ...toThermo(side).slice(1)))
    }
    flows.define('water', '#86a8c6', water)
    // воздух: фильтры → компрессоры → охладитель → коллектор → патрубки → каналы головок → впускные клапаны
    // воздух: заборник → фильтр → патрубок вниз → впускной коллектор в обе стороны
    const airIn = path(V3(-1.75, 5.1, 0), V3(-0.4, 5.1, 0), V3(0, 4.85, 0), V3(0, 3.1, 0))
    const inGallery = [path(V3(0, 3.08, 0), V3(5.0, 3.08, 0)), path(V3(0, 3.08, 0), V3(-5.0, 3.08, 0))]
    const air = [airIn, ...inGallery]
    for (const cy of cyls) air.push({ pts: inPath(cy), speed: 0.5 })
    flows.define('air', '#a2c08f', air)
    // выхлоп: выпускные клапаны → каналы головок → коллектор ряда → приёмная труба
    const exOut = (side) => {
      const o = side === 'R' ? 1 : -1
      return EXH_PIPE(o).map((v) => W(side, sh(side) + v.x, v.y, v.z))
    }
    const ex = []
    for (const cy of cyls) ex.push({ pts: exPath(cy), speed: 0.5 })
    for (const side of ['L', 'R']) {
      const o = side === 'R' ? 1 : -1
      ex.push(path(W(side, sh(side) - 4.9, 3.5, o * 1.35), W(side, sh(side) + 5.2, 3.5, o * 1.35), ...exOut(side)))
    }
    flows.define('exhaust', '#cc6e5a', ex)
    // топливо: от бака → фильтр → ТНВД → трубки высокого давления → форсунки
    // топливо: подвод → корпус фильтра → вниз по краю банки → сквозь шторку внутрь → вверх по трубке →
    // выход → ТНВД → трубки высокого давления → форсунки
    const fuelIn = path(...FUELR.inlet)
    const fuel = [fuelIn, path(...FUELR.toPump, V3(PUMP_X + 1.4, 3.72, -0.4), V3(PUMP_X, 3.75, 0)), ...tubePts('hpline').map((p) => ({ ...p, speed: 1.6 }))]
    for (const a of [90, 180, 270].map((d) => d * DEG)) {
      const c = (r) => [3.0 + r * Math.cos(a), -1.95 + r * Math.sin(a)]
      const [ox, oz] = c(0.25), [ix, iz] = c(0.12)
      fuel.push({ pts: [FUELR.inlet.at(-1), V3(ox, -0.2, oz), V3(ox, -0.85, oz), V3(ix, -0.86, iz), V3(3.0, -0.82, -1.95), V3(3.0, -0.15, -1.95), FUELR.toPump[0]], speed: 0.6 })
    }
    flows.define('fuel', '#de8d55', fuel)

    // режим «Работа»: общие потоки (по цилиндрам частицы рисует operation.js)
    // двигатель без наддува: поршень сам засасывает воздух через фильтр
    const opAir = [{ ...airIn, pts: [V3(-2.6, 5.1, 0), ...airIn.pts] }, ...inGallery]
    const opExh = []
    for (const side of ['L', 'R']) {
      const o = side === 'R' ? 1 : -1
      opExh.push(path(W(side, sh(side) - 4.9, 3.5, o * 1.35), W(side, sh(side) + 5.2, 3.5, o * 1.35)))
      // по приёмной трубе газы уходят вниз и дальше, в глушитель
      opExh.push({ pts: [...exOut(side), W(side, sh(side) + 6.35, 0.8, o * 1.8)], speed: 1.4 })
    }
    flows.define('op_air', '#a2c08f', opAir, { density: 6, size: 0.24 })
    flows.define('op_exh', '#958e84', opExh, { density: 6, size: 0.3 })
    flows.define('op_fuel', '#de8d55', [fuelIn, fuel[1], ...fuel.slice(-3)], { density: 7, size: 0.22, speed: 1.0 })
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
    impeller.rotation.x = th * (0.5 / 0.25) // шкивы вала и насоса
    fanG.rotation.x = th * (0.5 / 0.3)
    gearI.rotation.x = rotI0 - th * (NC / NI)
    gearK.rotation.x = rotK0 + th * (NC / NK)
    gearP.rotation.x = rotP0 - th * (NC / NK)
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
      cy.flash.visible = f > 0.01 && flashScale > 0 && (!soloOn() || soloOn().has(cy.c))
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
  // hidden — детали, скрытые пользователем; solo — Set цилиндров, детали остальных не показываем
  const state = { selected: null, hover: null, layer: 'all', casing: 0.3, cylinder: null, only: null, fresh: null, op: false, glass: true, hidden: new Set(), solo: null, flows: null, xray: null }
  const soloOn = () => (state.only ? null : state.solo)
  // «стеклянный» двигатель в режиме работы: стенки почти прозрачные, внутренности видно
  const GLASS = { block: 0.1, liner: 0.13, jacket: 0.05, head: 0.16, cover: 0.12, oilpan: 0.15, oil: 0.25, manifold_in: 0.35, manifold_ex: 0.4, airfilter: 0.45, headbolt: 0.5, maincap: 0.4, headgasket: 0.35, flyhousing: 0.08 }
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
      if (!state.only && state.xray?.includes(p.id) && !state.selected) op = Math.min(op, 0.28)
      // рубашки охлаждения заметнее, когда бежит поток воды
      if (p.id === 'jacket' && state.flows?.includes('water')) op = Math.max(op, 0.4)
      // схема затяжки: то, что закрывает болты, почти прозрачное
      if (tight.kind && TIGHT_SEE[tight.kind].includes(p.id)) op = Math.min(op, 0.12)
      if (!state.only && state.hidden.has(p.id)) op = 0
      const tr = op < 0.99
      if (m.transparent !== tr) m.needsUpdate = true
      m.transparent = tr
      m.opacity = op
      m.depthWrite = op > 0.6
      m.emissive.set(emis)
      m.emissiveIntensity = emisI
      const solo = soloOn()
      for (const mesh of meshesByPart[p.id] || []) mesh.visible = op > 0.015 && (!solo || mesh.userData.cyl == null || solo.has(mesh.userData.cyl))
    }
    blueMat.opacity = mats.gearmark.opacity
    blueMat.transparent = mats.gearmark.transparent
    flashScale = state.op || (state.only && !state.only.has('piston')) || (!state.only && state.hidden.has('piston')) ? 0 : state.selected || state.layer !== 'all' ? 0.35 : 1
    const solo = soloOn()
    for (const cy of cyls) {
      // выбранный цилиндр — инверсный (сплошной молочный) значок
      cy.sprite.material.map = state.cylinder === cy.c || (solo?.size === 1 && solo.has(cy.c)) ? cy.sprite.userData.tex.on : cy.sprite.userData.tex.off
      cy.sprite.visible = numbersOn && !tight.kind && (!state.only || state.only.has('liner')) && (!solo || solo.has(cy.c))
    }
    work.setSolo(solo)
    // один цилиндр: общие потоки через весь двигатель не показываем, только частицы этого цилиндра
    if (state.op) flows.show(soloOn() ? null : [work.fx.air && 'op_air', work.fx.exhaust && 'op_exh', work.fx.fuel && 'op_fuel'].filter(Boolean))
    else if (state.layer === 'all' && state.flows) flows.show(!state.only && explodeF < 0.05 ? state.flows : null)
    else flows.show(state.layer !== 'all' && !state.only && explodeF < 0.05 ? state.layer : null)
    dirty = true
  }

  // ================================================================
  // схема затяжки: номера над болтами в порядке затяжки, кольцо на болте, который тянут сейчас.
  // Болты: головка цилиндра (4 болта: 0 перед/−z, 1 зад/−z, 2 зад/+z, 3 перед/+z в координатах ряда);
  // крышки коренных подшипников: индекс = крышка·4 + j, j: 0/1 вертикальные (−z/+z), 2/3 горизонтальные (−z/+z)
  const tight = { kind: null, sprites: [], ring: null }
  const tightTex = new Map()
  const ringGeo = new THREE.TorusGeometry(0.15, 0.025, 8, 28)
  geos.add(ringGeo)
  const ringMat = new THREE.MeshBasicMaterial({ color: MILK, depthTest: false, transparent: true, toneMapped: false })
  function boltAnchor(kind, cyl, i) {
    if (kind === 'headbolt') {
      const cy = cyls.find((q) => q.c === cyl)
      if (!cy) return null
      const [sx, sz] = [[-1, -1], [1, -1], [1, 1], [-1, 1]][i]
      return { parent: cy.hb, at: V3(sx * 0.52, 0.06, sz * 0.52), badge: V3(sx * 0.52, 0.5, sz * 0.52), axis: 'y' }
    }
    const cap = mainCaps[Math.floor(i / 4)], j = i % 4, sz = j % 2 ? 1 : -1
    if (!cap) return null
    if (j < 2) return { parent: cap, at: V3(0, -0.8, sz * 0.52), badge: V3(0, -1.25, sz * 0.52), axis: 'y' }
    return { parent: cap, at: V3(0, -0.32, sz * 1.72), badge: V3(0, -0.32, sz * 2.15), axis: 'z' }
  }
  function badgeTexOf(n) {
    if (!tightTex.has(n)) {
      const t = { off: numberTexture(n, false, true), on: numberTexture(n, true, true) }
      badgeTex.push(t.off, t.on)
      tightTex.set(n, t)
    }
    return tightTex.get(n)
  }
  function clearTighten() {
    for (const sp of tight.sprites) {
      sp.removeFromParent()
      sp.material.dispose()
    }
    tight.sprites = []
    tight.ring?.removeFromParent()
    tight.ring = null
  }
  // kind: 'headbolt' | 'maincap' | null; order — индексы болтов в порядке затяжки; at — какой тянут сейчас (−1 — ни один)
  function setTighten(kind, { cyl = 1, order = [], at = -1, fly = false } = {}) {
    clearTighten()
    const changed = tight.kind !== kind || tight.cyl !== cyl
    tight.kind = kind
    tight.cyl = cyl
    if (kind) {
      order.forEach((bi, k) => {
        const a = boltAnchor(kind, cyl, bi)
        if (!a) return
        const tex = badgeTexOf(k + 1)
        const cur = k === at
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cur ? tex.on : tex.off, depthTest: false, transparent: true, toneMapped: false, opacity: at >= 0 && k < at ? 0.35 : 1 }))
        sp.scale.setScalar(cur ? 0.58 : 0.42)
        sp.position.copy(a.badge)
        sp.renderOrder = cur ? 13 : 12
        sp.userData.noPick = true
        a.parent.add(sp)
        tight.sprites.push(sp)
        if (cur) {
          const r = new THREE.Mesh(ringGeo, ringMat)
          if (a.axis === 'y') r.rotation.x = Math.PI / 2
          r.position.copy(a.at)
          r.renderOrder = 13
          r.userData.noPick = true
          a.parent.add(r)
          tight.ring = r
        }
      })
      if (fly && changed) {
        if (kind === 'headbolt') flyToCyl(cyl, 6.5, 3.9)
        else {
          const t = V3(0, -0.8, 0)
          flyTo(V3(-5, -6.5, 10).multiplyScalar(fitScale()).add(t), t)
        }
      }
    }
    applyLook()
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
    const d = 7.6 / Math.sin(Math.min(vf, hf) / 2)
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
    gears: [new THREE.Vector3(19, 2.6, -3.5), new THREE.Vector3(6.0, 1.0, 0)],
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
    // разнести отдельные детали: map { id: 0…1 } (0 — на месте); null — сбросить. tubes — перестроить трубки (в конце анимации)
    setPartExplode(map, { tubes = true } = {}) {
      for (const k of Object.keys(partExp)) if (!map || !(k in map)) delete partExp[k]
      if (map) Object.assign(partExp, map)
      for (const o of placed) o.position.copy(o.userData.base).addScaledVector(o.userData.exp, expOf(o))
      update()
      if (tubes) rebuildTubes()
      dirty = true
    },
    setExplode(f) {
      explodeF = f
      for (const o of placed) o.position.copy(o.userData.base).addScaledVector(o.userData.exp, expOf(o))
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
    // только детали цилиндра c или списка цилиндров (общие детали — вал, распредвал — остаются); null — все
    setSolo(c) {
      const list = [].concat(c ?? []).filter(Boolean)
      state.solo = list.length ? new Set(list) : null
      applyLook()
      update()
    },
    focusCylinder: (c, dist) => flyToCyl(c, dist),
    // схема затяжки на модели (см. setTighten выше); kind null — убрать
    setTighten,
    // потоки систем без подсветки слоя (для наборов «Что показывать»): ['air', 'exhaust'] | null
    setFlows(ids) {
      state.flows = ids
      applyLook()
    },
    // полупрозрачные детали (видно каналы внутри): ['crank', …] | null
    setXray(ids) {
      state.xray = ids
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
      clearTighten()
      ringMat.dispose()
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
