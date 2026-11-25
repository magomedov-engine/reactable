// Монтаж подшипника: на вал — давят только на внутреннее кольцо (оправка-втулка),
// удар по наружному кольцу — сила через шарики, вмятины; посадка с нагревом; в корпус — через наружное.
import { createStage, THREE, PALETTE } from '../stage.js'
import { ballBearing, cutRing, sectionMat, ph, saw } from './joints-kit.js'

const STEPS = [
  { title: 'Подготовка', text: 'Внутреннее кольцо садится на вал с натягом. Проверьте номер подшипника по ТК, вал чистый, без забоин, фаска на месте. Подшипник достают из упаковки прямо перед установкой.' },
  { title: 'Неправильно: удар по наружному', text: 'Бьют по наружному кольцу — сила идёт через шарики. Они продавливают на дорожках вмятины, кольцо садится с перекосом. Снаружи не видно, но подшипник загудит и быстро выйдет из строя.' },
  { title: 'Правильно: оправка-втулка', text: 'Оправка ложится только на внутреннее кольцо, по всей окружности. Пресс давит ровно, без перекоса, до упора в буртик. Сила через шарики не идёт.' },
  { title: 'С нагревом (если так в ТК)', text: 'Подшипник греют индукционным нагревателем до температуры по ТК. Открытым пламенем нельзя. Горячий подшипник сразу надевают до упора, в перчатках, и держат, пока не остынет.' },
  { title: 'В корпус — через наружное', text: 'В корпус с натягом садится наружное кольцо, значит оправка давит на наружное кольцо. Правило одно: давить только на то кольцо, которое садится.' },
  { title: 'Проверка', text: 'Подшипник сидит до упора, без зазора у буртика. Провернуть рукой: вращение лёгкое, ровное, без заеданий и хруста. Сжатым воздухом не раскручивать.' },
]

const BOX = (x0, y0, x1, y1) => new THREE.Box3(new THREE.Vector3(x0, y0, -2.4), new THREE.Vector3(x1, y1, 2.4))
const FRAMES = [BOX(-2.4, -1.4, 2.4, 3.4), BOX(-5, -1.4, 2.4, 3.2), BOX(-2.4, -1.4, 2.4, 5.0), BOX(-6.6, -1.6, 2.4, 3.6), BOX(-3.4, -0.8, 3.4, 4.6), BOX(-2.4, -1.4, 2.4, 2.4)]

