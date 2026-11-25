// Нарезание резьбы: сверло под резьбу и фаска, метчик в воротке строго перпендикулярно,
// «½ оборота вперёд — ¼ назад» со стружкой и маслом, готовая резьба в разрезе; плашка на стержне.
import { createStage, THREE, PALETTE, cylX, cylY, lathe } from '../stage.js'
import { holeBlock, drillGeo, radialGeo, threadFn, threadGeo, particles, smooth, lerpRange, clamp } from './fastenersKit.js'

const STEPS = [
  { title: 'Сверло под резьбу', text: 'Сначала сверлят отверстие сверлом под резьбу: диаметр резьбы минус шаг. Например, M10×1,5 → сверло 8,5 мм. Затем зенковкой снимают фаску — метчик легче заходит.' },
  { title: 'Метчик — строго перпендикулярно', text: 'Черновой метчик (№1) в воротке: слегка надавить и повернуть на 2–3 оборота. Проверить угольником с двух сторон. Пошёл криво — вывернуть и начать снова.' },
  { title: '½ оборота вперёд, ¼ назад', text: 'Дальше без нажима: пол-оборота вперёд, четверть назад — обратный ход ломает стружку, иначе метчик заклинит и сломается. Смазывать маслом, если ТК не требует иного.' },
  { title: 'Резьба готова', text: 'Пройти по порядку №1, №2, №3 и проверить резьбу калибром. Глухое отверстие сверлят глубже резьбы, а метчик в дно не упирают. Стружку вытряхивают (в очках).' },
  { title: 'Плашка: наружная резьба', text: 'Стержень чуть тоньше резьбы, на торце фаска. Плашку в плашкодержателе ставят строго перпендикулярно и крутят так же: ½ вперёд, ¼ назад, с маслом.' },
]

const TOP = 0
const R_MAJ = 0.5, P = 0.25, R_H = 0.37, R_C = 0.62
const DRILL_D = 1.75, THREAD_L = 1.3
const TAP_LEN = 1.6 // рабочая часть метчика
const TAU = Math.PI * 2

