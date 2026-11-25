// Чертёж вала: ступенчатый вал в 3D, поверх — обозначения чертежа (ось, размеры, Ø, допуск,
// шероховатость, резьба, фаски, шпоночный паз). Размеры учебные, как на схеме урока.
// Масштаб: 1 ед. = 40 мм. Вал: Ø50 (120 мм) | Ø70 (100 мм) | Ø30 с резьбой M30×2 (100 мм), всего 320.
import { createStage, animator, THREE, PALETTE } from '../stage.js'

const STEPS = [
  { title: 'Вал и ось', text: 'Вал круглый, поэтому для него хватает одного вида. Через центр проходит ось — тонкая штрихпунктирная линия.' },
  { title: 'Длины', text: 'Числа без единиц на чертеже — миллиметры: участок 120 мм, весь вал 320 мм. Стрелки стоят на размерной линии, а тонкие выносные линии «отводят» размер от детали.' },
  { title: 'Диаметры и допуск', text: 'Значок Ø — диаметр. «Ø50 g6»: диаметр 50 мм, g6 — поле допуска. Этот вал чуть меньше 50: от 49,975 до 49,991 мм (пример из урока).' },
  { title: 'Шероховатость', text: 'Знак-«галочка» с «Ra 0,8» — поверхность должна быть очень гладкой. Обычно это место посадки: под подшипник или втулку.' },
  { title: 'Резьба и фаски', text: '«M30×2» — метрическая резьба: диаметр 30 мм, шаг 2 мм. Фаска — срезанная кромка: деталь легче входит и не режет руки. «2×45°» — 2 мм под углом 45°.' },
  { title: 'Шпоночный паз', text: 'Паз под шпонку. Шпонка входит в паз вала и в паз ступицы шестерни или шкива и передаёт вращение. На чертеже паз показывают с размерами ширины, глубины и длины.' },
]

const R50 = 0.625, R70 = 0.875, R30 = 0.375, CH = 0.08

