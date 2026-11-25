// Общий «стенд» для 3D-сцен в уроках: рендер, свет, камера, материалы, подписи, стрелки.
//
// КОНТРАКТ СЦЕНЫ (файл scenes/<id>.js):
//   export default {
//     title: 'Название блока',
//     animated: true,              // есть ли непрерывная анимация (кнопка пауза/пуск)
//     steps: [{ title, text }],    // шаги с пояснениями (можно не указывать)
//     mount(host, opts) { ... return controller },
//   }
//   controller = stage.controller({ setStep(i) { ... } }) — см. ниже.
// Внутри mount сцена создаёт стенд: const stage = createStage(host, { position, target, fov })
// и наполняет stage.root. Анимация: stage.onFrame((dt, t) => { ... }) — вызывается каждый кадр,
// пока блок на экране; stage.playing — нажата ли «пауза» (для непрерывных движений).
// Оси: Y вверх. Единицы любые, камеру ставьте через position/target или stage.fit(obj).
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export { THREE }

// палитра в тон сайту (графит/молочный) и 3D-модели двигателя
export const PALETTE = {
  milk: '#ece6da',
  graphite: '#141517',
  iron: '#6e6c67', // чугун, корпуса
  ironDark: '#504e4a',
  steel: '#b3afa6', // светлая сталь
  steelDark: '#86857f',
  steelBlack: '#3f3f42', // воронёная сталь, кольца
  chrome: '#dcd7cd', // шлифованные поверхности
  brass: '#a8925f', // коленвал/латунь
  bronze: '#b98a5a', // вкладыши, антифрикционный слой
  rubber: '#2f2e2c',
  oil: '#c9a24a',
  water: '#6f8fa8',
  air: '#8aa37b',
  fuel: '#c47a45',
  exhaust: '#b0584a',
  mark: '#b0584a', // метки, риски
  section: '#a85a44', // цвет среза
  ok: '#a9b79c',
  bad: '#cf7e6f',
}

const DEF_MATS = {
  iron: { color: PALETTE.iron, metalness: 0.35, roughness: 0.6 },
  ironDark: { color: PALETTE.ironDark, metalness: 0.4, roughness: 0.55 },
  steel: { color: PALETTE.steel, metalness: 0.75, roughness: 0.32 },
  steelDark: { color: PALETTE.steelDark, metalness: 0.75, roughness: 0.38 },
  steelBlack: { color: PALETTE.steelBlack, metalness: 0.7, roughness: 0.4 },
  chrome: { color: PALETTE.chrome, metalness: 0.9, roughness: 0.18 },
  brass: { color: PALETTE.brass, metalness: 0.8, roughness: 0.3 },
  bronze: { color: PALETTE.bronze, metalness: 0.85, roughness: 0.28 },
  rubber: { color: PALETTE.rubber, metalness: 0, roughness: 0.85 },
  milk: { color: PALETTE.milk, metalness: 0.05, roughness: 0.7 },
  oil: { color: PALETTE.oil, metalness: 0.1, roughness: 0.3 },
  water: { color: PALETTE.water, metalness: 0.1, roughness: 0.3 },
  air: { color: PALETTE.air, metalness: 0.2, roughness: 0.4 },
  fuel: { color: PALETTE.fuel, metalness: 0.4, roughness: 0.4 },
  exhaust: { color: PALETTE.exhaust, metalness: 0.4, roughness: 0.5 },
  mark: { color: PALETTE.mark, metalness: 0.2, roughness: 0.5 },
  ok: { color: PALETTE.ok, metalness: 0.2, roughness: 0.5 },
  bad: { color: PALETTE.bad, metalness: 0.2, roughness: 0.5 },
  glass: { color: '#b9c3cc', metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide },
}

// ---------- геометрические помощники
export const cylX = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2)
export const cylY = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg)
export const cylZ = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2)
// тело вращения вокруг Y по профилю [[r, y], ...]
export const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)
// трубка (кольцо) вокруг Y
export const ringY = (rIn, rOut, h, seg = 48) =>
  lathe([[rIn, -h / 2], [rOut, -h / 2], [rOut, h / 2], [rIn, h / 2], [rIn, -h / 2]], seg)
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const clamp01 = (t) => Math.max(0, Math.min(1, t))
export const lerp = (a, b, t) => a + (b - a) * t

let ctxCount = 0
export const activeContexts = () => ctxCount

