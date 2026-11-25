// Термостат: восковой элемент открывает клапан при прогреве, жидкость переходит с малого круга на большой (через радиатор).
// Контур упрощён: насос → рубашка двигателя → термостат → (малый круг → насос) / (радиатор → насос).
import { createStage, animator, THREE, PALETTE, cylY, cylZ, clamp01, lerp } from '../stage.js'
import { cutLathe, polyPath, flow, springGeo, gauge, stepClock } from './es-kit.js'

const STEPS = [
  { title: 'Где стоит термостат', text: 'Насос гонит охлаждающую жидкость через рубашку двигателя. На выходе стоит термостат: он решает, куда ей идти дальше — сразу обратно к насосу или через радиатор.' },
  { title: 'Что внутри', text: 'Клапан прижат пружиной к седлу. Под ним латунная капсула с воском. Воск при нагреве плавится и расширяется, выдавливает шток — капсула с клапаном уходит вниз, проход к радиатору открывается.' },
  { title: 'Холодный: малый круг', text: 'Пока двигатель холодный, клапан закрыт. Жидкость идёт по малому кругу — мимо радиатора, прямо к насосу. Так двигатель прогревается быстрее.' },
  { title: 'Прогрев: клапан открывается', text: 'Жидкость нагрелась до температуры открытия (она указана в паспорте термостата, обычно на корпусе). Воск расширяется, клапан плавно открывается.' },
  { title: 'Горячий: большой круг', text: 'Клапан открыт: основной поток идёт через радиатор, там тепло уходит в воздух, и остывшая жидкость возвращается к насосу.' },
  { title: 'Если термостат заклинил', text: 'Закрытым — радиатор не работает, двигатель перегревается. Открытым — двигатель долго греется и работает холодным. При сборке: ставить правильной стороной (капсулой к двигателю) и с новой прокладкой.' },
]

const FAR = { p: [1.0, 1.4, 12.5], t: [0.2, -0.45, 0] }
const NEAR = { p: [1.3, 0.9, 4.6], t: [0, 0.4, 0] }
const MID = { p: [1.2, 1.0, 7.2], t: [0.4, -0.2, 0] }
const VIEWS = [FAR, NEAR, FAR, MID, FAR, FAR]

