// Общие детали для сцен группы «соединения и уплотнения» (_group_joints.js):
// тела вращения в разрезе (вырезана четверть, торцы среза — цветом среза),
// шариковый/роликовый подшипник, фазы анимации шага.
import { THREE, ease, clamp01 } from '../stage.js'

// фаза 0..1 на отрезке времени [a, b] с плавностью
export const ph = (t, a, b) => ease(clamp01((t - a) / (b - a)))
// «пила» 0..1 с периодом p
export const saw = (t, p) => ((t % p) + p) % p / p

// профиль [[r, y], ...] против часовой (r вправо, y вверх); точка с третьим элементом 1 — гладкая
// (не излом). Острые углы дублируются, чтобы у граней были чёткие нормали.
function profile(pts) {
  const out = []
  pts.forEach((p, i) => {
    const v = new THREE.Vector2(p[0], p[1])
    out.push(v)
    if (!p[2] && i > 0) out.push(v.clone())
  })
  out.push(out[0].clone())
  return out
}

// дуга окружности (центр cr, cy, радиус a) от угла t0 к t1 — гладкие точки
export function arc(cr, cy, a, t0, t1, n = 8) {
  const pts = []
  for (let i = 1; i < n; i++) {
    const t = t0 + ((t1 - t0) * i) / n
    pts.push([cr + a * Math.cos(t), cy + a * Math.sin(t), 1])
  }
  return pts
}

// тело вращения вокруг Y по профилю; cut — вырезать четверть, центр выреза под углом cutAt
// (угол φ: x = r·sinφ, z = r·cosφ; по умолчанию четверть смотрит на камеру из +x +z)
export function cutRing(pts, material, { seg = 64, cut = true, cutAt = Math.PI / 4, secMat } = {}) {
  const g = new THREE.Group()
  const prof = profile(pts)
  const start = cut ? cutAt + Math.PI / 4 : 0
  const len = cut ? Math.PI * 1.5 : Math.PI * 2
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, seg, start, len), material)
  g.add(body)
  g.userData.body = body
  g.userData.caps = []
  if (cut && secMat) {
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])))
    const capGeo = new THREE.ShapeGeometry(shape)
    for (const phi of [start, start + len]) {
      const cap = new THREE.Mesh(capGeo, secMat)
      cap.rotation.y = phi - Math.PI / 2
      g.add(cap)
      g.userData.caps.push(cap)
    }
  }
  return g
}

// материал среза (как на чертеже)
export const sectionMat = (stage) => stage.mat('mark', { color: stage.PALETTE.section, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.1 })

// ---------------------------------------------------------------
// Подшипник качения: отверстие R 1.0, наружный R 2.25, ширина 0.8, ось Y, центр в 0.
export const BRG = { ri: 1.0, ro: 2.25, h: 0.8, rp: 1.6, rb: 0.255, ci: 1.33, co: 1.87 }

