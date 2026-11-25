// Общие детали для сцен группы «крепёж и слесарные работы»:
// резьба по винтовой линии, шестигранники, сверло, деталь с отверстием в разрезе, стружка.
import { THREE, PALETTE } from '../stage.js'

const TAU = Math.PI * 2
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerpRange = (a, b, t) => a + (b - a) * t
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// Тело вращения вокруг Y с радиусом r = rFn(theta, y). Сетка замкнута по углу, торцы стянуты к оси.
// theta: x = r·sinθ, z = r·cosθ (как у CylinderGeometry), θ растёт против часовой, если смотреть сверху.
export function radialGeo(rFn, y0, y1, { rows = 64, cols = 32, capStart = true, capEnd = true } = {}) {
  const ys = []
  for (let i = 0; i <= rows; i++) ys.push(y0 + ((y1 - y0) * i) / rows)
  const rings = []
  if (capStart) rings.push({ y: y0, axis: true })
  for (const y of ys) rings.push({ y })
  if (capEnd) rings.push({ y: y1, axis: true })
  const pos = new Float32Array(rings.length * cols * 3)
  let p = 0
  for (const ring of rings)
    for (let j = 0; j < cols; j++) {
      const th = (j / cols) * TAU
      const r = ring.axis ? 0 : rFn(th, ring.y)
      pos[p++] = r * Math.sin(th)
      pos[p++] = ring.y
      pos[p++] = r * Math.cos(th)
    }
  const idx = []
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * cols + j, b = i * cols + ((j + 1) % cols)
      const c = a + cols, d = b + cols
      idx.push(a, b, c, b, d, c)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Профиль метрической резьбы: правая, шаг P, впадины rMin, вершины rMaj.
// fadeStart/fadeEnd — длина сбега (на конце болта резьба плавно «уходит» в фаску).
export function threadFn({ rMin, rMaj, P, y0 = 0, y1 = 1, fadeStart = 0, fadeEnd = 0, flat = 0.14 }) {
  const depth = rMaj - rMin
  return (th, y) => {
    const u = (((y / P - th / TAU) % 1) + 1) % 1
    let t = 1 - Math.abs(2 * u - 1)
    t = clamp((t - flat) / (1 - 2 * flat), 0, 1)
    let f = 1
    if (fadeStart) f = Math.min(f, (y - y0) / fadeStart)
    if (fadeEnd) f = Math.min(f, (y1 - y) / fadeEnd)
    return rMin + depth * t * clamp(f, 0, 1)
  }
}
// резьбовой стержень от y0 до y1
export function threadGeo(o, { cols = 36, perPitch = 8, caps = true } = {}) {
  const rows = Math.max(8, Math.round(((o.y1 - o.y0) / o.P) * perPitch))
  return radialGeo(threadFn(o), o.y0, o.y1, { rows, cols, capStart: caps, capEnd: caps })
}

// Спиральное сверло: две винтовые канавки и вершина ~118°. Ось Y, вершина внизу (y = 0).
export function drillGeo({ r = 0.3, len = 3, lead = 1.4, flute = 0.42 } = {}) {
  const tip = r * Math.tan((31 * Math.PI) / 180)
  const fn = (th, y) => {
    const ph = ((((th - (TAU * y) / lead) / Math.PI) % 1) + 1) % 1 // 0..1, две канавки
    const k = smooth(0, 0.08, ph) * (1 - smooth(flute - 0.08, flute, ph))
    let rr = r * (1 - 0.48 * k)
    if (y < tip) rr = Math.min(rr, (y / tip) * r)
    return rr
  }
  return radialGeo(fn, 0, len, { rows: Math.round(len * 22), cols: 40, capStart: false })
}

// шестигранник «под ключ» S (грани смотрят на ±Z), высота h, ось Y, центр в 0; holeR — отверстие
export function hexGeo(S, h, holeR = 0, chamfer = 0.04) {
  const R = S / Math.sqrt(3) - chamfer * 1.15
  const shape = new THREE.Shape()
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3
    k ? shape.lineTo(R * Math.cos(a), R * Math.sin(a)) : shape.moveTo(R * Math.cos(a), R * Math.sin(a))
  }
  shape.closePath()
  if (holeR) {
    const hole = new THREE.Path()
    hole.absarc(0, 0, holeR + chamfer, 0, TAU, true)
    shape.holes.push(hole)
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - 2 * chamfer), bevelEnabled: true, bevelThickness: chamfer, bevelSize: chamfer, bevelSegments: 1, curveSegments: 28 })
  g.translate(0, 0, -(h - 2 * chamfer) / 2)
  g.rotateX(-Math.PI / 2)
  return g
}