// плоские ленты для осевой линии
function dashGeo(x1, x2, y, w, pattern) {
  const pos = []
  let s = x1, k = 0
  while (s < x2) {
    const len = pattern[k % pattern.length]
    if (k % 2 === 0) {
      const e = Math.min(x2, s + len)
      pos.push(s, y - w, 0, e, y - w, 0, e, y + w, 0, s, y - w, 0, e, y + w, 0, s, y + w, 0)
    }
    s += len
    k++
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

export default {
  title: 'Чертёж вала: что написано',
  animated: false,
  steps: STEPS,
  mount(host) {
    const C = PALETTE
    const ALL = new THREE.Box3(new THREE.Vector3(-4.8, -2.2, -1), new THREE.Vector3(4.6, 1.5, 1))
    const stage = createStage(host, { position: [5, 4, 9], target: [0, 0, 0], fov: 30, fit: ALL, pad: 1.0 })
    const to = animator(stage)
    const { root } = stage

    // ---------- вал (ось X)
    const shaft = new THREE.Group()
    const glow = (kind) => stage.mat(kind, { emissive: new THREE.Color(C.mark), emissiveIntensity: 0 })
    const journalMat = glow('chrome')
    const collarMat = glow('steel')
    const threadMat = glow('steelDark')
    const chamferMat = glow('steel')
    const keyMat = glow('brass')
    const cyl = (r, x0, x1, m) => {
      const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, 56).rotateZ(Math.PI / 2), m)
      me.position.x = (x0 + x1) / 2
      return me
    }
    const cone = (rL, rR, x0, x1, m) => {
      // у cylX «верх» смотрит в −X
      const me = new THREE.Mesh(new THREE.CylinderGeometry(rL, rR, x1 - x0, 56).rotateZ(Math.PI / 2), m)
      me.position.x = (x0 + x1) / 2
      return me
    }
    shaft.add(cone(R50 - CH, R50, -4, -4 + CH, chamferMat))
    shaft.add(cyl(R50, -4 + CH, -1, journalMat))
    shaft.add(cyl(R70, -1, -0.3, collarMat))
    // участок с пазом: круг с вырезом, вытянутый вдоль X
    const KW = 0.18, KD = 0.2
    const ks = new THREE.Shape()
    const top = Math.sqrt(R70 * R70 - KW * KW)
    const th = Math.atan2(top, KW)
    ks.moveTo(KW, R70 - KD)
    ks.lineTo(KW, top)
    ks.absarc(0, 0, R70, th, Math.PI - th, true)
    ks.lineTo(-KW, R70 - KD)
    ks.closePath()
    const kwGeo = new THREE.ExtrudeGeometry(ks, { depth: 1.2, bevelEnabled: false, curveSegments: 64 }).rotateY(Math.PI / 2).translate(-0.3, 0, 0)
    shaft.add(new THREE.Mesh(kwGeo, collarMat))
    shaft.add(cyl(R70, 0.9, 1.5, collarMat))
    shaft.add(cyl(R30, 1.5, 2.0, threadMat))
    // резьба (кольцевые витки, шаг показан крупнее) + фаска на конце
    const prof = [[R30, 2.0]]
    const P = 0.1
    for (let y = 2.0; y < 3.85; y += P) prof.push([R30 - 0.045, y + P / 2], [R30, y + P])
    prof.push([R30 - CH, 4.0])
    const thread = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40).rotateZ(-Math.PI / 2), threadMat)
    shaft.add(thread)
    const endCap = new THREE.Mesh(new THREE.CircleGeometry(R30 - CH, 40).rotateY(Math.PI / 2), threadMat)
    endCap.position.x = 4.0
    shaft.add(endCap)
    // поясок фаски на конце — отдельным материалом для подсветки
    const chR = new THREE.Mesh(new THREE.CylinderGeometry(R30 - CH + 0.004, R30 + 0.004, CH, 40, 1, true).rotateZ(-Math.PI / 2), chamferMat)
    chR.position.x = 4 - CH / 2
    shaft.add(chR)
    root.add(shaft)

    // шпонка (опускается в паз на последнем шаге)
    const key = new THREE.Mesh(new THREE.BoxGeometry(1.1, KD * 2, KW * 2 - 0.01), keyMat)
    root.add(key)

    // ---------- осевая линия (рисуется поверх детали, как на чертеже)
    const axMat = new THREE.MeshBasicMaterial({ color: C.mark, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
    const axis = new THREE.Mesh(dashGeo(-4.7, 4.7, 0, 0.012, [0.42, 0.07, 0.05, 0.07]), axMat)
    axis.renderOrder = 5
    root.add(axis)

    // ---------- размеры: размерная линия со стрелками + выносные
    const dims = []
    function dim({ a, b, ext = [], poly = null, z = 0, arrows = true }) {
      const lineMat = new THREE.LineBasicMaterial({ color: C.milk, transparent: true, opacity: 0, toneMapped: false })
      const headMat = new THREE.MeshBasicMaterial({ color: C.milk, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false })
      const g = new THREE.Group()
      g.position.z = z
      const pts = []
      if (a) pts.push(new THREE.Vector3(...a, 0), new THREE.Vector3(...b, 0))
      for (const [p, q] of ext) pts.push(new THREE.Vector3(...p, 0), new THREE.Vector3(...q, 0))
      if (pts.length) g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat))
      if (poly) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(poly.map((p) => new THREE.Vector3(...p, 0))), lineMat))
      if (a && arrows) {
        const A = new THREE.Vector2(...a), B = new THREE.Vector2(...b)
        const u = B.clone().sub(A).normalize(), n = new THREE.Vector2(-u.y, u.x)
        const L = 0.17, W = 0.05, pos = []
        for (const [tip, dir] of [[A, -1], [B, 1]]) {
          const base = tip.clone().addScaledVector(u, -dir * L)
          pos.push(tip.x, tip.y, 0, base.x + n.x * W, base.y + n.y * W, 0, base.x - n.x * W, base.y - n.y * W, 0)
        }
        const hg = new THREE.BufferGeometry()
        hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
        g.add(new THREE.Mesh(hg, headMat))
      }
      root.add(g)
      const d = { g, mats: [lineMat, headMat] }
      dims.push(d)
      return d
    }
    const d120 = dim({ a: [-4, -1.3], b: [-1, -1.3], ext: [[[-4, -0.66], [-4, -1.45]], [[-1, -0.68], [-1, -1.45]]] })
    const d320 = dim({ a: [-4, -1.95], b: [4, -1.95], ext: [[[-4, -1.45], [-4, -2.1]], [[4, -0.34], [4, -2.1]]] })
    const dD50 = dim({ a: [-4.55, -R50], b: [-4.55, R50], ext: [[[-4.05, R50], [-4.7, R50]], [[-4.05, -R50], [-4.7, -R50]]] })
    const dD70 = dim({ a: [0.25, -R70], b: [0.25, R70], z: R70 + 0.03 })
    const dRa = dim({ poly: [[-2.67, 0.8], [-2.55, R50 + 0.01], [-2.34, 1.12], [-1.7, 1.12]] })
    const dM = dim({ poly: [[2.9, R30], [2.9, 1.3], [3.9, 1.3]] })
    const DIMSET = [d120, d320, dD50, dD70, dRa, dM]

    // ---------- подписи
    const lAxis = stage.label('Ось', new THREE.Vector3(4.7, 0, 0), { side: 'right' })
    const L = {
      120: stage.label('120', new THREE.Vector3(-2.5, -1.3, 0), { side: 'top', tone: 'big' }),
      320: stage.label('320', new THREE.Vector3(0, -1.95, 0), { side: 'top', tone: 'big' }),
      d50: stage.label('Ø50 g6', new THREE.Vector3(-4.6, 0, 0), { side: 'left', tone: 'big' }),
      d70: stage.label('Ø70', new THREE.Vector3(0.3, 0.2, R70 + 0.03), { side: 'right', tone: 'big' }),
      ra: stage.label('Ra 0,8', new THREE.Vector3(-2.0, 1.12, 0), { side: 'top', tone: 'big' }),
      m: stage.label('M30×2', new THREE.Vector3(3.4, 1.3, 0), { side: 'top', tone: 'big' }),
      ch: stage.label('Фаска 2×45°', new THREE.Vector3(4.0, -0.32, 0), { side: 'bottom', tone: 'accent' }),
      kw: stage.label('Шпоночный паз', new THREE.Vector3(0.3, R70, 0), { side: 'top', tone: 'accent' }),
    }

    const state = { keyY: 2.6 }
    stage.onFrame(() => {
      key.position.set(0.3, state.keyY, 0)
      key.visible = state.keyY < 2.5
    })

    // какие размеры видны на шаге: 0 — нет, 0.3 — приглушён, 1 — главный
    const S = [
      { dims: [0, 0, 0, 0, 0, 0], ax: 1, lab: [], hl: [], dir: [0.55, 0.45, 1], box: new THREE.Box3(new THREE.Vector3(-4.6, -1, -1), new THREE.Vector3(4.8, 1, 1)) },
      { dims: [1, 1, 0, 0, 0, 0], ax: 1, lab: ['120', '320'], hl: [], dir: [0.06, 0.08, 1], box: ALL },
      { dims: [0.3, 0.3, 1, 1, 0, 0], ax: 0.6, lab: ['d50', 'd70'], hl: [journalMat, collarMat], dir: [-0.6, 0.25, 1], box: ALL },
      { dims: [0.3, 0.3, 0.3, 0.3, 1, 0], ax: 0.6, lab: ['ra'], hl: [journalMat], dir: [-0.15, 0.25, 1], box: new THREE.Box3(new THREE.Vector3(-4.8, -1.4, -0.7), new THREE.Vector3(0, 1.4, 0.7)) },
      { dims: [0.3, 0.3, 0.3, 0.3, 0.3, 1], ax: 0.6, lab: ['m', 'ch'], hl: [threadMat, chamferMat], dir: [0.5, 0.25, 1], box: new THREE.Box3(new THREE.Vector3(0.8, -1.0, -0.6), new THREE.Vector3(4.8, 1.5, 0.6)) },
      { dims: [0, 0, 0, 0, 0, 0], ax: 0.4, lab: ['kw'], hl: [keyMat], dir: [0.35, 1.1, 1], box: new THREE.Box3(new THREE.Vector3(-1.4, -1, -1), new THREE.Vector3(2, 1.4, 1)) },
    ]
    let cur = S[0]
    const apply = (i, instant) => {
      const s = (cur = S[i])
      const k = instant ? 0 : 1
      DIMSET.forEach((d, j) => d.mats.forEach((m) => to(m, 'opacity', s.dims[j] * 0.95, 0.7 * k)))
      to(axMat, 'opacity', s.ax * 0.9, 0.6 * k)
      lAxis.show(i === 0)
      for (const [n, l] of Object.entries(L)) l.show(s.lab.includes(n))
      for (const m of [journalMat, collarMat, threadMat, chamferMat, keyMat]) to(m, 'emissiveIntensity', s.hl.includes(m) ? 0.32 : 0, 0.6 * k)
      if (i === 5) {
        state.keyY = instant ? R70 : 2.4
        to(state, 'keyY', R70, 1.2 * k)
      } else to(state, 'keyY', 2.6, 0.01)
      stage.fit(s.box, { dir: s.dir, pad: 1.02, ms: instant ? 0 : 1000 })
    }

    stage.ready()
    return stage.controller({
      setStep: (i, o) => apply(i, o?.instant),
      resetView: () => stage.fit(cur.box, { dir: cur.dir, pad: 1.02, ms: 700 }),
    })
  },
}
