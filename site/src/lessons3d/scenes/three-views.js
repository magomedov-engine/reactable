// Три вида: деталь в «коробке» из трёх плоскостей проекций, контуры на плоскостях,
// затем коробка раскрывается в лист чертежа (главный вид, вид сверху под ним, вид слева справа).
import { createStage, animator, THREE, PALETTE } from '../stage.js'

const STEPS = [
  { title: 'Деталь в «коробке»', text: 'Деталь объёмная, а лист плоский. Мысленно ставим деталь в угол из трёх плоскостей: сзади, снизу и справа. На каждую плоскость перенесём её контур.' },
  { title: 'Главный вид', text: 'Смотрим на деталь спереди и переносим всё, что видно, на заднюю плоскость. Это главный вид: по нему лучше всего понятна форма детали.' },
  { title: 'Вид сверху и вид слева', text: 'Так же смотрим сверху и слева. Отверстие сверху видно кругом. Спереди и слева его не видно, оно внутри: его рисуют штриховой линией.' },
  { title: 'Раскрываем коробку', text: 'Нижнюю плоскость откидываем вниз, правую — вправо. Получился лист чертежа: главный вид сверху слева, вид сверху — под ним, вид слева — справа от главного.' },
  { title: 'Виды связаны', text: 'Ширина главного вида = ширине вида сверху, высота главного = высоте вида слева. Толстая линия — видимый контур, штриховая — невидимый, штрихпунктир — ось.' },
]

