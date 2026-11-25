// Микрометр МК 0–25 (0,01 мм): винт с шагом 0,5 мм, барабан на 50 делений.
// Шкалы стебля и барабана — canvas-текстуры на изогнутых полосках (читаются при увеличении).
// Масштаб: 1 ед. = 5 мм. Пятка — x = 0, торец микровинта — x = g/5 (g — показание, мм).
import { createStage, animator, THREE, PALETTE } from '../stage.js'

const STEPS = [
  { title: 'Устройство', text: 'Скоба с пяткой, микровинт, стебель со шкалой, барабан и трещотка. Скобу держат за накладки: тепло руки «растягивает» металл, и размер уходит.' },
  { title: 'Проверка нуля', text: 'Перед работой сомкните пятку и микровинт трещоткой. Ноль барабана должен стоять на продольной линии стебля. Если нет — инструмент настраивают, мерить им нельзя.' },
  { title: 'Замер трещоткой', text: 'Деталь между пяткой и микровинтом. Подводят только трещоткой: когда винт упёрся, она щёлкает и не даёт пережать. За барабан не закручивают.' },
  { title: 'Читаем стебель', text: 'Над линией — целые миллиметры: последняя видная черта 12. Под линией — половинки: после 12 видна ещё риска, значит + 0,5 мм. Пока 12,5.' },
  { title: 'Читаем барабан', text: 'На барабане 50 делений, каждое 0,01 мм (за оборот винт проходит 0,5 мм). С линией совпало деление 23 → 0,23. Итого 12 + 0,5 + 0,23 = 12,73 мм.' },
  { title: 'Частая ошибка', text: 'Не заметили нижнюю риску 0,5 — получили 12,23 вместо 12,73. Всегда проверяйте: видна ли половинка после последнего целого миллиметра.' },
]

function canvasTex(stage, w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = stage.renderer.capabilities.getMaxAnisotropy()
  return t
}
// полоска на поверхности вращения вокруг X: x0..x1, радиус r0..r1, угол aHi − v·span
// uv: u — вдоль X, v = 1 у верхнего края (меньший угол = выше)
function band(x0, x1, r0, r1, aHi, span, nx, na) {
  const pos = [], uv = [], idx = []
  for (let j = 0; j <= na; j++) {
    const v = j / na, a = aHi - v * span
    for (let i = 0; i <= nx; i++) {
      const u = i / nx, r = r0 + (r1 - r0) * u
      pos.push(x0 + (x1 - x0) * u, r * Math.cos(a), r * Math.sin(a))
      uv.push(u, v)
    }
  }
  for (let j = 0; j < na; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}
const cylX = (r, x0, x1, seg = 48) => new THREE.CylinderGeometry(r, r, x1 - x0, seg).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, 0, 0)

const XZ = 8 // ноль шкалы стебля
const SR = 1.1 // радиус стебля
const TR = 1.4 // радиус барабана