export default {
  title: 'Нарезание резьбы',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { fov: 30, position: [2.5, 3, 7], target: [0, 0.3, 0] })
    const { root } = stage

    // ---------------- деталь с отверстием (разрез)
    const part = new THREE.Group()
    root.add(part)
    const hb = holeBlock(stage, { W: 3, Dz: 2, H: 2.3, top: TOP, rH: R_H, rC: R_C, thread: { rMaj: R_MAJ, P, len: THREAD_L + 0.05 }, kind: 'iron' })
    part.add(hb.group)

    // сверло
    const drill = new THREE.Group()
    drill.add(stage.mesh(drillGeo({ r: R_H, len: 2.4, lead: 1.3 }), 'steelBlack'))
    const shank = stage.mesh(cylY(R_H, 0.8, 24), 'steelDark')
    shank.position.y = 2.8
    drill.add(shank)
    part.add(drill)
    // зенковка (конус 90°)
    const csink = new THREE.Group()
    csink.add(stage.mesh(lathe([[0, 0], [0.72, 0.72], [0.3, 0.9], [0.3, 2.0], [0, 2.0]], 32), 'steelDark'))
    part.add(csink)

    // метчик: резьба с заборным конусом и 4 канавками, хвостовик с квадратом
    const base = threadFn({ rMin: R_H - 0.03, rMaj: R_MAJ - 0.01, P })
    const tapFn = (th, y) => {
      let r = base(th, y)
      r = Math.min(r, R_H * 0.82 + y * 0.32) // заборная часть
      const ph = ((th / (Math.PI / 2)) % 1 + 1) % 1
      if (ph > 0.12 && ph < 0.38) r = Math.min(r, R_H * 0.62) // канавка
      return r
    }
    const tap = new THREE.Group()
    tap.add(stage.mesh(radialGeo(tapFn, 0, TAP_LEN, { rows: Math.round((TAP_LEN / P) * 8), cols: 48 }), 'steelBlack'))
    const tShank = stage.mesh(cylY(R_H * 0.85, 0.9, 24), 'steelBlack')
    tShank.position.y = TAP_LEN + 0.45
    const tSquare = stage.mesh(new THREE.BoxGeometry(0.42, 0.35, 0.42), 'steelBlack')
    tSquare.position.y = TAP_LEN + 1.0
    // риска номера на хвостовике
    const tRing = stage.mesh(cylY(R_H * 0.86, 0.05, 24), 'mark')
    tRing.position.y = TAP_LEN + 0.7
    tap.add(tShank, tSquare, tRing)
    // вороток
    const wrench = new THREE.Group()
    const wBody = stage.mesh(new THREE.BoxGeometry(0.7, 0.3, 0.55), 'steelDark')
    const wBar = stage.mesh(cylX(0.08, 3.2, 16), 'steelDark')
    const wGripL = stage.mesh(cylX(0.11, 0.8, 16), 'rubber')
    wGripL.position.x = -1.3
    const wGripR = wGripL.clone()
    wGripR.position.x = 1.3
    wrench.add(wBody, wBar, wGripL, wGripR)
    wrench.position.y = TAP_LEN + 1.0
    tap.add(wrench)
    part.add(tap)
    const tapArrow = new THREE.Group()
    part.add(tapArrow)

    // угольники (с двух сторон под 90° друг к другу)
    const squares = new THREE.Group()
    const mkSquare = (rotY) => {
      const g = new THREE.Group()
      const blade = stage.mesh(new THREE.BoxGeometry(0.05, 1.3, 0.22), 'chrome')
      blade.position.set(0, 0.65, 0)
      const foot = stage.mesh(new THREE.BoxGeometry(0.75, 0.16, 0.24), 'steelBlack')
      foot.position.set(0.4, 0.08, 0)
      g.add(blade, foot)
      const pv = new THREE.Group()
      g.position.x = R_MAJ + 0.03
      pv.add(g)
      pv.rotation.y = rotY
      squares.add(pv)
    }
    mkSquare(0)
    mkSquare(Math.PI / 2) // к −Z (на оставшейся половине детали)
    part.add(squares)

    // стружка и масло
    const chips = particles(stage, new THREE.TetrahedronGeometry(0.05), stage.mat('steel'), 50, { gravity: -5 })
    const oil = particles(stage, new THREE.SphereGeometry(0.04, 10, 8), stage.mat('oil', { emissive: '#4a3a10' }), 12, { gravity: -6 })
    root.add(chips.mesh, oil.mesh)
    const oiler = new THREE.Group()
    oiler.add(stage.mesh(lathe([[0, 0], [0.32, 0.05], [0.34, 0.45], [0.06, 0.6], [0.03, 1.1], [0, 1.12]], 24), stage.mat('oil', { color: '#8a7a50', metalness: 0.5 })))
    oiler.rotation.z = 2.2
    oiler.position.set(1.75, 1.35, -0.15)
    part.add(oiler)
    const NOZZLE = new THREE.Vector3(0.82, 0.73, -0.15)

    // ---------------- плашка на стержне в тисках
    const dieScene = new THREE.Group()
    dieScene.visible = false
    root.add(dieScene)
    const vise = new THREE.Group()
    for (const s of [-1, 1]) {
      const jaw = stage.mesh(new THREE.BoxGeometry(0.7, 0.8, 1.6), 'iron')
      jaw.position.set(s * (R_MAJ + 0.35), -1.6, 0)
      vise.add(jaw)
    }
    const viseBase = stage.mesh(new THREE.BoxGeometry(3.2, 0.5, 1.8), 'ironDark')
    viseBase.position.y = -2.25
    vise.add(viseBase)
    dieScene.add(vise)
    const ROD_TOP = 1.0, CUT_END = -0.75
    const upClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const dnClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
    const rodThread = stage.mesh(threadGeo({ rMin: R_MAJ - 0.13, rMaj: R_MAJ - 0.01, P, y0: -2.0, y1: ROD_TOP, fadeEnd: 0.14 }, { cols: 40 }), stage.mat('steel', { clippingPlanes: [upClip] }))
    const rodBlank = stage.mesh(lathe([[0, -2.0], [R_MAJ - 0.01, -2.0], [R_MAJ - 0.01, ROD_TOP - 0.1], [R_MAJ - 0.11, ROD_TOP], [0, ROD_TOP]], 40), stage.mat('steel', { clippingPlanes: [dnClip] }))
    dieScene.add(rodThread, rodBlank)
    const die = new THREE.Group()
    die.add(stage.mesh(lathe([[R_MAJ - 0.06, -0.18], [0.95, -0.18], [0.95, 0.18], [R_MAJ - 0.06, 0.18], [R_MAJ - 0.06, -0.18]], 40), 'steelBlack'))
    die.add(stage.mesh(lathe([[0.95, -0.2], [1.15, -0.2], [1.15, 0.2], [0.95, 0.2], [0.95, -0.2]], 40), 'steelDark'))
    const dBar = stage.mesh(cylX(0.08, 4.0, 16), 'steelDark')
    const dGripL = stage.mesh(cylX(0.11, 0.8, 16), 'rubber')
    dGripL.position.x = -1.65
    const dGripR = dGripL.clone()
    dGripR.position.x = 1.65
    die.add(dBar, dGripL, dGripR)
    dieScene.add(die)

    // подписи
    const L = {
      drill: stage.label('сверло ≈ d − P', drill, { offset: [0.4, 2.2, 0], side: 'right' }),
      cs: stage.label('фаска (зенковка)', new THREE.Vector3(-R_C, TOP, 0), { side: 'left' }),
      perp: stage.label('90° — проверить с двух сторон', new THREE.Vector3(R_MAJ + 0.5, 1.4, 0), { side: 'right', tone: 'accent' }),
      dir: stage.label('', new THREE.Vector3(-1.7, 0, 0), { side: 'left', tone: 'accent' }),
      oil: stage.label('масло', NOZZLE.clone().add(new THREE.Vector3(0.4, 0.3, 0)), { side: 'right' }),
      thread: stage.label('резьба', new THREE.Vector3(-R_MAJ, -0.6, 0), { side: 'left' }),
      blind: stage.label('запас: метчик в дно не упирать', new THREE.Vector3(0, -DRILL_D, 0), { side: 'bottom', tone: 'accent' }),
      gauge: stage.label('проверить калибром', new THREE.Vector3(R_C, 0.05, 0), { side: 'right' }),
      die: stage.label('плашка в плашкодержателе', die, { offset: [1.15, 0.2, 0], side: 'right' }),
      chamf: stage.label('фаска на торце', new THREE.Vector3(R_MAJ, ROD_TOP, 0), { side: 'right' }),
      dieDir: stage.label('', new THREE.Vector3(-2.2, 0.4, 0), { side: 'left', tone: 'accent' }),
    }
    const SHOW = [['drill', 'cs'], ['perp'], ['dir', 'oil'], ['thread', 'blind', 'gauge'], ['die', 'chamf', 'dieDir']]

    // «½ вперёд, ¼ назад»: угол (в оборотах) по времени
    const CYC = 1.0
    const ratchet = (time) => {
      const n = Math.floor(time / CYC), f = time - n * CYC
      const fwd = f < 0.6
      const turns = n * 0.25 + (fwd ? 0.5 * smooth(0, 0.6, f) : 0.5 - 0.25 * smooth(0.6, 1.0, f))
      return { turns, fwd }
    }
    const tapAt = (depth) => {
      tap.position.y = TOP - depth
      tap.rotation.y = -(depth / P) * TAU
    }

    let step = 0, t = 0, chipT = 0, oilT = 0
    const HOLD = [5.6, 5, 6, 4, 6]
    const v = new THREE.Vector3(), p = new THREE.Vector3()
    stage.onFrame((dt) => {
      if (stage.playing) t += dt
      part.visible = step <= 3
      dieScene.visible = step === 4
      drill.visible = csink.visible = tap.visible = squares.visible = oiler.visible = false
      let depth = DRILL_D, ch = 1, tapD = 0
      if (step === 0) {
        const k = t % 7
        // сверление с выводом сверла, затем фаска
        const feed = smooth(0.3, 1.5, k) * 0.55 + smooth(1.9, 3.2, k) * 0.45
        const out = k > 1.5 && k < 1.9 ? Math.sin(((k - 1.5) / 0.4) * Math.PI) * 0.9 : 0
        depth = DRILL_D * feed
        const retract = smooth(3.4, 3.9, k) * 3.2
        drill.visible = k < 3.95
        drill.position.y = TOP - depth + out + retract
        if (stage.playing) drill.rotation.y -= dt * 18
        ch = smooth(4.4, 5.4, k)
        csink.visible = k > 3.9
        csink.position.y = TOP - R_H + 0.0 - ch * (R_C - R_H) + (1 - smooth(3.9, 4.4, k)) * 1.4 + smooth(5.6, 6.2, k) * 2
        if (stage.playing) csink.rotation.y -= dt * 8
        if (stage.playing && depth > 0.02 && k < 3.3) spawnChips(dt, 7, R_H)
        L.cs.show(k > 4.4)
      } else if (step === 1) {
        const k = t % 7
        tap.visible = true
        const turns = 2.2 * smooth(0.6, 3.4, k)
        tapD = turns * P
        tapAt(tapD)
        if (k < 0.6) tap.position.y = TOP + 0.6 * (1 - k / 0.6)
        squares.visible = k > 3.6
        squares.position.y = (1 - smooth(3.6, 4.2, k)) * 1.2
        L.perp.show(k > 4.2)
        showTurn(k > 0.6 && k < 3.4, true)
      } else if (step === 2) {
        const k = t % 13
        tap.visible = oiler.visible = true
        const r = ratchet(Math.max(0, k - 0.4))
        tapD = Math.min(THREAD_L, 0.55 + r.turns * P)
        tapAt(tapD)
        L.dir.set(r.fwd ? '½ оборота вперёд' : '¼ назад — ломаем стружку')
        showTurn(true, r.fwd)
        if (stage.playing && !r.fwd) spawnChips(dt, 22, R_MAJ)
        oilT += stage.playing ? dt : 0
        if (stage.playing && oilT > 2.2) {
          oilT = 0
          oil.spawn(NOZZLE, v.set(-0.4, -0.2, 0.05), { life: 0.9, spin: 0 })
        }
      } else if (step === 3) {
        const k = t % 6
        tap.visible = k < 2.6
        tapD = THREAD_L
        const up = smooth(0.3, 2.4, k) * (THREAD_L + 0.2)
        tapAt(THREAD_L - up)
        tap.position.y = TOP - THREAD_L + up + smooth(2.0, 2.6, k) * 1.5
        showTurn(k > 0.3 && k < 2.4, false)
        L.thread.show(k > 2.4)
        L.blind.show(k > 2.4)
        L.gauge.show(k > 2.4)
      }
      if (step <= 3) hb.set({ depth, chamfer: ch, tap: step === 3 ? THREAD_L : tapD })
      if (step === 4) {
        const k = t % 13
        const r = ratchet(Math.max(0, k - 0.6))
        const lead = 0.15 // плашка заходит на фаску
        const d = Math.min(ROD_TOP - CUT_END, lead + r.turns * P)
        const dieY = ROD_TOP - d + (k < 0.6 ? (1 - k / 0.6) * 0.8 : 0)
        die.position.y = dieY
        die.rotation.y = -(d / P) * TAU
        upClip.constant = -dieY
        dnClip.constant = dieY
        L.dieDir.set(r.fwd ? '½ вперёд' : '¼ назад')
      }
      chips.update(dt, -0.02 + (step <= 3 ? TOP : -99))
      oil.update(dt, TOP)
    })
    // кольцевая стрелка вращения на воротке
    let arrowFwd = null, arrowBack = null
    const makeArrows = () => {
      const mk = (a0, a1, c) => {
        const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        const pts = []
        for (let i = 0; i <= 20; i++) {
          const a = a0 + ((a1 - a0) * i) / 20
          pts.push(new THREE.Vector3(1.0 * Math.cos(a), 0, -1.0 * Math.sin(a)))
        }
        const g = new THREE.Group()
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.03, 6), m))
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 12), m)
        const s = Math.sign(a1 - a0)
        const tan = new THREE.Vector3(-Math.sin(a1) * s, 0, -Math.cos(a1) * s)
        cone.position.copy(pts[20]).addScaledVector(tan, 0.08)
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan)
        g.add(cone)
        return g
      }
      arrowFwd = mk(0.4, -1.5, PALETTE.ok)
      arrowBack = mk(-1.5, -0.6, PALETTE.bad)
      tapArrow.add(arrowFwd, arrowBack)
    }
    makeArrows()
    function showTurn(on, fwd) {
      tapArrow.visible = on
      arrowFwd.visible = fwd
      arrowBack.visible = !fwd
      tapArrow.position.y = tap.position.y + TAP_LEN + 1.0 + 0.3
    }
    function spawnChips(dt, rate, r) {
      chipT += dt * rate
      while (chipT > 1) {
        chipT -= 1
        const a = Math.random() * Math.PI - Math.PI // задняя половина (видна в разрезе)
        p.set(Math.cos(a) * r, TOP + 0.04, Math.sin(a) * r * 0.6)
        v.set(Math.cos(a) * (0.6 + Math.random()), 1.2 + Math.random() * 1.2, Math.sin(a) * 0.4 + 0.3)
        chips.spawn(p, v, { life: 1.4, size: 0.6 + Math.random() * 0.8 })
      }
    }

    const boxHole = new THREE.Box3(new THREE.Vector3(-1.6, -2.3, -1), new THREE.Vector3(1.6, 1.1, 1))
    const boxTap = new THREE.Box3(new THREE.Vector3(-1.7, -2.0, -1), new THREE.Vector3(1.9, 2.9, 1))
    const boxDie = new THREE.Box3(new THREE.Vector3(-2.2, -2.5, -1), new THREE.Vector3(2.2, 1.6, 1))
    const apply = (i, instant) => {
      step = i
      t = stage.playing ? 0 : HOLD[i]
      chips.clear()
      oil.clear()
      tapArrow.visible = false
      for (const [n, l] of Object.entries(L)) l.show(SHOW[i].includes(n))
      const box = i === 0 || i === 3 ? boxHole : i === 4 ? boxDie : boxTap
      stage.fit(box, { dir: [0.35, 0.45, 1], pad: 0.8, ms: instant ? 0 : 900 })
      if (instant) stage.setHome()
    }
    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
