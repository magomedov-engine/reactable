// Болт: головка, гладкая часть, резьба по винтовой линии, шаг, класс прочности, шайба и гайка.
// Болт лежит вдоль X (локальная ось Y группы → мировая X). Резьба правая: гайка за оборот проходит один шаг.
import { createStage, animator, THREE, PALETTE, ringY } from '../stage.js'
import { threadGeo, hexGeo, canvasTex, radialGeo, clamp, smooth } from './fastenersKit.js'

const STEPS = [
  { title: 'Из чего состоит болт', text: 'Головка под ключ (размер S — между гранями), гладкая часть стержня и резьба. Длину болта обычно считают без головки.' },
  { title: 'Шаг резьбы', text: 'Шаг P — расстояние между соседними витками. М12×1,5: диаметр 12 мм, шаг 1,5 мм. Шаг не указан — значит крупный. Перепутаете шаг — резьба не пойдёт и сорвётся.' },
  { title: 'Класс прочности', text: 'На головке выбита маркировка, например «10.9»: 10 × 100 = 1000 МПа на разрыв, предел текучести 0,9 от этого — 900 МПа. Ставить болт другого класса «потому что похож» нельзя.' },
  { title: 'Шайба и гайка', text: 'Шайба распределяет нагрузку и бережёт поверхность. Резьба — винтовая линия: за один оборот гайка проходит ровно один шаг.' },
  { title: 'Зачем затягивают', text: 'Затянутый болт чуть растягивается, как очень жёсткая пружина, и прижимает детали друг к другу. Сколько тянуть — момент по ТК.' },
]

// размеры (условные единицы; диаметр стержня = 1)
const R = 0.5, P = 0.2, R_MIN = R - 0.12
const HEAD_H = 0.62, S = 1.5
const TH0 = 1.6, TH1 = 4.0 // резьба
const PL = 1.7 // толщина пакета деталей
const WASH = 0.12, NUT_H = 0.8
const NUT_END = PL + WASH + NUT_H / 2 // центр гайки в затянутом положении
const NUT_START = TH1 + NUT_H / 2 + 0.6