export default {
  title: 'Термостат: малый и большой круг',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: FAR.p, target: FAR.t, fov: 30 })
    const to = animator(stage)
    const clock = stepClock(stage)
    const { root } = stage

    // ---- двигатель, насос, радиатор (упрощённо)
    const engine = stage.mesh(new THREE.BoxGeometry(2.6, 1.1, 1.0), 'ironDark', { color: '#55534e' })
    engine.position.set(0, -1.7, 0)
    root.add(engine)
    const pump = new THREE.Group()
    pump.add(stage.mesh(cylZ(0.42, 0.5, 28), 'iron'))
    const pulley = stage.mesh(cylZ(0.3, 0.12, 28), 'steelDark')
    pulley.position.z = 0.32
    pump.add(pulley)
    pump.position.set(-2.8, -1.7, 0)
    root.add(pump)

    const rad = new THREE.Group()
    rad.add(stage.mesh(new THREE.BoxGeometry(0.3, 2.3, 1.3), 'ironDark'))
    const finMat = stage.mat('steelDark')
    for (let i = 0; i < 13; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 1.36), finMat)
      f.position.y = -1.05 + i * 0.175
      rad.add(f)
    }
    for (const y of [1.3, -1.3]) {
      const tank = stage.mesh(new THREE.BoxGeometry(0.5, 0.3, 1.45), 'iron')
      tank.position.y = y
      rad.add(tank)
    }
    rad.position.set(3.0, 0, 0)
    root.add(rad)
    const radHeat = stage.mat('bad', { transparent: true, opacity: 0, emissive: PALETTE.bad, emissiveIntensity: 0.4, depthWrite: false })
    const radGlow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.3, 1.4), radHeat)
    rad.add(radGlow)

    // ---- трубы (полупрозрачные, чтобы был виден поток)
    const pipeMat = stage.mat('water', { transparent: true, opacity: 0.2, depthWrite: false })
    const pipe = (pts, r = 0.1) => {
      const path = polyPath(pts)
      for (const c of path.curves) {
        const a = c.v1, b = c.v2
        const m = new THREE.Mesh(cylY(r, a.distanceTo(b) + r * 2, 14), pipeMat)
        m.position.copy(a).add(b).multiplyScalar(0.5)
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
        root.add(m)
      }
      return path
    }
    const P_MAIN = [[-2.38, -1.7, 0], [0, -1.7, 0], [0, -0.3, 0]]
    const P_SMALL = [[-0.45, 0.1, 0], [-2.8, 0.1, 0], [-2.8, -1.28, 0]]
    const P_TORAD = [[0, 1.0, 0], [0, 1.85, 0], [3.0, 1.85, 0], [3.0, 1.1, 0]]
    const P_FROMRAD = [[3.0, -1.1, 0], [3.0, -2.7, 0], [-2.8, -2.7, 0], [-2.8, -2.12, 0]]
    // трубы рисуем только снаружи узлов
    pipe([[-2.38, -1.7, 0], [-1.3, -1.7, 0]])
    pipe([[0, -1.15, 0], [0, -0.3, 0]])
    pipe([[-0.5, 0.1, 0], [-2.8, 0.1, 0], [-2.8, -1.28, 0]])
    pipe([[0, 1.3, 0], [0, 1.85, 0], [3.0, 1.85, 0], [3.0, 1.45, 0]])
    pipe([[3.0, -1.45, 0], [3.0, -2.7, 0], [-2.8, -2.7, 0], [-2.8, -2.12, 0]])

    // ---- термостат в корпусе (разрез)
    const T = new THREE.Group()
    T.position.set(0, 0, 0)
    root.add(T)
    const housing = cutLathe(stage, [
      [0.16, -0.32], [0.22, -0.32], [0.22, -0.25], [0.55, -0.2], [0.55, 0.78], [0.3, 0.8], [0.22, 0.86], [0.22, 1.3],
      [0.16, 1.3], [0.16, 0.86], [0.26, 0.78], [0.49, 0.74], [0.49, -0.14], [0.16, -0.22],
    ], 'iron', { seg: 40 })
    T.add(housing)

    // неподвижная рамка: верхняя перемычка со штоком и нижняя перемычка (опора пружины)
    const frameMat = stage.mat('steelDark')
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.08), frameMat)
    topBar.position.y = 0.98
    T.add(topBar)
    const pin = stage.mesh(cylY(0.035, 0.525, 12), 'chrome')
    pin.position.y = 0.7175
    T.add(pin)
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.05, 0.14), frameMat)
    bridge.position.y = -0.18
    T.add(bridge)

    // подвижная часть: клапан + капсула с воском
    const mov = new THREE.Group()
    T.add(mov)
    const valve = stage.mesh(cylY(0.32, 0.05, 40), 'steel')
    valve.position.y = 0.745
    mov.add(valve)
    const capsule = cutLathe(stage, [[0.11, 0.12], [0.15, 0.12], [0.15, 0.7], [0.04, 0.7], [0.04, 0.66], [0.11, 0.66]], 'brass')
    mov.add(capsule)
    const waxMat = stage.mat('milk', { color: '#d9cfb8', emissive: '#c9a24a', emissiveIntensity: 0 })
    const wax = new THREE.Mesh(cylY(0.105, 1, 24).translate(0, 0.5, 0), waxMat)
    wax.position.y = 0.125
    mov.add(wax)
    const spring = stage.mesh(springGeo(0.26, 0.022, 1, 6), 'steelBlack')
    T.add(spring)

    // ---- термометр
    const therm = gauge(stage, { h: 1.5, r: 0.06, color: PALETTE.water })
    therm.position.set(1.55, -0.95, 0.5)
    root.add(therm)

    // ---- потоки
    const cCold = new THREE.Color('#9cc3e0'), cHot = new THREE.Color('#ec8a70')
    const fMain = flow(stage, polyPath(P_MAIN), { n: 22, size: 0.24, speed: 1.0 })
    const fSmall = flow(stage, polyPath(P_SMALL), { n: 22, size: 0.24, speed: 1.0 })
    const fToRad = flow(stage, polyPath(P_TORAD), { n: 28, size: 0.24, speed: 1.0 })
    const fFromRad = flow(stage, polyPath(P_FROMRAD), { n: 34, size: 0.24, speed: 1.0, color: PALETTE.water })

    // ---- подписи
    const L = {
      engine: stage.label('Двигатель (рубашка)', engine, { offset: [0, -0.55, 0.5], side: 'bottom' }),
      pump: stage.label('Насос', pump, { offset: [-0.42, 0, 0], side: 'left' }),
      rad: stage.label('Радиатор', rad, { offset: [0.25, 0.4, 0], side: 'right' }),
      th: stage.label('Термостат', T, { offset: [0.55, 0.4, 0], side: 'right' }),
      valve: stage.label('Клапан', valve, { offset: [0.32, 0, 0], side: 'right' }),
      wax: stage.label('Капсула с воском', mov, { offset: [-0.15, 0.3, 0], side: 'left' }),
      spring: stage.label('Пружина', spring, { offset: [0.26, -0.5, 0], side: 'right' }),
      small: stage.label('Малый круг', new THREE.Vector3(-1.7, 0.1, 0), { side: 'top', tone: 'accent' }),
      big: stage.label('Большой круг', new THREE.Vector3(1.5, 1.85, 0), { side: 'top', tone: 'accent' }),
      temp: stage.label('', therm, { offset: [0.12, 1.6, 0], side: 'right' }),
      warn: stage.label('', new THREE.Vector3(0.2, 2.25, 0), { side: 'top', tone: 'warn' }),
    }

    const S = { step: 0, temp: 0.3, open: 0, stuck: -1, osc: 0, faint: 1 }
    const TRAVEL = 0.24
    const cTmp = new THREE.Color()

    stage.onFrame((dt, t) => {
      // шаг 1: клапан «дышит», чтобы было видно механику
      if (S.osc > 0.01) S.temp = lerp(S.temp, 0.6 + 0.3 * Math.sin(t * 1.3), S.osc)
      // шаг 3: плавный прогрев
      if (S.step === 3) S.temp = 0.25 + 0.67 * clamp01((clock.t - 0.8) / 5)
      // шаг 5: два случая по очереди
      if (S.step === 5) {
        const k = (clock.t % 9) / 9
        const caseA = k < 0.5
        const kk = caseA ? k / 0.5 : (k - 0.5) / 0.5
        S.stuck = caseA ? 0 : 1
        S.temp = caseA ? 0.55 + 0.45 * clamp01(kk * 1.4) : 0.4 - 0.1 * clamp01(kk * 2)
        L.warn.set(caseA ? 'Заклинил закрытым → перегрев' : 'Заклинил открытым → двигатель холодный')
      }
      const want = S.stuck >= 0 ? S.stuck : clamp01((S.temp - 0.55) / 0.25)
      S.open += (want - S.open) * Math.min(1, dt * 3)
      const o = S.open
      mov.position.y = -o * TRAVEL
      // пружина: от клапана (снизу 0.72) до перемычки (-0.155)
      const top = 0.72 - o * TRAVEL
      spring.position.y = top
      spring.scale.y = top + 0.155
      // воск: верх у кончика штока (0.455 мир), низ — дно капсулы
      // в координатах капсулы кончик штока «поднимается»: воска становится больше
      wax.scale.y = Math.max(0.01, 0.455 + o * TRAVEL - 0.125)
      waxMat.emissiveIntensity = 0.5 * o
      waxMat.color.set(o > 0.5 ? '#d6b57a' : '#d9cfb8')
      // температура и цвет жидкости
      cTmp.copy(cCold).lerp(cHot, clamp01(S.temp))
      therm.set(0.15 + 0.85 * clamp01(S.temp))
      therm.userData.fillMat.color.copy(cTmp)
      therm.userData.fillMat.emissive.copy(cTmp)
      fMain.mat.color.copy(cTmp)
      fSmall.mat.color.copy(cTmp)
      fToRad.mat.color.copy(cTmp)
      fFromRad.mat.color.copy(cCold).lerp(cHot, clamp01(S.temp) * 0.35)
      fMain.amount = 1
      fSmall.amount = 1 - 0.75 * o
      fToRad.amount = o
      fFromRad.amount = o
      for (const f of [fMain, fSmall, fToRad, fFromRad]) f.opacity = S.faint
      radHeat.opacity = 0.35 * o * clamp01(S.temp)
      L.temp.set(S.temp < 0.5 ? 'Холодный' : S.temp < 0.78 ? 'Прогревается' : S.temp < 0.97 ? 'Горячий' : 'Перегрев!')
      L.temp.tone(S.temp >= 0.97 ? 'warn' : '')
    })

    const apply = (i, instant) => {
      S.step = i
      clock.reset(instant ? 20 : 0)
      const v = VIEWS[i]
      if (instant) {
        stage.camera.position.set(...v.p)
        stage.controls.target.set(...v.t)
      } else stage.flyTo(v.p, v.t, 900)
      const d = instant ? 0 : 0.9
      S.stuck = -1
      to(S, 'osc', i === 1 ? 1 : 0, d)
      to(S, 'faint', i === 1 ? 0.35 : 1, d)
      if (i === 0 || i === 2) to(S, 'temp', 0.25, d)
      if (i === 4) to(S, 'temp', 0.92, d)
      const show = {
        0: ['engine', 'pump', 'rad', 'th'],
        1: ['valve', 'wax', 'spring'],
        2: ['small', 'temp', 'th'],
        3: ['valve', 'temp', 'big'],
        4: ['big', 'rad', 'temp'],
        5: ['warn', 'temp'],
      }[i]
      for (const k in L) L[k].show(show.includes(k))
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