// ---------- плоские «линии чертежа» лентами (WebGL рисует линии толщиной 1 px)
function strokeGeo(segs, w) {
  const pos = []
  for (const [x1, y1, x2, y2] of segs) {
    const dx = x2 - x1, dy = y2 - y1
    const L = Math.hypot(dx, dy) || 1
    const nx = (-dy / L) * w * 0.5, ny = (dx / L) * w * 0.5
    const ex = (dx / L) * w * 0.5, ey = (dy / L) * w * 0.5
    const a = [x1 - ex + nx, y1 - ey + ny, 0], b = [x1 - ex - nx, y1 - ey - ny, 0]
    const c = [x2 + ex - nx, y2 + ey - ny, 0], d = [x2 + ex + nx, y2 + ey + ny, 0]
    pos.push(...a, ...b, ...c, ...a, ...c, ...d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}
function dashSegs(x1, y1, x2, y2, pattern) {
  const out = []
  const L = Math.hypot(x2 - x1, y2 - y1)
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L
  let s = 0, k = 0
  while (s < L) {
    const len = pattern[k % pattern.length]
    if (k % 2 === 0) {
      const e = Math.min(L, s + len)
      out.push([x1 + ux * s, y1 + uy * s, x1 + ux * e, y1 + uy * e])
    }
    s += len
    k++
  }
  return out
}
const HID = [0.12, 0.07] // штриховая
const AX = [0.32, 0.06, 0.04, 0.06] // штрихпунктир
const poly = (pts, closed = true) => pts.slice(0, closed ? pts.length : -1).map((p, i) => [...p, ...pts[(i + 1) % pts.length]])
const circle = (cx, cy, r, n = 44) => Array.from({ length: n }, (_, i) => {
  const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2
  return [cx + r * Math.cos(a0), cy + r * Math.sin(a0), cx + r * Math.cos(a1), cy + r * Math.sin(a1)]
})

// деталь: основание 3×0,8×2 с отверстием, на нём справа выступ 1,4×1,2
const HX = -0.75, HR = 0.32
const VIEWS = {
  // главный вид: (u,v) = (x,y)
  front: {
    vis: poly([[-1.5, 0], [1.5, 0], [1.5, 2], [0.1, 2], [0.1, 0.8], [-1.5, 0.8]]),
    hid: [...dashSegs(HX - HR, 0, HX - HR, 0.8, HID), ...dashSegs(HX + HR, 0, HX + HR, 0.8, HID)],
    ax: dashSegs(HX, -0.25, HX, 1.05, AX),
  },
  // вид сверху: (u,v) = (x,-z)
  top: {
    vis: [...poly([[-1.5, -1], [1.5, -1], [1.5, 1], [-1.5, 1]]), [0.1, -1, 0.1, 1], ...circle(HX, 0, HR)],
    hid: [],
    ax: [...dashSegs(HX - 0.55, 0, HX + 0.55, 0, AX), ...dashSegs(HX, -0.55, HX, 0.55, AX)],
  },
  // вид слева: (u,v) = (z,y)
  side: {
    vis: [...poly([[-1, 0], [1, 0], [1, 2], [-1, 2]]), [-1, 0.8, 1, 0.8]],
    hid: [...dashSegs(-HR, 0, -HR, 0.8, HID), ...dashSegs(HR, 0, HR, 0.8, HID)],
    ax: dashSegs(0, -0.25, 0, 1.05, AX),
  },
}

export default {
  title: 'Три вида детали',
  animated: false,
  steps: STEPS,
  mount(host) {
    const FOLDED = new THREE.Box3(new THREE.Vector3(-2.5, -1, -2), new THREE.Vector3(2.5, 3, 2))
    const FLAT = new THREE.Box3(new THREE.Vector3(-2.6, -5.1, -2), new THREE.Vector3(6.6, 3.1, -2))
    const stage = createStage(host, { position: [6, 4.6, 9.5], target: [0, 1, 0], fov: 30, fit: FOLDED, pad: 1.0 })
    const to = animator(stage)
    const { root } = stage
    const C = PALETTE

    const basic = (color, opacity = 1) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })

    // ---------- деталь
    const part = new THREE.Group()
    const partMat = stage.mat('steel', { transparent: true, opacity: 1 })
    const edgeMat = new THREE.LineBasicMaterial({ color: C.graphite, transparent: true, opacity: 0.9 })
    const shape = new THREE.Shape()
    shape.moveTo(-1.5, -1).lineTo(1.5, -1).lineTo(1.5, 1).lineTo(-1.5, 1).closePath()
    const hole = new THREE.Path()
    hole.absarc(HX, 0, HR, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const baseGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false, curveSegments: 40 }).rotateX(-Math.PI / 2)
    const topGeo = new THREE.BoxGeometry(1.4, 1.2, 2).translate(0.8, 1.4, 0)
    for (const g of [baseGeo, topGeo]) {
      part.add(new THREE.Mesh(g, partMat))
      part.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), edgeMat))
    }
    root.add(part)

    // ---------- плоскости-«листы»: локальная XY — плоскость листа, +Z смотрит на деталь
    const sheetMat = basic(C.milk, 0.06)
    const borderMat = basic(C.milk, 0.35)
    function makeSheet(u0, u1, v0, v1, view) {
      const g = new THREE.Group()
      const visMat = basic(C.milk, 0)
      const hidMat = basic(C.steel, 0)
      const axMat = basic(C.mark, 0)
      g.userData.mats = [visMat, hidMat, axMat]
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0, v1 - v0).translate((u0 + u1) / 2, (v0 + v1) / 2, 0), sheetMat)
      quad.renderOrder = -1
      const border = new THREE.Mesh(strokeGeo(poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]), 0.02), borderMat)
      const drawing = new THREE.Group()
      drawing.position.z = 0.01
      drawing.add(new THREE.Mesh(strokeGeo(view.vis, 0.05), visMat))
      if (view.hid.length) drawing.add(new THREE.Mesh(strokeGeo(view.hid, 0.028), hidMat))
      drawing.add(new THREE.Mesh(strokeGeo(view.ax, 0.02), axMat))
      g.add(quad, border, drawing)
      return g
    }
    // фронтальная: z = -2
    const frontSheet = makeSheet(-2.5, 2.5, -1, 3, VIEWS.front)
    frontSheet.position.z = -2
    root.add(frontSheet)
    // горизонтальная: y = -1, шарнир по линии (y=-1, z=-2)
    const topPivot = new THREE.Group()
    topPivot.position.set(0, -1, -2)
    const topSheet = makeSheet(-2.5, 2.5, -2, 2, VIEWS.top)
    topSheet.rotation.x = -Math.PI / 2
    topSheet.position.z = 2
    topPivot.add(topSheet)
    root.add(topPivot)
    // профильная: x = 2.5, шарнир по линии (x=2.5, z=-2)
    const sidePivot = new THREE.Group()
    sidePivot.position.set(2.5, 0, -2)
    const sideSheet = makeSheet(-2, 2, -1, 3, VIEWS.side)
    sideSheet.rotation.y = -Math.PI / 2
    sideSheet.position.z = 2
    sidePivot.add(sideSheet)
    root.add(sidePivot)

    // ---------- линии проецирования (от детали к плоскости)
    const projMat = new THREE.LineBasicMaterial({ color: C.mark, transparent: true, opacity: 0.7 })
    function projectors(points, axis) {
      const pos = []
      for (const p of points) {
        const a = new THREE.Vector3(...p)
        const b = a.clone()
        b[axis] += axis === 'x' ? 1 : -1
        pos.push(...a.toArray(), ...b.toArray())
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      const ls = new THREE.LineSegments(g, projMat)
      const grp = new THREE.Group()
      grp.add(ls)
      return grp
    }
    const projF = projectors([[-1.5, 0, 0], [1.5, 0, 0], [1.5, 2, 0], [0.1, 2, 0], [0.1, 0.8, 0], [-1.5, 0.8, 0]], 'z')
    projF.position.z = -1
    const projT = projectors([[-1.5, 0, -1], [1.5, 0, -1], [1.5, 0, 1], [-1.5, 0, 1], [HX, 0, 0]], 'y')
    const projS = projectors([[0, 0, -1], [0, 0, 1], [0, 2, 1], [0, 2, -1]], 'x')
    projS.position.x = 1.5
    root.add(projF, projT, projS)

    // ---------- направления взгляда
    const arF = stage.arrow(new THREE.Vector3(-0.2, 1, 4.3), new THREE.Vector3(-0.2, 1, 2.3), C.milk, { head: 0.35, width: 0.22 })
    const arT = stage.arrow(new THREE.Vector3(HX, 3.4, 0), new THREE.Vector3(HX, 1.9, 0), C.milk, { head: 0.35, width: 0.22 })
    const arS = stage.arrow(new THREE.Vector3(-3.6, 0.4, 0), new THREE.Vector3(-1.9, 0.4, 0), C.milk, { head: 0.35, width: 0.22 })
    root.add(arF, arT, arS)

    // ---------- линии связи между видами (на раскрытом листе)
    const alignMat = basic(C.ok, 0)
    const alignSegs = [
      ...[-1.5, HX, 0.1, 1.5].flatMap((x) => dashSegs(x, -0.15, x, -1.85, [0.1, 0.08])),
      ...[0, 0.8, 2].flatMap((y) => dashSegs(1.65, y, 3.35, y, [0.1, 0.08])),
    ]
    const align = new THREE.Mesh(strokeGeo(alignSegs, 0.022), alignMat)
    align.position.z = -1.98
    root.add(align)

    // ---------- подписи
    const lPart = stage.label('Деталь', part, { offset: [0.8, 2.05, 0] })
    const lMain = stage.label('Главный вид', frontSheet, { offset: [0, 2.6, 0] })
    const lTop = stage.label('Вид сверху', topSheet, { offset: [0, -1.25, 0], side: 'bottom' })
    const lSide = stage.label('Вид слева', sideSheet, { offset: [0, 2.6, 0] })
    const lHid = stage.label('Отверстие: штрихи', frontSheet, { offset: [-1.6, 0.4, 0], side: 'left', tone: 'accent' })

    const state = { unfold: 0, pF: 0, pT: 0, pS: 0 }
    stage.onFrame(() => {
      topPivot.rotation.x = state.unfold * Math.PI * 0.5
      sidePivot.rotation.y = state.unfold * Math.PI * 0.5
      projF.scale.z = Math.max(1e-3, state.pF)
      projT.scale.y = Math.max(1e-3, state.pT)
      projS.scale.x = Math.max(1e-3, state.pS)
      projF.visible = state.pF > 0.01
      projT.visible = state.pT > 0.01
      projS.visible = state.pS > 0.01
      part.visible = partMat.opacity > 0.01
      align.visible = alignMat.opacity > 0.01
    })

    const S = [
      { p: [0, 0, 0], d: 0, unfold: 0, part: 1, ar: [0, 0, 0], align: 0, cam: [0.65, 0.5, 1], box: FOLDED, lab: [1, 0, 0, 0, 0] },
      { p: [1, 0, 0], d: 1, unfold: 0, part: 0.45, ar: [1, 0, 0], align: 0, cam: [0.4, 0.3, 1], box: FOLDED, lab: [0, 1, 0, 0, 0] },
      { p: [1, 1, 1], d: 3, unfold: 0, part: 0.55, ar: [0, 1, 1], align: 0, cam: [-0.75, 0.75, 1], box: FOLDED, lab: [0, 1, 1, 1, 1] },
      { p: [0, 0, 0], d: 3, unfold: 1, part: 0, ar: [0, 0, 0], align: 0, cam: [0, 0, 1], box: FLAT, lab: [0, 1, 1, 1, 0] },
      { p: [0, 0, 0], d: 3, unfold: 1, part: 0, ar: [0, 0, 0], align: 1, cam: [0, 0, 1], box: FLAT, lab: [0, 1, 1, 1, 1] },
    ]
    let cur = S[0]
    const apply = (i, instant) => {
      const s = (cur = S[i])
      const k = instant ? 0 : 1
      to(state, 'pF', s.p[0], 0.8 * k)
      to(state, 'pT', s.p[1], 0.8 * k)
      to(state, 'pS', s.p[2], 0.8 * k)
      // контуры видов проявляются (d — сколько листов уже «нарисовано»)
      ;[frontSheet, topSheet, sideSheet].forEach((sh, j) => {
        const v = s.d >= (j === 0 ? 1 : 3) ? 1 : 0
        sh.userData.mats.forEach((m, n) => to(m, 'opacity', v * [1, 0.95, 0.9][n], 1.2 * k))
      })
      to(state, 'unfold', s.unfold, 1.4 * k)
      to(partMat, 'opacity', s.part, 0.7 * k)
      to(edgeMat, 'opacity', s.part * 0.9, 0.7 * k)
      to(alignMat, 'opacity', s.align * 0.9, 0.8 * k)
      arF.visible = !!s.ar[0]
      arT.visible = !!s.ar[1]
      arS.visible = !!s.ar[2]
      ;[lPart, lMain, lTop, lSide, lHid].forEach((l, j) => l.show(!!s.lab[j]))
      stage.fit(s.box, { dir: s.cam, pad: s.box === FLAT ? 1.0 : 1.02, ms: instant ? 0 : 1100 })
    }

    stage.ready()
    return stage.controller({
      setStep: (i, o) => apply(i, o?.instant),
      resetView: () => stage.fit(cur.box, { dir: cur.cam, pad: cur.box === FLAT ? 1.0 : 1.02, ms: 700 }),
    })
  },
}
