// Общие помощники для сцен группы «Системы двигателя» (форсунка, термостат, турбина, зазор клапанов, масляный насос).
import { THREE, PALETTE } from '../stage.js'

export const v3 = (p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p))

// ломаная из точек [[x,y,z], ...] — равномерная параметризация по длине
export function polyPath(pts) {
  const path = new THREE.CurvePath()
  for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(v3(pts[i]), v3(pts[i + 1])))
  return path
}
// плавная кривая через точки
export const smoothPath = (pts) => new THREE.CatmullRomCurve3(pts.map(v3), false, 'centripetal')

// круглая «капля» для частиц (canvas-текстура; освобождается при dispose стенда вместе с материалом)
function dotTexture(stage) {
  if (stage._esDot) return stage._esDot
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.55, 'rgba(255,255,255,0.9)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 32, 32)
  stage._esDot = new THREE.CanvasTexture(c)
  return stage._esDot
}

// поток частиц вдоль кривой.
//   f.amount — доля видимых частиц (0..1), f.speed — ед./с, f.opacity, f.colorAt(t, color) — цвет по положению
export function flow(stage, path, { n = 30, color = PALETTE.milk, size = 0.09, speed = 1, jitter = 0, front = false, colorAt = null, parent = stage.root } = {}) {
  const len = path.getLength()
  const pos = new Float32Array(n * 3)
  const col = colorAt ? new Float32Array(n * 3) : null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const mat = new THREE.PointsMaterial({
    color: colorAt ? '#ffffff' : color, size, map: dotTexture(stage), transparent: true, depthWrite: false,
    toneMapped: false, vertexColors: !!colorAt, alphaTest: 0.02,
  })
  if (front) mat.depthTest = false
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  if (front) points.renderOrder = 20
  parent.add(points)
  // смещения по «золотому сечению»: любая первая часть частиц равномерно растянута по пути
  const offs = Array.from({ length: n }, (_, i) => (i * 0.618034) % 1)
  const jit = Array.from({ length: n }, () => new THREE.Vector3((Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter))
  const p = new THREE.Vector3()
  const c = new THREE.Color()
  const f = {
    points, mat, amount: 1, speed, opacity: 1, u: 0, len,
    step(dt) {
      if (stage.playing) f.u += (dt * f.speed) / len
      const k = Math.round(n * Math.max(0, Math.min(1, f.amount)))
      points.visible = k > 0 && f.opacity > 0.01
      if (!points.visible) return
      for (let i = 0; i < k; i++) {
        const t = (((offs[i] + f.u) % 1) + 1) % 1
        path.getPointAt(t, p)
        p.add(jit[i])
        pos[i * 3] = p.x
        pos[i * 3 + 1] = p.y
        pos[i * 3 + 2] = p.z
        if (col) {
          colorAt(t, c)
          col[i * 3] = c.r
          col[i * 3 + 1] = c.g
          col[i * 3 + 2] = c.b
        }
      }
      geo.setDrawRange(0, k)
      geo.attributes.position.needsUpdate = true
      if (col) geo.attributes.color.needsUpdate = true
      mat.opacity = f.opacity
    },
  }
  stage.onFrame((dt) => f.step(dt))
  return f
}

// материал среза (как на чертеже)
export const sectionMat = (stage) => (stage._esSec ||= stage.mat('mark', { color: PALETTE.section, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.1 }))

// тело вращения вокруг Y «в разрезе»: оставлена задняя половина (z<0), срезы закрашены.
// profile — замкнутый контур [[r, y], ...] (r ≥ 0)
export function cutLathe(stage, profile, kind = 'iron', { seg = 40, over = null, caps = true } = {}) {
  const g = new THREE.Group()
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg, Math.PI / 2, Math.PI)
  const m = stage.mesh(geo, typeof kind === 'string' ? stage.mat(kind, { side: THREE.DoubleSide, ...(over || {}) }) : kind)
  g.add(m)
  g.userData.body = m
  if (caps) {
    // срез — матовый, чуть светлее и теплее материала детали, чтобы детали различались
    const base = m.material.color.clone()
    const capMat = stage.mat('milk', {
      color: base.lerp(new THREE.Color(PALETTE.section), 0.28).multiplyScalar(1.12),
      metalness: 0.05, roughness: 0.85, side: THREE.DoubleSide,
    })
    const shape = new THREE.Shape(profile.map(([r, y]) => new THREE.Vector2(r, y)))
    const sg = new THREE.ShapeGeometry(shape)
    const a = new THREE.Mesh(sg, capMat)
    const b = new THREE.Mesh(sg.clone(), capMat)
    b.scale.x = -1
    a.position.z = b.position.z = 0.001
    g.add(a, b)
    g.userData.cap = capMat
  }
  return g
}

// пружина (винтовая) вдоль -Y от 0 до -len; масштаб по Y = сжатие
export function springGeo(r, wire, len, turns = 8) {
  const pts = []
  const N = turns * 16
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * turns * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * r, -(i / N) * len, Math.sin(a) * r))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, wire, 6, false)
}

// вертикальный «индикатор» (давление, температура): стеклянная трубка + заливка
export function gauge(stage, { h = 1.6, r = 0.07, color = PALETTE.oil } = {}) {
  const g = new THREE.Group()
  const glass = stage.mesh(new THREE.CylinderGeometry(r * 1.6, r * 1.6, h, 16, 1, true), 'glass')
  glass.position.y = h / 2
  const base = stage.mesh(new THREE.CylinderGeometry(r * 2.2, r * 2.2, 0.06, 16), 'steelDark')
  const fillMat = stage.mat('oil', { color, emissive: color, emissiveIntensity: 0.25 })
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 16).translate(0, 0.5, 0), fillMat)
  g.add(glass, base, fill)
  const st = { v: 0 }
  g.userData = { fill, fillMat, st, h }
  g.set = (v) => {
    st.v = v
    fill.scale.y = Math.max(0.001, v * h)
  }
  g.set(0)
  return g
}

// часы шага: время с начала шага (для разовых сценариев шага; идут и на паузе, как переходы animator)
export function stepClock(stage) {
  const c = { t: 0, reset(v = 0) { c.t = v } }
  stage.onFrame((dt) => {
    c.t += dt
  })
  return c
}
