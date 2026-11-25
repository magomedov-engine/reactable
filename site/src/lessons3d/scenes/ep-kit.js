// Общие помощники для сцен группы «Детали двигателя» (_group_engine_parts.js).
// Не сцена: в реестр не попадает (реестр читает только _group_*.js).
import { THREE } from '../stage.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// склейка однотипных геометрий в одну (меньше вызовов отрисовки)
export function merge(list) {
  const prepared = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k)
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2))
    n.clearGroups()
    return n
  })
  const out = mergeGeometries(prepared)
  new Set([...list, ...prepared]).forEach((g) => g.dispose())
  return out
}

// цилиндр между двумя точками
const UP = new THREE.Vector3(0, 1, 0)
export function cylBetween(a, b, r, seg = 10) {
  const d = new THREE.Vector3().subVectors(b, a)
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()))
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  return g
}

// половина тела вращения вокруг Y (задняя, z <= 0) — для разрезов
export const halfLathe = (pts, seg = 40) =>
  new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, Math.PI / 2, Math.PI)

// «срез» профиля тела вращения в плоскости z = 0 (две симметричные заливки)
export function lathe2Section(pts, z = 0.002) {
  const shape = (s) => new THREE.Shape(pts.map(([r, y]) => new THREE.Vector2(s * r, y)))
  const g = merge([new THREE.ShapeGeometry(shape(1)), new THREE.ShapeGeometry(shape(-1))])
  g.translate(0, 0, z)
  return g
}

// задняя половина плиты (x от -w до w, z от -d до 0) с полукруглым вырезом радиуса r по оси Y,
// толщина от y0 до y1. r = 0 — без выреза.
export function halfPlate(w, d, r, y0, y1) {
  const s = new THREE.Shape()
  s.moveTo(-w, 0)
  if (r > 0) {
    s.lineTo(-r, 0)
    s.absarc(0, 0, r, Math.PI, 0, true)
  }
  s.lineTo(w, 0)
  s.lineTo(w, d)
  s.lineTo(-w, d)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 40 })
  g.rotateX(-Math.PI / 2)
  g.translate(0, y0, 0)
  return g
}
// срез такой плиты (в плоскости z = 0)
export function halfPlateSection(w, r, y0, y1, z = 0.002) {
  const list = []
  const h = y1 - y0
  if (r > 0) {
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(w - r, h)
      g.translate(s * (r + (w - r) / 2), y0 + h / 2, z)
      list.push(g)
    }
  } else {
    const g = new THREE.PlaneGeometry(2 * w, h)
    g.translate(0, y0 + h / 2, z)
    list.push(g)
  }
  return merge(list)
}

// кольцевой сектор (вокруг оси Z) толщиной depth по Z, углы a0..a1 (рад, против часовой)
export function annulusZ(rIn, rOut, a0, a1, depth, seg = 48) {
  const s = new THREE.Shape()
  s.absarc(0, 0, rOut, a0, a1, false)
  s.absarc(0, 0, rIn, a1, a0, true)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: seg })
  g.translate(0, 0, -depth / 2)
  return g
}
// кольцевой сектор вокруг оси Y (поршневое кольцо с замком): высота h по Y, по центру y = 0
// угол отсчитывается от +X к -Z (как поворот rotation.y)
export function annulusY(rIn, rOut, a0, a1, h, seg = 64) {
  const g = annulusZ(rIn, rOut, a0, a1, h, seg)
  g.rotateX(-Math.PI / 2)
  return g
}

// вписать текст в текстуру холста
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// поток частиц: InstancedMesh из маленьких сфер; pos(i, k, v) — куда поставить i-ю частицу
export function particles(stage, n, r, color, opacity = 1) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false })
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), m, n)
  mesh.frustumCulled = false
  const dummy = new THREE.Object3D()
  mesh.place = (fn) => {
    for (let i = 0; i < n; i++) {
      const s = fn(i, dummy.position) // вернуть масштаб (0 — скрыть)
      dummy.scale.setScalar(s === undefined ? 1 : s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }
  return mesh
}

// простой «сценарист» внутри шага: список [время, функция]; идёт только когда stage.playing
export function sequencer(stage) {
  let list = []
  let t = 0
  let loop = 0
  let i = 0
  stage.onFrame((dt) => {
    if (!list.length) return
    if (stage.playing) t += dt
    while (i < list.length && t >= list[i][0]) list[i++][1]()
    if (loop && t >= loop) {
      t = 0
      i = 0
    }
  })
  return {
    // events: [[sec, fn], ...]; loopAt — повторять с этого времени (0 — без повтора)
    run(events, loopAt = 0) {
      list = events.slice().sort((a, b) => a[0] - b[0])
      t = 0
      i = 0
      loop = loopAt
    },
    stop() {
      list = []
    },
  }
}

// вписать Box3 в кадр по ширине И высоте (stage.fit берёт диагональ — для длинных деталей мелко)
export function fitBox(stage, box, dir, { pad = 1.1, ms = 900 } = {}) {
  const { camera, controls } = stage
  const c = box.getCenter(new THREE.Vector3())
  const d = new THREE.Vector3(...dir).normalize()
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize()
  const up = new THREE.Vector3().crossVectors(d, right)
  let hw = 0, hh = 0, zf = 0
  const p = new THREE.Vector3()
  for (let i = 0; i < 8; i++) {
    p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(c)
    hw = Math.max(hw, Math.abs(p.dot(right)))
    hh = Math.max(hh, Math.abs(p.dot(up)))
    zf = Math.max(zf, p.dot(d))
  }
  const vf = (camera.fov * Math.PI) / 180
  const hf = 2 * Math.atan(Math.tan(vf / 2) * (camera.aspect || 1))
  const dist = Math.max(hw / Math.tan(hf / 2), hh / Math.tan(vf / 2)) * pad + zf
  const pos = c.clone().addScaledVector(d, dist)
  if (ms) stage.flyTo(pos, c, ms)
  else {
    camera.position.copy(pos)
    controls.target.copy(c)
  }
}