export function ballBearing(stage, { cut = true, cutAt, secMat, mats = {}, n = 12, rollers = false } = {}) {
  const m = {
    inner: mats.inner || stage.mat('chrome'),
    outer: mats.outer || stage.mat('steel'),
    ball: mats.ball || stage.mat('chrome'),
    cage: mats.cage || stage.mat('brass'),
    shield: mats.shield || stage.mat('steelBlack'),
  }
  const o = { cut, cutAt, secMat }
  const g = new THREE.Group()
  const k = Math.asin(0.181 / 0.27)
  // внутреннее кольцо с желобом (дорожкой качения)
  const innerBall = cutRing(
    [[1.0, -0.34], [1.06, -0.4], [1.36, -0.4], [1.4, -0.36], [1.4, -0.181], ...arc(1.6, 0, 0.27, Math.PI + k, Math.PI - k), [1.4, 0.181], [1.4, 0.36], [1.36, 0.4], [1.06, 0.4], [1.0, 0.34]],
    m.inner, o,
  )
  const outerBall = cutRing(
    [[1.84, -0.4], [2.19, -0.4], [2.25, -0.34], [2.25, 0.34], [2.19, 0.4], [1.84, 0.4], [1.8, 0.36], [1.8, 0.181], ...arc(1.6, 0, 0.27, k, -k), [1.8, -0.181], [1.8, -0.36]],
    m.outer, o,
  )
  const inner = new THREE.Group()
  const outer = new THREE.Group()
  inner.add(innerBall)
  outer.add(outerBall)
  // роликовый вариант колец: внутреннее с бортами, наружное с гладкой дорожкой
  const innerRol = cutRing([[1.0, -0.34], [1.06, -0.4], [1.48, -0.4], [1.5, -0.38], [1.5, -0.3], [1.38, -0.3], [1.38, 0.3], [1.5, 0.3], [1.5, 0.38], [1.48, 0.4], [1.06, 0.4], [1.0, 0.34]], m.inner, o)
  const outerRol = cutRing([[1.86, -0.4], [2.19, -0.4], [2.25, -0.34], [2.25, 0.34], [2.19, 0.4], [1.86, 0.4], [1.82, 0.36], [1.82, -0.36]], m.outer, o)
  inner.add(innerRol)
  outer.add(outerRol)
  g.add(inner, outer)

  // тела качения
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(BRG.rb, 24, 16), m.ball, n)
  const nr = 14
  const rolls = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.215, 0.215, 0.56, 20), m.ball, nr)
  // сепаратор: тонкая лента по делительному диаметру, шарики «проходят» сквозь гнёзда
  const cage = new THREE.Group()
  cage.add(new THREE.Mesh(new THREE.LatheGeometry(profile([[1.575, -0.15], [1.625, -0.15], [1.625, 0.15], [1.575, 0.15]]), 64), m.cage))
  const rolCage = new THREE.Group()
  for (const y of [-0.32, 0.32]) {
    const r = new THREE.Mesh(new THREE.LatheGeometry(profile([[1.45, y - 0.025], [1.75, y - 0.025], [1.75, y + 0.025], [1.45, y + 0.025]]), 64), m.cage)
    rolCage.add(r)
  }
  g.add(balls, rolls, cage, rolCage)
  // защитные шайбы (закрытый подшипник) — стоят вместе с наружным кольцом
  const shields = new THREE.Group()
  for (const y of [-0.33, 0.33]) {
    const s = cutRing([[1.43, y - 0.025], [1.8, y - 0.025], [1.8, y + 0.025], [1.43, y + 0.025]], m.shield, o)
    shields.add(s)
  }
  outer.add(shields)

  // метки вращения: тело вращения в разрезе само «не видно», как крутится, поэтому
  // кольцо стоит, а крутятся риски на торце внутреннего кольца и на сепараторе
  const innerMark = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.3), mats.mark || stage.mat('mark'))
  innerMark.position.set(0, 0.405, 1.21)
  const innerSpin = new THREE.Group()
  innerSpin.add(innerMark)
  inner.add(innerSpin)
  const cageMark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.08), mats.mark || stage.mat('mark'))
  cageMark.position.set(0, 0.16, 1.6)
  cage.add(cageMark)

  const dummy = new THREE.Object3D()
  const st = { a: 0, cage: 0, roller: 0, explode: 0 }
  function update() {
    const isR = st.roller > 0.5
    innerBall.visible = outerBall.visible = cage.visible = balls.visible = !isR
    innerRol.visible = outerRol.visible = rolCage.visible = rolls.visible = isR
    const s = isR ? (st.roller - 0.5) * 2 : 1 - st.roller * 2
    const list = isR ? rolls : balls
    const cnt = isR ? nr : n
    for (let i = 0; i < cnt; i++) {
      const a = st.cage + (i / cnt) * Math.PI * 2
      dummy.position.set(BRG.rp * Math.sin(a), 0, BRG.rp * Math.cos(a))
      dummy.rotation.set(0, st.a * 2.6, 0)
      dummy.scale.setScalar(Math.max(0.001, s))
      dummy.updateMatrix()
      list.setMatrixAt(i, dummy.matrix)
    }
    list.instanceMatrix.needsUpdate = true
    cage.rotation.y = rolCage.rotation.y = st.cage
    cage.scale.setScalar(Math.max(0.001, s))
    rolCage.scale.setScalar(Math.max(0.001, s))
  }
  // a — угол внутреннего кольца (наружное стоит); сепаратор идёт медленнее: ci / (ci + co)
  function setAngle(a) {
    st.a = a
    innerSpin.rotation.y = a
    st.cage = (a * BRG.ci) / (BRG.ci + BRG.co)
    update()
  }
  function setRoller(v) {
    st.roller = v
    update()
  }
  setAngle(0)
  return { group: g, inner, outer, innerSpin, balls, rolls, cage, shields, setAngle, setRoller, mats: m }
}