export default {
  title: 'Микрометр',
  animated: false,
  steps: STEPS,
  mount(host) {
    const C = PALETTE
    const WHOLE = new THREE.Box3(new THREE.Vector3(-2.2, -4.4, -0.6), new THREE.Vector3(16.5, 1.6, 0.6))
    const stage = createStage(host, { position: [5, 2.5, 22], target: [7, -1, 0], fov: 30, fit: WHOLE, pad: 1.0 })
    const to = animator(stage)
    const { root } = stage
    const timers = []
    const later = (fn, ms) => timers.push(setTimeout(fn, ms))
    const clearTimers = () => timers.splice(0).forEach(clearTimeout)
    const texs = []

    // ---------- скоба
    const fs = new THREE.Shape()
    fs.moveTo(-2.0, 1.0).lineTo(-0.8, 1.0).lineTo(-0.8, -2.6).quadraticCurveTo(-0.8, -3.0, -0.4, -3.0)
    fs.lineTo(5.8, -3.0).quadraticCurveTo(6.2, -3.0, 6.2, -2.6).lineTo(6.2, 1.0).lineTo(7.6, 1.0).lineTo(7.6, -3.0)
    fs.quadraticCurveTo(7.6, -4.2, 6.4, -4.2).lineTo(-0.8, -4.2).quadraticCurveTo(-2.0, -4.2, -2.0, -3.0).closePath()
    const frame = new THREE.Mesh(
      new THREE.ExtrudeGeometry(fs, { depth: 0.7, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -0.35),
      stage.mat('steelBlack'),
    )
    root.add(frame)
    const pad = stage.mesh(new THREE.BoxGeometry(5.2, 0.9, 0.08), 'rubber')
    pad.position.set(2.7, -3.6, 0.45)
    root.add(pad)
    const anvil = stage.mesh(cylX(0.65, -0.85, 0), 'chrome')
    root.add(anvil)
    const lock = stage.mesh(new THREE.BoxGeometry(0.25, 0.5, 0.25), 'steel')
    lock.position.set(6.9, 1.25, 0)
    root.add(lock)

    // ---------- стебель со шкалой
    root.add(stage.mesh(cylX(SR, 7.6, 13.2), 'steel'))
    const SPM = 40, S0 = -0.5, S1 = 26
    const sleeveTex = canvasTex(stage, (S1 - S0) * SPM, 256, (g, w, h) => {
      g.fillStyle = C.milk
      g.fillRect(0, 0, w, h)
      g.fillStyle = C.graphite
      const mid = h / 2
      g.fillRect(0, mid - 2, w, 4)
      g.textAlign = 'center'
      g.font = 'bold 52px Arial, sans-serif'
      for (let mm = 0; mm <= 25; mm++) {
        const x = (mm - S0) * SPM
        const L = mm % 5 === 0 ? 78 : 58
        g.fillRect(x - 2, mid - L, 4, L)
        if (mm % 5 === 0) g.fillText(String(mm), x, 46)
        if (mm < 25) g.fillRect(x + SPM / 2 - 2, mid, 4, 50)
      }
    })
    texs.push(sleeveTex)
    const AS = 1.1
    const sleeveScale = new THREE.Mesh(
      band(XZ + S0 / 5, XZ + S1 / 5, SR + 0.004, SR + 0.004, Math.PI / 2 + AS / 2, AS, 1, 12),
      new THREE.MeshBasicMaterial({ map: sleeveTex, toneMapped: false, side: THREE.DoubleSide }),
    )
    root.add(sleeveScale)

    // ---------- микровинт, барабан, трещотка
    const spindle = stage.mesh(cylX(0.65, 0, 9), 'chrome')
    root.add(spindle)
    const thimble = new THREE.Group()
    const tSteel = stage.mat('chrome')
    thimble.add(new THREE.Mesh(new THREE.CylinderGeometry(1.18, TR, 0.6, 64, 1, true).rotateZ(Math.PI / 2).translate(0.3, 0, 0), tSteel))
    thimble.add(new THREE.Mesh(cylX(TR, 0.6, 4.2, 64), tSteel))
    thimble.add(stage.mesh(cylX(TR + 0.03, 4.2, 5.4, 28), 'steelBlack'))
    const edgeRing = new THREE.Mesh(new THREE.RingGeometry(SR, 1.18, 48).rotateY(-Math.PI / 2), tSteel)
    thimble.add(edgeRing)
    const thTex = canvasTex(stage, 256, 2048, (g, w, h) => {
      g.fillStyle = C.milk
      g.fillRect(0, 0, w, h)
      g.fillStyle = C.graphite
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.font = 'bold 34px Arial, sans-serif'
      for (let k = 0; k < 50; k++) {
        const y = (1 - (k + 0.5) / 50) * h
        const L = k % 5 === 0 ? 110 : 70
        g.fillRect(0, y - 2, L, 4)
        if (k % 5 === 0) g.fillText(String(k), 128, y + 1)
      }
    })
    texs.push(thTex)
    const thScale = new THREE.Mesh(
      band(0.0, 0.6, 1.185, TR + 0.004, Math.PI / 2 + Math.PI / 50, Math.PI * 2, 1, 100),
      new THREE.MeshBasicMaterial({ map: thTex, toneMapped: false, side: THREE.DoubleSide }),
    )
    thimble.add(thScale)
    root.add(thimble)
    const ratchet = stage.mesh(cylX(0.75, 0, 1.4, 14), 'steelDark', { flatShading: true })
    root.add(ratchet)

    // ---------- деталь
    const part = stage.mesh(new THREE.CylinderGeometry(1.273, 1.273, 3, 64).rotateX(Math.PI / 2), 'iron')
    part.position.set(1.273, 0, 0)
    root.add(part)

    // ---------- подсветка рисок
    const flat = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.95 })
    const hl12 = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.3), flat(C.mark))
    hl12.position.set(XZ + 12 / 5, 0.17, SR + 0.02)
    const halfMat = flat(C.ok)
    const hlHalf = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.24), halfMat)
    hlHalf.position.set(XZ + 12.5 / 5, -0.14, SR + 0.02)
    root.add(hl12, hlHalf)

    // ---------- подписи
    const P = [
      stage.label('Скоба: держать за накладки', pad, { offset: [0, -0.45, 0], side: 'bottom' }),
      stage.label('Пятка', anvil, { offset: [-0.4, 0.65, 0], side: 'top' }),
      stage.label('Микровинт', new THREE.Vector3(3.2, 0.65, 0), { side: 'top' }),
      stage.label('Стебель', new THREE.Vector3(8.2, -1.1, 0), { side: 'bottom' }),
      stage.label('Барабан', thimble, { offset: [2.6, TR, 0], side: 'top' }),
      stage.label('Трещотка', ratchet, { offset: [0.9, -0.75, 0], side: 'bottom' }),
    ]
    const L = {
      zero: stage.label('0 на линии', new THREE.Vector3(XZ + 0.3, 0, TR), { side: 'right', tone: 'ok' }),
      click: stage.label('щёлк-щёлк', ratchet, { offset: [0.7, 0.8, 0], side: 'top', tone: 'accent' }),
      mm: stage.label('12 мм', new THREE.Vector3(XZ + 12 / 5, 0.55, SR), { side: 'top', tone: 'accent' }),
      half: stage.label('+ 0,5', new THREE.Vector3(XZ + 12.5 / 5, -0.45, SR), { side: 'bottom', tone: 'ok' }),
      th: stage.label('23 → 0,23', new THREE.Vector3(XZ + 12.73 / 5 + 0.6, 0, TR), { side: 'right', tone: 'ok' }),
      res: stage.label('', new THREE.Vector3(XZ + 12.73 / 5 + 1.6, -1.6, 0), { side: 'bottom', tone: 'big' }),
      bad: stage.label('Без 0,5: 12,23 — неверно', new THREE.Vector3(XZ + 12.5 / 5, -0.5, SR), { side: 'bottom', tone: 'warn' }),
    }

    // ---------- состояние
    const st = { g: 8, extra: 0, partZ: 4, click: 0 }
    stage.onFrame((dt, t) => {
      const gx = st.g / 5
      spindle.position.x = gx
      thimble.position.x = XZ + gx
      const phi = (2 * Math.PI * st.g) / 0.5
      thimble.rotation.x = phi
      ratchet.position.x = XZ + gx + 5.4
      ratchet.rotation.x = phi + st.extra
      part.position.z = st.partZ
      part.visible = st.partZ < 3.9
      L.click.show(st.click > 0.5 && Math.sin(t * 22) > -0.3)
      halfMat.opacity = st.blink ? 0.55 + 0.45 * Math.sin(t * 6) : 0.95
    })
    const clicks = (delay) => {
      later(() => {
        st.click = 1
        to(st, 'extra', st.extra + Math.PI * 4, 1.4)
      }, delay)
      later(() => (st.click = 0), delay + 1500)
    }

    let cur = { box: WHOLE, dir: [0.1, 0.2, 1] }
    const view = (b, dir, ms) => {
      cur = { box: b, dir }
      stage.fit(b, { dir, pad: 1.03, ms })
    }
    const READ = new THREE.Box3(new THREE.Vector3(XZ + 0.9, -1.5, 0.6), new THREE.Vector3(XZ + 4.4, 1.5, 1.4))

    const apply = (i, instant) => {
      clearTimers()
      const k = instant ? 0 : 1
      const ms = instant ? 0 : 1000
      st.click = 0
      st.blink = i === 5
      P.forEach((l) => l.show(i === 0))
      Object.values(L).forEach((l) => l.show(false))
      hl12.visible = i === 3 || i === 4 || i === 5
      hlHalf.visible = i >= 3
      if (i === 0) {
        to(st, 'g', 8, 0.9 * k)
        to(st, 'partZ', 4, 0.5 * k)
        view(WHOLE, [0.1, 0.2, 1], ms)
      } else if (i === 1) {
        to(st, 'partZ', 4, 0.5 * k)
        to(st, 'g', 0, 1.5 * k)
        view(new THREE.Box3(new THREE.Vector3(-1, -1.6, -1), new THREE.Vector3(XZ + 2.4, 1.6, 1)), [0.12, 0.18, 1], ms)
        if (instant) L.zero.show(true)
        else {
          clicks(1600)
          later(() => {
            view(new THREE.Box3(new THREE.Vector3(XZ - 1.8, -1.5, 0.6), new THREE.Vector3(XZ + 1.8, 1.5, 1.4)), [0.08, 0.12, 1], 1000)
            L.zero.show(true)
          }, 3200)
        }
      } else if (i === 2) {
        view(WHOLE, [0.15, 0.25, 1], ms)
        if (instant) {
          st.g = 12.73
          st.partZ = 0
        } else {
          to(st, 'g', 16, 1.0)
          later(() => to(st, 'partZ', 0, 0.9), 900)
          later(() => to(st, 'g', 12.73, 1.6), 1900)
          clicks(3600)
        }
      } else {
        to(st, 'g', 12.73, 0.8 * k)
        to(st, 'partZ', 0, 0.5 * k)
        view(READ, [0.05, 0.12, 1], ms)
        if (i === 3) {
          L.mm.show(true)
          L.half.show(true)
        } else if (i === 4) {
          L.th.show(true)
          L.res.set('12 + 0,5 + 0,23 = 12,73 мм').show(true)
        } else {
          L.bad.show(true)
          L.res.set('Верно: 12,73 мм').show(true)
        }
      }
    }

    stage.ready()
    return stage.controller({
      setStep: (i, o) => apply(i, o?.instant),
      resetView: () => stage.fit(cur.box, { dir: cur.dir, pad: 1.03, ms: 700 }),
      dispose() {
        clearTimers()
        texs.forEach((t) => t.dispose())
      },
    })
  },
}
