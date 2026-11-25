// Порядок затяжки: длинная крышка (головка) на 10 болтах. От центра наружу, крест-накрест,
// по проходам: предварительный, момент, доворот на угол. Для сравнения — неправильно, от края (перекос преувеличен).
import { createStage, THREE, PALETTE, cylY } from '../stage.js'
import { hexGeo, canvasTex, smooth, lerpRange } from './fastenersKit.js'

const STEPS = [
  { title: 'Порядок: от центра наружу', text: 'Сначала все болты наживляют вручную. Затягивают с центра, расходясь в стороны и чередуя стороны: 1, 2, 3… Так крышку не перекашивает, прокладка сжимается ровно.' },
  { title: 'Проход 1 — предварительно', text: 'Первый проход по порядку — небольшим моментом (например, ~30% от заданного). Деталь и прокладка садятся постепенно.' },
  { title: 'Проход 2 — момент по ТК', text: 'Следующие проходы в том же порядке: ~60–70%, затем 100% момента. Обычно добавляют контрольный проход: все болты должны «щёлкнуть» без доворота.' },
  { title: 'Проход 3 — доворот на угол', text: 'Если ТК требует «момент + угол», болты по порядку доворачивают на заданный угол и ставят метку. Такие болты после доворота ключом уже не проверяют.' },
  { title: 'Неправильно: от края', text: 'Если тянуть подряд от одного края и сразу в полный момент, крышку перекосит, прокладка зажмётся неравномерно — будет течь. Перекос показан сильно преувеличенным.' },
]

// раскладка как на схеме: верхний ряд 7 3 1 5 9, нижний 10 6 2 4 8
const XS = [-2.2, -1.1, 0, 1.1, 2.2]
const ROWS = [
  { z: -0.55, nums: [7, 3, 1, 5, 9] },
  { z: 0.55, nums: [10, 6, 2, 4, 8] },
]
const COVER_Y = 0.05, COVER_H = 0.55
const DT = 0.42 // время на один болт
const PASS_ANG = [0, Math.PI / 3, Math.PI / 4, Math.PI / 2]
const PASS_TXT = ['', 'Проход 1: ~30% момента', 'Проход 2: 100% момента по ТК', 'Проход 3: доворот на угол']