// холст → текстура (освобождать в dispose сцены)
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// Простые частицы (стружка, капли): InstancedMesh, гравитация, время жизни.
export function particles(stage, geo, material, max = 40, { gravity = -6 } = {}) {
  const im = new THREE.InstancedMesh(geo, material, max)
  im.frustumCulled = false
  const list = []
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let i = 0; i < max; i++) im.setMatrixAt(i, zero)
  let next = 0
  const api = {
    mesh: im,
    spawn(p, v, { life = 1.2, size = 1, spin = 6, stick = false } = {}) {
      list[next] = { p: p.clone(), v: v.clone(), age: 0, life, size, rot: new THREE.Vector3(Math.random() * 6, Math.random() * 6, 0), spin, stick }
      next = (next + 1) % max
    },
    clear() {
      list.length = 0
      for (let i = 0; i < max; i++) im.setMatrixAt(i, zero)
      im.instanceMatrix.needsUpdate = true
    },
    update(dt, floorY = -1e9) {
      for (let i = 0; i < max; i++) {
        const a = list[i]
        if (!a) continue
        a.age += dt
        if (a.age > a.life) {
          list[i] = null
          im.setMatrixAt(i, zero)
          continue
        }
        if (!a.stick) {
          a.v.y += gravity * dt
          a.p.addScaledVector(a.v, dt)
          a.rot.x += a.spin * dt
          a.rot.y += a.spin * 0.7 * dt
          if (a.p.y < floorY) {
            a.p.y = floorY
            a.v.set(0, 0, 0)
            a.spin = 0
          }
        }
        const k = a.size * Math.min(1, (a.life - a.age) / 0.25)
        m4.compose(a.p, q.setFromEuler(e.set(a.rot.x, a.rot.y, a.rot.z)), s.set(k, k, k))
        im.setMatrixAt(i, m4)
      }
      im.instanceMatrix.needsUpdate = true
    },
  }
  return api
}