export default {
  title: 'Монтаж подшипника',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [5.4, 4.2, 6.2], target: [0, 1, 0], fov: 30, fit: FRAMES[0], pad: 1.0 })
    const { root } = stage
    const sec = sectionMat(stage)
    const glow = new THREE.Color('#ff6a2a')
    const red = new THREE.Color(PALETTE.bad)

    // материалы колец свои — чтобы «греть» и «подсвечивать» только их
    const mats = { inner: stage.mat('chrome', {}), outer: stage.mat('steel', {}), ball: stage.mat('chrome', {}) }
    const brg = ballBearing(stage, { secMat: sec, mats })
    brg.shields.visible = false
    const bearing = new THREE.Group()
    bearing.add(brg.group)
    root.add(bearing)

    // вал с буртиком
    const shaft = cutRing([[0.01, -1.4], [1.3, -1.4], [1.3, 0], [1.0, 0], [1.0, 1.48], [0.88, 1.6], [0.01, 1.6]], stage.mat('steelDark'), { cut: false, seg: 48 })
    root.add(shaft)

    // оправка-втулка на внутреннее кольцо (в разрезе) и на наружное
    const sleeveIn = cutRing([[1.06, 0], [1.34, 0], [1.34, 2.0], [1.6, 2.0], [1.6, 2.18], [0.01, 2.18], [0.01, 2.0], [1.06, 2.0]], stage.mat('brass'), { secMat: sec })
    const sleeveOut = cutRing([[1.86, 0], [2.2, 0], [2.2, 1.6], [2.5, 1.6], [2.5, 1.78], [1.86, 1.78]], stage.mat('brass'), { secMat: sec })
    root.add(sleeveIn, sleeveOut)
    const press = stage.arrow(new THREE.Vector3(0, 4.6, 0), new THREE.Vector3(0, 3.0, 0), PALETTE.ok, { head: 0.4, width: 0.32 })
    root.add(press)

    // корпус (разрез) с упором для наружного кольца
    const housing = cutRing([[1.95, -0.7], [3.3, -0.7], [3.3, 1.5], [2.255, 1.5], [2.255, 0], [1.95, 0]], stage.mat('iron'), { secMat: sec })
    root.add(housing)

    // молоток
    const hammer = new THREE.Group()
    const handle = stage.mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 12).rotateZ(Math.PI / 2), 'bronze')
    handle.position.x = 1.3
    const head = stage.mesh(new THREE.BoxGeometry(0.46, 0.95, 0.46), 'steelBlack')
    head.position.set(2.65, 0, 0)
    hammer.add(handle, head)
    root.add(hammer)

    // индукционный нагреватель: основание, сердечник через отверстие подшипника, табло
    const heater = new THREE.Group()
    const base = stage.mesh(new THREE.BoxGeometry(3.2, 0.9, 2.0), 'ironDark')
    base.position.set(-0.6, -0.85, 0)
    const core = stage.mesh(new THREE.BoxGeometry(1.15, 2.6, 1.15), 'steelBlack')
    core.position.set(0, 0.5, 0)
    const panel = stage.mesh(new THREE.BoxGeometry(0.9, 0.5, 0.06), 'rubber')
    panel.position.set(-1.45, -0.75, 1.03)
    const led = stage.mesh(new THREE.BoxGeometry(0.6, 0.22, 0.02), stage.mat('ok', { emissive: PALETTE.ok, emissiveIntensity: 0.5 }))
    led.position.set(-1.45, -0.72, 1.07)
    heater.add(base, core, panel, led)
    heater.position.set(-4.2, 0, 0)
    root.add(heater)

    const L = {
      inner: stage.label('Внутреннее кольцо — на вал', bearing, { offset: [-1.1, 0.42, -0.6], side: 'top' }),
      chamfer: stage.label('Фаска', new THREE.Vector3(0.66, 1.58, 0.66), { side: 'right' }),
      shoulder: stage.label('Буртик (упор)', new THREE.Vector3(0.9, 0.02, 0.9), { side: 'right' }),
      wrong: stage.label('✖ Сила через шарики', bearing, { offset: [1.6 * Math.SQRT1_2, 0.0, 1.6 * Math.SQRT1_2], side: 'right', tone: 'warn' }),
      dent: stage.label('Вмятины на дорожках', bearing, { offset: [-1.3, -0.4, 0.3], side: 'bottom', tone: 'warn' }),
      sleeve: stage.label('Оправка-втулка', sleeveIn, { offset: [-1.2, 1.4, -0.6], side: 'left' }),
      onInner: stage.label('Давит на внутреннее кольцо', sleeveIn, { offset: [1.2 * Math.SQRT1_2, 0.05, 1.2 * Math.SQRT1_2], side: 'right', tone: 'accent' }),
      seated: stage.label('✔ До упора', new THREE.Vector3(1.1, 0.0, 1.1), { side: 'right', tone: 'ok' }),
      temp: stage.label('t° — по ТК', heater, { offset: [-1.45, -0.45, 1.05], side: 'top', tone: 'accent' }),
      heater: stage.label('Индукционный нагреватель', heater, { offset: [-0.6, -1.3, 0], side: 'bottom' }),
      hot: stage.label('Сразу до упора, держать до остывания', bearing, { offset: [-1.2, 0.5, -1.0], side: 'top', tone: 'accent' }),
      onOuter: stage.label('Давит на наружное кольцо', sleeveOut, { offset: [2.0 * Math.SQRT1_2, 0.05, 2.0 * Math.SQRT1_2], side: 'right', tone: 'accent' }),
      housing: stage.label('Корпус', new THREE.Vector3(2.33, 0.4, -2.33), { side: 'right' }),
      check: stage.label('✔ Легко, ровно, без хруста', bearing, { offset: [-1.2, 0.5, -1.0], side: 'top', tone: 'ok' }),
    }
    const SHOW = [['inner', 'chamfer', 'shoulder'], ['wrong', 'dent'], ['sleeve', 'onInner', 'seated'], ['temp', 'heater', 'hot'], ['onOuter', 'housing', 'seated'], ['check']]

    let step = 0
    let lt = 0 // время внутри шага (идёт всегда: шаг проигрывается до конца)
    let cyc = 0 // время повторяющихся движений (стоит на паузе)
    let spin = 0
    const v = new THREE.Vector3()

    function pose() {
      // по умолчанию
      let by = 2.6, bx = 0, tilt = 0, flash = 0, heat = 0
      let showShaft = true, sIn = false, sOut = false, showHousing = false, showHammer = false, showHeater = false
      let pressOn = false, pressBad = false
      if (step === 0) {
        by = 2.4 - 0.25 * ph(lt, 0, 1.2)
      } else if (step === 1) {
        // удары молотком по наружному кольцу; каждый удар — вспышка и перекос
        showHammer = true
        const T = 1.1
        const n = Math.min(4, Math.floor(cyc / T))
        const k = saw(cyc, T)
        by = 1.95 - n * 0.035
        tilt = n * 0.018
        const swing = k < 0.75 ? 0.85 * ph(k, 0, 0.6) : 0.85 * (1 - ph(k, 0.75, 1))
        hammer.rotation.z = Math.max(0, swing)
        // в момент удара (k≈1 → 0)
        flash = Math.max(0, 1 - k * 4)
        if (cyc < 0.9) flash = 0
        // после 4 ударов — вмятины остаются (красный тон держится)
        flash = Math.max(flash, n >= 2 ? 0.35 : 0)
        L.dent.show(n >= 1)
      } else if (step === 2) {
        sIn = true
        pressOn = true
        const s0 = ph(lt, 0, 0.7)
        by = 2.0 - 1.6 * ph(lt, 0.9, 3.2)
        sleeveIn.position.y = by + 0.4 + (1 - s0) * 1.4
        L.seated.show(lt > 3.2)
      } else if (step === 3) {
        showHeater = true
        // 0..3 — нагрев на сердечнике, 3.2..4.6 — перенос на вал, 4.6..5.2 — надет свободно, потом остывает
        const hx = heater.position.x, hy = -0.4 + 0.4
        const lift = ph(lt, 3.2, 3.8), move = ph(lt, 3.6, 4.6), drop = ph(lt, 4.6, 5.2)
        bx = hx + (0 - hx) * move
        by = hy + 3.2 * lift - (hy + 3.2 - 2.4) * move - 2.0 * drop
        heat = ph(lt, 0.4, 3.0) * (1 - ph(lt, 6.0, 9.0))
        L.hot.show(lt > 4.6)
        L.temp.show(lt < 4.6)
      } else if (step === 4) {
        showShaft = false
        showHousing = true
        sOut = true
        pressOn = true
        const s0 = ph(lt, 0, 0.7)
        by = 2.2 - 1.8 * ph(lt, 0.9, 3.2)
        sleeveOut.position.y = by + 0.4 + (1 - s0) * 1.4
        L.seated.show(lt > 3.2)
      } else if (step === 5) {
        by = 0.4
        spin = cyc * 2.2
      }
      bearing.position.set(bx, by, 0)
      bearing.rotation.z = tilt
      brg.setAngle(step === 5 ? spin : 0)
      shaft.visible = showShaft
      sleeveIn.visible = sIn
      sleeveOut.visible = sOut
      housing.visible = showHousing
      hammer.visible = showHammer
      heater.visible = showHeater
      hammer.position.set(-4.7, by + 0.4 + 0.475, 0)
      press.visible = pressOn
      if (pressOn) {
        const top = (sIn ? sleeveIn : sleeveOut).position.y + (sIn ? 2.18 : 1.78)
        const px = sIn ? 0 : -2.03
        press.set(v.set(px, top + 1.5, 0), new THREE.Vector3(px, top + 0.05, 0))
      }
      press.line.material.color.set(pressBad ? PALETTE.bad : PALETTE.ok)
      press.cone.material.color.set(pressBad ? PALETTE.bad : PALETTE.ok)
      // подсветка: красная вспышка (удар) или оранжевый нагрев
      for (const m of [mats.inner, mats.outer, mats.ball]) {
        if (heat > 0.01) {
          m.emissive.copy(glow)
          m.emissiveIntensity = heat * (m === mats.ball ? 0.25 : 0.55)
        } else {
          m.emissive.copy(red)
          m.emissiveIntensity = flash * (m === mats.outer ? 0.15 : 0.6)
        }
      }
    }

    stage.onFrame((dt) => {
      lt += dt
      if (stage.playing) cyc += dt
      pose()
    })

    function apply(i, instant) {
      step = i
      lt = instant ? 99 : 0
      cyc = instant ? 99 : 0
      if (i === 1) cyc = 0
      if (i === 3 && instant) lt = 5.5
      Object.entries(L).forEach(([k, l]) => l.show(SHOW[i].includes(k)))
      if (!instant) stage.fit(FRAMES[i], { pad: 1.0, ms: 800 })
      pose()
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
