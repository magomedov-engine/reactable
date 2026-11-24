// Дополнительные режимы 3D-модели: разрез и потоки по системам.
import * as THREE from 'three'

// ---------- разрез
// Глобальная плоскость отсечения + подкраска внутренних стенок (обратных граней),
// чтобы срез читался как на чертеже: внутри детали — «штриховка» цветом.
export const SECTION_COLOR = new THREE.Color('#a85a44')

export function createSection(renderer, materials) {
  const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)
  const uSect = { value: 0 }
  const sides = new Map()
  for (const m of materials) {
    sides.set(m, m.side)
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSect = uSect
      sh.uniforms.uSectColor = { value: SECTION_COLOR }
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform float uSect;\nuniform vec3 uSectColor;\nvoid main() {')
        .replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\n if (uSect > 0.5 && !gl_FrontFacing) gl_FragColor.rgb = mix(gl_FragColor.rgb, uSectColor, 0.62);',
        )
    }
    m.customProgramCacheKey = () => 'sect'
    m.needsUpdate = true
  }
  let on = false
  return {
    plane,
    get on() {
      return on
    },
    // normal — сторона, которая остаётся; d — смещение плоскости вдоль нормали
    set(normal, d) {
      if (!normal) {
        if (!on) return
        on = false
        uSect.value = 0
        renderer.clippingPlanes = []
        for (const [m, side] of sides) {
          m.side = side
          m.needsUpdate = true
        }
        return
      }
      plane.normal.copy(normal).normalize()
      plane.constant = -d
      if (!on) {
        on = true
        uSect.value = 1
        renderer.clippingPlanes = [plane]
        for (const m of sides.keys()) {
          m.side = THREE.DoubleSide
          m.needsUpdate = true
        }
      }
    },
  }
}

// ---------- потоки: частицы бегут по линиям (масло, вода, воздух, топливо, газы)
function dotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.55, 'rgba(255,255,255,1)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function createFlows(parent) {
  const tex = dotTexture()
  const systems = {}
  let active = []

  // paths: [{ pts: Vector3[], w?: вес (доля частиц), speed?: множитель }]
  function define(id, color, paths, { density = 8, size = 0.26, speed = 1.6 } = {}) {
    const curves = paths.map((p) => {
      const curve = p.pts.length > 2 ? new THREE.CatmullRomCurve3(p.pts, false, 'centripetal', 0.2) : new THREE.LineCurve3(p.pts[0], p.pts[1])
      const len = curve.getLength()
      return { curve, len, speed: p.speed ?? 1 }
    })
    const parts = []
    for (let ci = 0; ci < curves.length; ci++) {
      const n = Math.max(3, Math.round(curves[ci].len * density))
      for (let i = 0; i < n; i++) parts.push({ ci, u: i / n })
    }
    const pos = new Float32Array(parts.length * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      color,
      size,
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
      blending: THREE.NormalBlending,
    })
    const pts = new THREE.Points(geo, mat)
    pts.renderOrder = 20
    pts.visible = false
    pts.frustumCulled = false
    pts.userData.noPick = true
    parent.add(pts)
    // тонкие «трубки»-подсказки маршрута
    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, depthTest: false, toneMapped: false })
    const lines = new THREE.Group()
    lines.visible = false
    lines.renderOrder = 19
    for (const c of curves) {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.curve.getSpacedPoints(Math.max(8, Math.round(c.len * 6)))), lineMat)
      l.userData.noPick = true
      l.renderOrder = 19
      lines.add(l)
    }
    parent.add(lines)
    systems[id] = { curves, parts, pts, geo, mat, lines, lineMat, speed }
    place(systems[id], 0)
  }

  const tmp = new THREE.Vector3()
  function place(s, dt) {
    const a = s.geo.attributes.position.array
    for (let i = 0; i < s.parts.length; i++) {
      const p = s.parts[i]
      const c = s.curves[p.ci]
      p.u = (p.u + (dt * s.speed * c.speed) / c.len) % 1
      c.curve.getPointAt(p.u, tmp)
      a[i * 3] = tmp.x
      a[i * 3 + 1] = tmp.y
      a[i * 3 + 2] = tmp.z
    }
    s.geo.attributes.position.needsUpdate = true
  }

  return {
    define,
    // можно показать сразу несколько систем: show(['air', 'fuel'])
    show(ids) {
      active = [].concat(ids || []).filter((k) => systems[k])
      for (const [k, s] of Object.entries(systems)) {
        s.pts.visible = active.includes(k)
        s.lines.visible = active.includes(k)
      }
    },
    tick(dt) {
      if (!active.length) return false
      for (const k of active) place(systems[k], dt)
      return true
    },
    dispose() {
      tex.dispose()
      for (const s of Object.values(systems)) {
        s.geo.dispose()
        s.mat.dispose()
        s.lineMat.dispose()
        s.lines.children.forEach((l) => l.geometry.dispose())
      }
    },
  }
}