// Деталь-брусок с отверстием в разрезе (передняя половина срезана плоскостью z = 0).
// Отверстие описано состоянием: depth — глубина по вершине сверла, chamfer 0..1 — зенковка,
// tap — глубина нарезанной резьбы. Возвращает { group, set(state), thread, dispose }.
export function holeBlock(stage, { W = 3, Dz = 2, H = 2, top = 0, rH = 0.3, rC = 0.45, thread = null, kind = 'steel', color } = {}) {
  const bot = top - H
  const tipH = rH * Math.tan((31 * Math.PI) / 180)
  const rMaj = thread ? thread.rMaj : rH
  const Rb = Math.max(rC, rMaj) + 0.18
  const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
  const threadClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const over = { clippingPlanes: [cut], side: THREE.DoubleSide, ...(color ? { color } : {}) }
  const mBody = stage.mat(kind, over)
  const group = new THREE.Group()

  // корпус: брусок с большим отверстием Rb, его заполняет «вставка»-тело вращения с профилем отверстия
  const sh = new THREE.Shape()
  sh.moveTo(-W / 2, -Dz / 2)
  sh.lineTo(W / 2, -Dz / 2)
  sh.lineTo(W / 2, Dz / 2)
  sh.lineTo(-W / 2, Dz / 2)
  sh.closePath()
  const hp = new THREE.Path()
  hp.absarc(0, 0, Rb, 0, TAU, true)
  sh.holes.push(hp)
  const bodyGeo = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false, curveSegments: 40 })
  bodyGeo.rotateX(-Math.PI / 2)
  bodyGeo.translate(0, bot, 0)
  group.add(new THREE.Mesh(bodyGeo, mBody))

  const insert = new THREE.Mesh(new THREE.BufferGeometry(), mBody)
  group.add(insert)
  const capMat = stage.mat('mark', { color: PALETTE.section, side: THREE.DoubleSide, roughness: 0.75, metalness: 0.1 })
  const cap = new THREE.Mesh(new THREE.BufferGeometry(), capMat)
  group.add(cap)

  let threadMesh = null, thFn = null
  if (thread) {
    thFn = threadFn({ rMin: rH, rMaj: thread.rMaj, P: thread.P, y0: bot, y1: top })
    // внутренняя резьба: материал снаружи поверхности, смотрим изнутри
    const g = radialGeo(thFn, top - thread.len, top, { rows: Math.round((thread.len / thread.P) * 8), cols: 40, capStart: false, capEnd: false })
    threadMesh = new THREE.Mesh(g, stage.mat(kind, { ...over, clippingPlanes: [cut, threadClip] }))
    threadMesh.visible = false
    group.add(threadMesh)
  }

  let last = ''
  function set({ depth = 0, chamfer = 0, tap = 0 } = {}) {
    const key = `${depth.toFixed(3)}|${chamfer.toFixed(3)}|${tap.toFixed(3)}`
    if (key === last) return
    last = key
    // путь стенки отверстия сверху вниз: [r, y]
    const path = []
    let endR = 0
    const sec = [] // то же для сечения (с зубцами резьбы); x > 0
    if (depth <= 0.001) {
      path.push([0, top])
      sec.push([0, top])
    } else {
      const cw = chamfer * (rC - rH) // зенковка 90°: ширина = глубина
      const tapOn = thread && tap > 0.001
      const wallR = tapOn ? rMaj : rH
      const edge = rH + cw
      path.push([Math.max(edge, rH), top])
      sec.push([Math.max(edge, rH), top])
      let y = top
      if (edge > wallR) {
        y = top - (edge - wallR)
        path.push([wallR, y])
        sec.push([tapOn ? thFn(Math.PI / 2, y) : wallR, y])
      }
      const yTipStart = top - depth + tipH
      if (tapOn) {
        const yT = Math.max(top - tap, yTipStart)
        path.push([rMaj, yT], [rH, yT])
        for (let yy = y; yy > yT; yy -= thread.P / 8) sec.push([thFn(Math.PI / 2, yy), yy])
        sec.push([rH, yT])
        y = yT
      }
      // стенка до начала конуса вершины
      const yWall = Math.max(yTipStart, bot)
      path.push([rH, yWall])
      sec.push([rH, yWall])
      const yTip = top - depth
      if (yTip >= bot) {
        path.push([0, yTip])
        sec.push([0, yTip])
      } else {
        endR = yWall <= bot ? rH : clamp((rH * (bot - yTip)) / tipH, 0, rH)
        path.push([endR, bot])
        sec.push([endR, bot])
      }
    }
    // тело вращения (вставка)
    const prof = [[endR, bot], [Rb, bot], [Rb, top], ...path]
    if (endR > 0) prof.push([endR, bot])
    insert.geometry.dispose()
    // плоские нормали: иначе лате сглаживает стык торца и стенки, и верх детали выглядит «чашей»
    const lg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48)
    insert.geometry = lg.toNonIndexed()
    lg.dispose()
    insert.geometry.computeVertexNormals()
    // сечение в плоскости z = 0
    const shapes = []
    if (endR > 0) {
      for (const sgn of [1, -1]) {
        const s = new THREE.Shape()
        s.moveTo(sgn * endR, bot)
        s.lineTo(sgn * (W / 2), bot)
        s.lineTo(sgn * (W / 2), top)
        for (const [r, y] of sec) s.lineTo(sgn * r, y)
        shapes.push(s)
      }
    } else {
      const s = new THREE.Shape()
      s.moveTo(-W / 2, bot)
      s.lineTo(W / 2, bot)
      s.lineTo(W / 2, top)
      for (const [r, y] of sec) s.lineTo(r, y)
      for (let i = sec.length - 1; i >= 0; i--) {
        const [r, y] = sec[i]
        // зеркальная сторона: зубцы резьбы на x < 0 берём при θ = -π/2
        const rr = thread && tap > 0.001 && y > top - tap - 1e-6 && r > rH + 1e-6 && i > 0 && i < sec.length - 1 ? thFn(-Math.PI / 2, y) : r
        s.lineTo(-rr, y)
      }
      s.lineTo(-W / 2, top)
      shapes.push(s)
    }
    cap.geometry.dispose()
    cap.geometry = new THREE.ShapeGeometry(shapes)
    if (threadMesh) {
      threadMesh.visible = tap > 0.001
      threadClip.constant = -(top - tap)
    }
  }
  set({})
  return { group, set, bot, top, insert, cap, threadMesh, cut }
}

// дуга-стрелка вращения вокруг оси Y: углы как у rotation.y (плюс — против часовой, если смотреть сверху)
export function arcArrow(r, a0, a1, color = PALETTE.milk, { tube = 0.025 } = {}) {
  const m = new THREE.MeshBasicMaterial({ color, toneMapped: false })
  const pt = (a) => new THREE.Vector3(r * Math.cos(a), 0, -r * Math.sin(a))
  const n = 24
  const pts = []
  const head = (tube * 7) / r
  const a1b = a1 - Math.sign(a1 - a0) * head
  for (let i = 0; i <= n; i++) pts.push(pt(a0 + ((a1b - a0) * i) / n))
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, tube, 6), m))
  const cone = new THREE.Mesh(new THREE.ConeGeometry(tube * 3, tube * 8, 12), m)
  const s = Math.sign(a1 - a0)
  const tan = new THREE.Vector3(-Math.sin(a1b) * s, 0, -Math.cos(a1b) * s)
  cone.position.copy(pt(a1b)).addScaledVector(tan, tube * 4)
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan)
  g.add(cone)
  return g
}