export default {
  title: 'Порядок затяжки',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { fov: 30, position: [0, 6, 5], target: [0, 0.3, 0] })
    const { root } = stage
    const textures = []

    const block = stage.mesh(new THREE.BoxGeometry(6.6, 0.8, 2.5), 'iron')
    block.position.y = -0.4
    root.add(block)
    const gasket = stage.mesh(new THREE.BoxGeometry(6.1, COVER_Y, 2.05), 'rubber')
    gasket.position.y = COVER_Y / 2
    root.add(gasket)

    // крышка с делением по X — её можно «изогнуть»
    const coverGeo = new THREE.BoxGeometry(6, COVER_H, 2, 40, 1, 1)
    coverGeo.translate(0, COVER_Y + COVER_H / 2, 0)
    const numTex = canvasTex(1536, 512, (g, w, h) => {
      g.fillStyle = PALETTE.steelDark
      g.fillRect(0, 0, w, h)
      g.font = '700 64px Arial'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      for (const row of ROWS)
        row.nums.forEach((n, i) => {
          const cx = ((XS[i] + 0.4 + 3) / 6) * w, cy = ((row.z + 1) / 2) * h
          g.fillStyle = n === 1 ? PALETTE.mark : '#e8e2d6'
          g.beginPath()
          g.arc(cx, cy, 38, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#1d1d1f'
          g.fillText(String(n), cx, cy + 3)
        })
    })
    textures.push(numTex)
    const topGeo = new THREE.PlaneGeometry(6, 2, 40, 1).rotateX(-Math.PI / 2)
    topGeo.translate(0, COVER_Y + COVER_H + 0.003, 0)
    const cover = new THREE.Group()
    cover.add(stage.mesh(coverGeo, 'steelDark'), stage.mesh(topGeo, stage.mat('steelDark', { map: numTex, color: '#ffffff', metalness: 0.5, roughness: 0.5 })))
    root.add(cover)
    const coverBase = coverGeo.attributes.position.array.slice()
    const topBase = topGeo.attributes.position.array.slice()
    const bend = (geo, base, f) => {
      const a = geo.attributes.position.array
      for (let i = 0; i < a.length; i += 3) a[i + 1] = base[i + 1] + f(base[i])
      geo.attributes.position.needsUpdate = true
      geo.computeVertexNormals()
    }

    // болты
    const headGeo = hexGeo(0.42, 0.24)
    const washGeo = cylY(0.27, 0.04, 28)
    const markGeo = new THREE.BoxGeometry(0.04, 0.01, 0.2)
    const bolts = []
    for (const row of ROWS)
      row.nums.forEach((n, i) => {
        const g = new THREE.Group()
        const wash = stage.mesh(washGeo, 'chrome')
        wash.position.y = 0.02
        const head = stage.mesh(headGeo, 'steelBlack')
        head.position.y = 0.04 + 0.12
        const mark = stage.mesh(markGeo, 'mark')
        mark.position.set(0, 0.29, 0.1)
        head.add(mark)
        mark.position.y = 0.125
        g.add(wash, head)
        g.position.set(XS[i], 0, row.z)
        root.add(g)
        bolts.push({ n, x: XS[i], z: row.z, g, head, mark })
      })
    bolts.sort((a, b) => a.n - b.n)
    // «слева направо» для неправильного порядка
    const wrongOrder = [...bolts].sort((a, b) => a.x - b.x || a.z - b.z)

    // курсор — ключ на текущем болте
    const cursorMat = new THREE.MeshBasicMaterial({ color: PALETTE.ok, toneMapped: false })
    const cursor = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 40).rotateX(Math.PI / 2), cursorMat)
    root.add(cursor)

    const lPass = stage.label('', new THREE.Vector3(0, 0.75, -1.05), { side: 'top', tone: 'accent' })
    const lStart = stage.label('начинаем с центра', new THREE.Vector3(0, 0.75, -0.2), { side: 'top' })
    const lWarp = stage.label('перекос (преувеличен)', new THREE.Vector3(2.6, 0.9, 1.0), { side: 'top', tone: 'warn' })
    const lGap = stage.label('прокладка зажата неравномерно', new THREE.Vector3(2.8, 0.05, 1.05), { side: 'bottom', tone: 'warn' })

    let step = 0, t = 0
    const PERIOD = 10 * DT + 2.2
    const HOLD = [PERIOD - 0.5, PERIOD - 0.5, PERIOD - 0.5, PERIOD - 0.5, PERIOD - 0.5]
    let lastWarp = -1
    stage.onFrame((dt) => {
      if (stage.playing) t += dt
      const k = t % PERIOD
      const cur = Math.floor((k - 0.4) / DT) // индекс болта в работе
      const prog = (idx) => smooth(0.4 + idx * DT, 0.4 + (idx + 0.85) * DT, k) // 0..1 для болта idx
      let warp = 0
      if (step <= 3) {
        // правильный порядок: предыдущие проходы сделаны, текущий идёт по номерам
        const sink = 0.012 * (step - 1) // прокладка садится с каждым проходом
        bolts.forEach((b, idx) => {
          let ang = 0
          for (let p = 1; p < step; p++) ang += PASS_ANG[p]
          const p = step >= 1 ? prog(idx) : 0
          ang += PASS_ANG[step] * p
          b.head.rotation.y = -ang
          b.head.material = stage.mat(step >= 1 && p >= 1 ? 'ok' : 'steelBlack')
          b.mark.visible = step === 3 && p >= 1
          b.g.position.y = COVER_Y + COVER_H - Math.max(0, sink + 0.012 * p * (step >= 1 ? 1 : 0))
        })
        const sinkNow = step >= 1 ? 0.012 * (step - 1) + 0.012 * (cur >= 10 ? 1 : Math.max(0, cur) / 10) : 0
        cover.position.y = -sinkNow
        warp = 0
      } else {
        const p = smooth(0.4, 0.4 + 10 * DT, k)
        const xc = lerpRange(-3, 3, p)
        const fin = smooth(0.75, 1, p)
        warp = p // кодируем для кэша
        const f = (x) => lerpRange(0.38 * smooth(xc, xc + 3, x), 0.2 * smooth(0.6, 3, x), fin)
        if (Math.abs(lastWarp - warp) > 0.002) {
          bend(coverGeo, coverBase, f)
          bend(topGeo, topBase, f)
          lastWarp = warp
        }
        cover.position.y = 0
        wrongOrder.forEach((b, idx) => {
          const q = prog(idx)
          b.head.rotation.y = -(Math.PI / 3 + Math.PI / 4) * q
          b.head.material = stage.mat(q >= 1 ? 'bad' : 'steelBlack')
          b.mark.visible = false
          b.g.position.y = COVER_Y + COVER_H + f(b.x)
        })
        lWarp.show(fin > 0.5)
        lGap.show(fin > 0.5)
        gasket.material = stage.mat(fin > 0.5 ? 'bad' : 'rubber')
      }
      if (step <= 3 && lastWarp !== 0) {
        bend(coverGeo, coverBase, () => 0)
        bend(topGeo, topBase, () => 0)
        lastWarp = 0
        gasket.material = stage.mat('rubber')
      }
      // курсор
      const list = step === 4 ? wrongOrder : bolts
      const ci = step === 0 ? Math.floor(k / ((PERIOD - 0.6) / 10)) : cur
      cursor.visible = ci >= 0 && ci < 10
      if (cursor.visible) {
        const b = list[ci]
        cursor.position.set(b.x, b.g.position.y + 0.08, b.z)
        if (step === 0) b.head.material = stage.mat('ok')
      }
      if (step === 0) bolts.forEach((b, idx) => (b.head.material = stage.mat(idx <= ci ? 'ok' : 'steelBlack')))
      lStart.show(step === 0 && ci <= 1)
    })

    const box = new THREE.Box3(new THREE.Vector3(-3.3, -0.5, -1.25), new THREE.Vector3(3.3, 1.0, 1.25))
    const apply = (i, instant) => {
      step = i
      t = stage.playing ? 0 : HOLD[i]
      lPass.set(i === 0 ? 'Порядок: 1 → 10' : i === 4 ? 'Подряд от края — нельзя' : PASS_TXT[i]).tone(i === 4 ? 'warn' : 'accent').show(true)
      lWarp.show(false)
      lGap.show(false)
      stage.fit(box, { dir: i === 4 ? [0.55, 0.55, 1] : [0, 1.25, 1], pad: 0.78, ms: instant ? 0 : 900 })
      if (instant) stage.setHome()
    }
    stage.ready()
    return stage.controller({
      setStep: (i, o) => apply(i, o?.instant),
      dispose() {
        textures.forEach((tx) => tx.dispose())
      },
    })
  },
}
