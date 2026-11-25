// Посадки: вал во втулке. Зазор/натяг в микронах не видно глазом, поэтому разница
// показана в сильно увеличенном масштабе (об этом сказано в тексте шага).
import { createStage, animator, THREE, PALETTE, lathe, cylY } from '../stage.js'

const STEPS = [
  { title: 'Вал и отверстие', text: 'Номинал у обоих один, например Ø50. Но реальные размеры немного отличаются — в пределах допуска. Втулка показана в разрезе.' },
  { title: 'Посадка с зазором', text: 'Вал всегда меньше отверстия: остаётся щель для масла, вал свободно вращается. Так сидит шейка вала во вкладыше и поршень в гильзе.' },
  { title: 'Переходная посадка', text: 'В зависимости от реальных размеров получится маленький зазор или маленький натяг. Применяют для точного центрирования деталей.' },
  { title: 'Посадка с натягом', text: 'Вал больше отверстия: сам он не войдёт. Его запрессовывают прессом или греют втулку по ТК. Соединение держится трением, «намертво».' },
  { title: 'Поле допуска', text: 'Годен любой размер между нижней и верхней границей. Ваша задача — измерить и убедиться, что деталь попала в это поле. Масштаб сильно увеличен: реальный зазор — сотые доли миллиметра.' },
]

export default {
  title: 'Зазор, натяг и посадки',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [5.2, 3.2, 6.4], target: [0, 0.6, 0], fov: 30, fit: true, pad: 1.05 })
    const to = animator(stage)
    const { root } = stage

    // втулка (отверстие R_HOLE) в разрезе — 3/4 кольца, чтобы видно было вал внутри
    const R_HOLE = 1.0
    const bushGeo = new THREE.LatheGeometry(
      [[R_HOLE, -0.9], [1.6, -0.9], [1.6, 0.9], [R_HOLE, 0.9], [R_HOLE, -0.9]].map(([r, y]) => new THREE.Vector2(r, y)),
      64, Math.PI * 0.5, Math.PI * 1.5,
    )
    const bush = stage.mesh(bushGeo, 'iron')
    // торцы среза — цветом среза, как на чертеже
    const cutMat = stage.mat('mark', { color: PALETTE.section, side: THREE.DoubleSide })
    for (const a of [Math.PI * 0.5, Math.PI * 2]) {
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.8), cutMat)
      cap.position.set(1.3 * Math.sin(a), 0, 1.3 * Math.cos(a))
      cap.rotation.y = a + Math.PI / 2
      bush.add(cap)
    }
    root.add(bush)

    // вал: радиус меняется по шагам; рядом «щель» — цветная плёнка масла или красная зона натяга
    const state = { r: 0.82, y: 1.9, spin: 0, film: 0, press: 0, band: 0 }
    const shaft = new THREE.Group()
    const body = stage.mesh(cylY(1, 3.4, 64), 'chrome')
    const chamfer = stage.mesh(lathe([[0, 1.7], [0.92, 1.7], [1, 1.62], [1, 1.6], [0, 1.6]], 48), 'chrome')
    const keyMark = stage.mesh(new THREE.BoxGeometry(0.06, 3.2, 0.08), 'mark')
    keyMark.position.set(0, 0, 0.98)
    shaft.add(body, chamfer, keyMark)
    root.add(shaft)

    const filmMat = stage.mat('oil', { transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    const film = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.8, 64, 1, true), filmMat)
    root.add(film)
    const pressMat = stage.mat('bad', { transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
    const pressBand = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.8, 64, 1, true), pressMat)
    root.add(pressBand)

    // поле допуска: две полупрозрачные «границы» вокруг вала
    const tolMat = stage.mat('ok', { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    const tolBand = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.4, 64, 1, true), tolMat)
    const tol = new THREE.Group()
    tol.add(tolBand)
    root.add(tol)

    // стрелка запрессовки
    const press = stage.arrow(new THREE.Vector3(0, 4.2, 0), new THREE.Vector3(0, 3.1, 0), PALETTE.bad, { head: 0.35, width: 0.28 })
    root.add(press)

    const lShaft = stage.label('Вал', shaft, { offset: [0, 1.75, 0] })
    const lHole = stage.label('Отверстие втулки', new THREE.Vector3(-1.3, 0.95, 0), { side: 'left' })
    const lGap = stage.label('', new THREE.Vector3(0, -0.95, 1.0), { side: 'bottom', tone: 'accent' })
    const lTol = stage.label('Поле допуска', new THREE.Vector3(0, 1.75, -1.0), { side: 'right', tone: 'ok' })

    stage.onFrame((dt) => {
      if (stage.playing) state.spin += dt * (state.film > 0.5 ? 2.2 : state.press > 0.5 ? 0 : 0.6)
      shaft.scale.set(state.r, 1, state.r)
      shaft.position.y = state.y
      shaft.rotation.y = state.spin
      film.visible = state.film > 0.02
      film.scale.set((state.r + R_HOLE) / 2, 1, (state.r + R_HOLE) / 2)
      filmMat.opacity = 0.55 * state.film
      pressBand.visible = state.press > 0.02
      pressBand.scale.set(R_HOLE + 0.005, 1, R_HOLE + 0.005)
      pressMat.opacity = 0.65 * state.press
      press.visible = state.press > 0.02
      press.position.y = 4.2 + (1 - state.press) * 0.6
      tol.visible = state.band > 0.02
      tol.scale.set(state.r * 1.05, 1, state.r * 1.05)
      tolMat.opacity = 0.28 * state.band
      tol.position.y = state.y
      lTol.show(state.band > 0.5)
      lShaft.show(true)
      lHole.show(true)
    })

    const apply = (i, instant) => {
      const d = instant ? 0 : 0.9
      const s = [
        { r: 0.82, y: 1.9, film: 0, press: 0, band: 0, gap: '' },
        { r: 0.9, y: 0, film: 1, press: 0, band: 0, gap: 'Зазор: место для масла' },
        { r: 0.995, y: 0, film: 0.3, press: 0, band: 0, gap: 'Зазор или натяг — «на грани»' },
        { r: 1.06, y: 1.0, film: 0, press: 1, band: 0, gap: 'Натяг: вал больше отверстия' },
        { r: 0.92, y: 0, film: 0, press: 0, band: 1, gap: 'Годен: размер внутри поля' },
      ][i]
      to(state, 'r', s.r, d)
      to(state, 'y', s.y, d)
      to(state, 'film', s.film, d)
      to(state, 'press', s.press, d)
      to(state, 'band', s.band, d)
      lGap.set(s.gap).show(!!s.gap)
      // натяг: вал «входит» под прессом только после паузы
      if (i === 3) setTimeout(() => to(state, 'y', 0.35, 1.6), instant ? 0 : 900)
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