export default {
  title: 'Болт, шайба и гайка',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { fov: 30, position: [0.8, 1.6, 6.5], target: [0, 0, 0] })
    const to = animator(stage)
    const { root } = stage
    const textures = []

    // всё строим в группе с осью болта по Y, затем кладём вдоль X
    const axis = new THREE.Group()
    axis.rotation.z = -Math.PI / 2
    axis.position.x = -1.6
    root.add(axis)
    const spin = new THREE.Group() // вращение болта вокруг своей оси (шаг 1)
    axis.add(spin)

    const head = stage.mesh(hexGeo(S, HEAD_H), 'steelDark')
    head.position.y = -HEAD_H / 2
    const shank = stage.mesh(radialGeo((th, y) => (y < 0.06 ? R + 0.05 - y * 0.8 : R), 0, TH0 + 0.02, { rows: 6, cols: 40, capStart: false, capEnd: false }), 'steel')
    const thread = stage.mesh(threadGeo({ rMin: R_MIN, rMaj: R, P, y0: TH0, y1: TH1, fadeStart: 0.25, fadeEnd: 0.16 }, { cols: 40 }), 'steel')
    // торец головки с маркировкой
    const markTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = PALETTE.steelDark
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#2a2a2c'
      g.font = '700 92px Inter, Arial, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('10.9', w / 2, h / 2 + 4)
      g.font = '600 34px Inter, Arial, sans-serif'
      g.fillText('ABC', w / 2, h / 2 - 72)
    })
    textures.push(markTex)
    const face = new THREE.Mesh(new THREE.CircleGeometry(S * 0.47, 40).rotateX(Math.PI / 2).rotateY(-Math.PI / 2), stage.mat('steelDark', { map: markTex, color: '#ffffff', metalness: 0.55, roughness: 0.45 }))
    face.position.y = -HEAD_H - 0.002
    spin.add(head, shank, thread, face)

    // пакет деталей в разрезе (видна только задняя половина, срез — цветом сечения)
    const plates = new THREE.Group()
    const halfPlate = (y0, y1, kind) => {
      const sh = new THREE.Shape()
      const A = 1.25, H0 = R + 0.06
      sh.moveTo(-A, 0)
      sh.lineTo(-H0, 0)
      sh.absarc(0, 0, H0, Math.PI, 0, true)
      sh.lineTo(A, 0)
      sh.lineTo(A, -A)
      sh.lineTo(-A, -A)
      sh.closePath()
      const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 20 })
      g.rotateX(Math.PI / 2) // контур в XZ (z ≤ 0), толщина вниз
      g.translate(0, y1, 0)
      const m = stage.mesh(g, kind)
      const cut = stage.mat('mark', { color: PALETTE.section, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide })
      for (const s of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(A - H0, y1 - y0), cut)
        c.position.set((s * (A + H0)) / 2, (y0 + y1) / 2, 0.003)
        m.add(c)
      }
      plates.add(m)
    }
    halfPlate(0, 0.8, 'iron')
    halfPlate(0.8, PL, 'ironDark')
    axis.add(plates)

    const washer = stage.mesh(ringY(R + 0.06, 0.95, WASH, 48), 'chrome')
    axis.add(washer)
    const nut = stage.mesh(hexGeo(S, NUT_H, R_MIN + 0.03), 'steelDark')
    axis.add(nut)

    // шаг: две риски на вершинах соседних витков сверху и размерная линия
    const pitch = new THREE.Group()
    const yc = (k) => P * (k + 0.25) // вершина витка сверху (θ = -π/2)
    const k0 = 15
    for (const k of [k0, k0 + 1]) {
      const tick = stage.mesh(new THREE.BoxGeometry(0.42, 0.014, 0.014), 'mark')
      tick.position.set(-(R + 0.2), yc(k), 0)
      pitch.add(tick)
    }
    const dim = stage.mesh(new THREE.BoxGeometry(0.014, P, 0.014), 'mark')
    dim.position.set(-(R + 0.36), (yc(k0) + yc(k0 + 1)) / 2, 0)
    pitch.add(dim)
    axis.add(pitch)

    // стрелки сжатия пакета и растяжения болта
    const arrows = new THREE.Group()
    const aw = (x0, x1, y, c) => arrows.add(stage.arrow(new THREE.Vector3(x0, y, 0), new THREE.Vector3(x1, y, 0), c, { head: 0.18, width: 0.14 }))
    aw(-2.35, -1.66, 1.05, PALETTE.ok)
    aw(0.85, 0.16, 1.05, PALETTE.ok)
    aw(-2.3, -2.95, 0, PALETTE.milk)
    aw(2.5, 3.15, 0, PALETTE.milk)
    root.add(arrows)

    // подписи
    const lHead = stage.label('Головка: под ключ S', new THREE.Vector3(-1.6 - HEAD_H / 2, 0.85, 0), { side: 'top' })
    const lShank = stage.label('Гладкая часть', new THREE.Vector3(-0.8, -0.55, 0), { side: 'bottom' })
    const lThread = stage.label('Резьба', new THREE.Vector3(1.2, -0.55, 0), { side: 'bottom' })
    const lPitch = stage.label('шаг P', dim, { offset: [-0.06, 0, 0], side: 'top', tone: 'accent' })
    const lClass = stage.label('10.9 — класс прочности', new THREE.Vector3(-1.6 - HEAD_H, -0.85, 0), { side: 'bottom', tone: 'accent' })
    const lTurn = stage.label('', nut, { offset: [-0.95, 0, 0], side: 'top', tone: 'accent' })
    const lClamp = stage.label('детали прижаты', new THREE.Vector3(-0.3, 1.25, 0), { side: 'top', tone: 'ok' })
    const lStretch = stage.label('болт чуть растянут', new THREE.Vector3(0.3, -1.1, 0), { side: 'bottom' })
    const all = [lHead, lShank, lThread, lPitch, lClass, lTurn, lClamp, lStretch]

    // камера по шагам
    const boxAll = new THREE.Box3(new THREE.Vector3(-2.4, -1.0, -0.8), new THREE.Vector3(3.0, 1.1, 0.8))
    const boxThread = new THREE.Box3(new THREE.Vector3(0.2, -0.75, -0.6), new THREE.Vector3(2.6, 1.0, 0.6))
    const boxHead = new THREE.Box3(new THREE.Vector3(-2.4, -0.9, -0.9), new THREE.Vector3(-1.3, 0.9, 0.9))
    const boxBolt = new THREE.Box3(new THREE.Vector3(-2.3, -0.8, -0.5), new THREE.Vector3(2.5, 0.8, 0.5))
    const VIEW = [
      { box: boxBolt, dir: [0.12, 0.25, 1], pad: 0.8 },
      { box: boxThread, dir: [0.05, 0.3, 1], pad: 0.8 },
      { box: boxHead, dir: [-1, 0.22, 0.5], pad: 1.0 },
      { box: boxAll, dir: [0.25, 0.4, 1], pad: 0.8 },
      { box: boxAll, dir: [0.12, 0.3, 1], pad: 0.8 },
    ]
    const st = { plates: 0, washer: 0, arrows: 0, pitch: 0 }
    let step = 0, t = 0
    const HOLD = [0, 0, 0, 7.5, 1]

    // гайка: φ — поворот вокруг оси болта; затяжка — по часовой (φ < 0), за оборот −P
    const nutPose = (k) => {
      // k: 0 — гайка в стороне, 1 — затянута
      const approach = smooth(0, 0.18, k)
      const yEngage = TH1 + NUT_H / 2 - 0.05
      const turns = (yEngage - NUT_END) / P
      const s = smooth(0.18, 1, k)
      const y = approach < 1 ? NUT_START + (yEngage - NUT_START) * approach : yEngage + (NUT_END - yEngage) * s
      nut.position.y = y
      nut.rotation.y = -(approach < 1 ? 0 : turns * s * Math.PI * 2)
      return { turns: turns * s, s }
    }

    stage.onFrame((dt) => {
      if (stage.playing) t += dt
      spin.rotation.y = step === 0 && stage.playing ? spin.rotation.y - dt * 0.6 : spin.rotation.y
      plates.visible = st.plates > 0.02
      plates.position.x = (1 - st.plates) * 3.5 // въезжают снизу
      washer.visible = st.washer > 0.02
      washer.position.y = PL + WASH / 2 + (1 - st.washer) * 3.2
      arrows.visible = st.arrows > 0.5
      pitch.visible = st.pitch > 0.5
      if (step === 3) {
        const k = clamp((t % 9) / 7.5, 0, 1)
        const { turns, s } = nutPose(k)
        const n = Math.floor(turns + 1e-6)
        lTurn.set(s <= 0 ? 'навинчиваем по часовой' : `${n} об. = ${n} × шаг`).show(true)
      } else if (step === 4) {
        nutPose(1)
        const pulse = 0.5 + 0.5 * Math.sin(t * 4)
        arrows.children.forEach((a, i) => (a.scale.setScalar(i < 2 ? 0.85 + 0.15 * pulse : 1)))
      } else nutPose(0)
      nut.visible = step >= 3
    })

    const apply = (i, instant) => {
      step = i
      t = stage.playing ? 0 : HOLD[i]
      const d = instant ? 0 : 0.7
      to(st, 'plates', i >= 3 ? 1 : 0, d)
      to(st, 'washer', i >= 3 ? 1 : 0, instant ? 0 : 1.0)
      st.arrows = i === 4 ? 1 : 0
      st.pitch = i === 1 ? 1 : 0
      if (i !== 0) to(spin.rotation, 'y', 0, d)
      const vis = [
        [lHead, lShank, lThread],
        [lPitch, lThread],
        [lClass],
        [lTurn],
        [lClamp, lStretch],
      ][i]
      all.forEach((l) => l.show(vis.includes(l)))
      const v = VIEW[i]
      stage.fit(v.box, { dir: v.dir, pad: v.pad, ms: instant ? 0 : 900 })
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