// ================================================================
export function createStage(host, opts = {}) {
  const { fov = 32, position = [6, 4, 8], target = [0, 0, 0], minDistance = 0.5, maxDistance = 200, exposure = 1.0 } = opts
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  ctxCount++
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = exposure
  renderer.localClippingEnabled = true
  host.appendChild(renderer.domElement)
  renderer.domElement.classList.add('l3d-canvas')

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  const key = new THREE.DirectionalLight('#fff4e4', 1.45)
  key.position.set(-5, 10, 7)
  const rim = new THREE.DirectionalLight('#dde2e8', 0.85)
  rim.position.set(6, 4, -8)
  scene.add(key, rim, new THREE.HemisphereLight('#ece6da', '#141517', 0.25), new THREE.AmbientLight('#ffffff', 0.12))

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 500)
  camera.position.set(...position)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(...target)
  controls.enableDamping = true
  controls.dampingFactor = 0.09
  controls.enableZoom = false // в тексте урока колесо мыши прокручивает страницу; зум — в полноэкранном режиме
  controls.enablePan = false
  controls.minDistance = minDistance
  controls.maxDistance = maxDistance
  controls.update()

  const root = new THREE.Group()
  scene.add(root)

  // ---------- материалы (кэш по имени; mat('steel', { color }) — новый экземпляр с правками)
  const owned = new Set()
  const matCache = {}
  function mat(kind = 'steel', over) {
    if (!over && matCache[kind]) return matCache[kind]
    const m = new THREE.MeshStandardMaterial({ ...(DEF_MATS[kind] || DEF_MATS.steel), ...(over || {}) })
    owned.add(m)
    if (!over) matCache[kind] = m
    return m
  }
  function mesh(geo, kind = 'steel', over) {
    const m = new THREE.Mesh(geo, typeof kind === 'string' ? mat(kind, over) : kind)
    return m
  }

  // ---------- подписи (HTML поверх холста)
  const overlay = document.createElement('div')
  overlay.className = 'l3d-labels'
  host.appendChild(overlay)
  const labels = []
  const tmpV = new THREE.Vector3()
  // anchor: Vector3 (мировые координаты) или Object3D (+ offset в его локальных координатах)
  function label(text, anchor, { offset = [0, 0, 0], tone = '', side = 'top' } = {}) {
    const el = document.createElement('div')
    el.className = `l3d-tag ${tone} ${side}`
    el.textContent = text
    overlay.appendChild(el)
    const l = {
      el,
      anchor,
      offset: new THREE.Vector3(...offset),
      visible: true,
      set(t) {
        el.textContent = t
        return l
      },
      show(v = true) {
        l.visible = v
        el.style.display = v ? '' : 'none'
        return l
      },
      tone(t) {
        el.className = `l3d-tag ${t} ${side}`
        return l
      },
    }
    labels.push(l)
    return l
  }
  function placeLabels() {
    const w = host.clientWidth, h = host.clientHeight
    for (const l of labels) {
      if (!l.visible) continue
      if (l.anchor.isObject3D) {
        if (!l.anchor.visible) {
          l.el.style.opacity = 0
          continue
        }
        tmpV.copy(l.offset)
        l.anchor.localToWorld(tmpV)
      } else tmpV.copy(l.anchor).add(l.offset)
      tmpV.project(camera)
      const off = tmpV.z > 1
      l.el.style.opacity = off ? 0 : 1
      l.el.style.transform = `translate(${((tmpV.x + 1) / 2) * w}px, ${((1 - tmpV.y) / 2) * h}px)`
    }
  }

  // ---------- стрелка (силы, направление движения, поток)
  function arrow(from, to, color = PALETTE.milk, { head = 0.25, width = 0.16 } = {}) {
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    const a = new THREE.ArrowHelper(dir.normalize(), from, len, color, Math.min(head, len * 0.4), width)
    for (const m of [a.line.material, a.cone.material]) {
      m.toneMapped = false
      owned.add(m)
    }
    a.set = (f, t) => {
      const d = new THREE.Vector3().subVectors(t, f)
      const L = Math.max(1e-4, d.length())
      a.position.copy(f)
      a.setDirection(d.normalize())
      a.setLength(L, Math.min(head, L * 0.4), width)
    }
    return a
  }

  // ---------- камера: плавный перелёт и «вписать объект»
  let tween = null
  function flyTo(pos, tgt, ms = 800) {
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...[].concat(pos.toArray ? pos.toArray() : pos)), t1: new THREE.Vector3(...[].concat(tgt.toArray ? tgt.toArray() : tgt)), start: performance.now(), ms }
  }
  const box = new THREE.Box3()
  function fitDistance(size) {
    const vf = (camera.fov * Math.PI) / 180
    const f = Math.min(vf, 2 * Math.atan(Math.tan(vf / 2) * camera.aspect))
    return (size * 0.5) / Math.tan(f / 2)
  }
  // вписать объект (или Box3) в кадр, сохранив направление взгляда (или dir)
  function fit(obj, { pad = 1.15, dir = null, ms = 800 } = {}) {
    if (obj.isBox3) box.copy(obj)
    else box.setFromObject(obj)
    const c = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3()).length()
    const d = dir ? new THREE.Vector3(...[].concat(dir.toArray ? dir.toArray() : dir)).normalize() : camera.position.clone().sub(controls.target).normalize()
    const p = c.clone().addScaledVector(d, fitDistance(size) * pad)
    if (ms) flyTo(p, c, ms)
    else {
      camera.position.copy(p)
      controls.target.copy(c)
    }
  }
  const home = { p: camera.position.clone(), t: controls.target.clone(), fitObj: null }

  // ---------- цикл
  const frames = []
  let active = false
  let raf = 0
  let last = performance.now()
  let time = 0
  const stage = {
    THREE, scene, camera, controls, renderer, root, mat, mesh, label, arrow, flyTo, fit, PALETTE,
    playing: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    onFrame(fn) {
      frames.push(fn)
    },
    // запомнить текущий кадр как «исходный вид» (кнопка «Сбросить вид»)
    setHome(fitObj) {
      home.p.copy(camera.position)
      home.t.copy(controls.target)
      home.fitObj = fitObj || null
    },
    get time() {
      return time
    },
  }
  function frame(now) {
    raf = requestAnimationFrame(frame)
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
    last = now
    if (stage.playing) time += dt
    for (const f of frames) f(dt, time)
    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.ms)
      const e = ease(k)
      camera.position.lerpVectors(tween.p0, tween.p1, e)
      controls.target.lerpVectors(tween.t0, tween.t1, e)
      if (k >= 1) tween = null
    }
    controls.update()
    renderer.render(scene, camera)
    placeLabels()
  }

  let fittedOnce = false
  function resize() {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    if (!fittedOnce && opts.fit) {
      fittedOnce = true
      fit(opts.fit === true ? root : opts.fit, { ms: 0, pad: opts.pad || 1.15 })
      stage.setHome()
    }
    if (!active) renderer.render(scene, camera)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(host)

  // стандартный контроллер для компонента блока; extra — setStep и т.п.
  stage.controller = (extra = {}) => ({
    setActive(v) {
      if (v === active) return
      active = v
      if (v) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      } else cancelAnimationFrame(raf)
    },
    setPlaying(v) {
      stage.playing = v
    },
    setZoom(v) {
      controls.enableZoom = v
      controls.enablePan = v
    },
    // на телефоне в тексте урока палец должен листать страницу, а не крутить модель
    setInteractive(v) {
      controls.enabled = v
      renderer.domElement.style.touchAction = v ? 'none' : 'pan-y'
    },
    resetView() {
      flyTo(home.p.clone(), home.t.clone(), 700)
    },
    setStep() {},
    ...extra,
    dispose() {
      extra.dispose?.()
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        const ms = o.material ? [].concat(o.material) : []
        ms.forEach((m) => {
          m.map?.dispose()
          m.dispose()
        })
      })
      owned.forEach((m) => m.dispose())
      envTex.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.forceContextLoss?.()
      renderer.domElement.remove()
      overlay.remove()
      ctxCount--
    },
  })
  // первый кадр после того, как сцена наполнена
  stage.ready = () => {
    resize()
    controls.update()
    renderer.render(scene, camera)
  }
  return stage
}

// плавные переходы для шагов:
//   const to = animator(stage)
//   to(mesh.position, 'y', 2, 0.6)        — свойство объекта к значению за 0.6 с
//   to(state, 'open', 1)                  — любое число в своём объекте состояния
export function animator(stage) {
  const list = []
  stage.onFrame((dt) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i]
      a.t = Math.min(1, a.t + dt / a.dur)
      a.obj[a.prop] = a.from + (a.to - a.from) * ease(a.t)
      if (a.t >= 1) list.splice(i, 1)
    }
  })
  return function to(obj, prop, target, dur = 0.6) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].obj === obj && list[i].prop === prop) list.splice(i, 1)
    if (dur <= 0) obj[prop] = target
    else list.push({ obj, prop, from: obj[prop], to: target, t: 0, dur })
  }
}
