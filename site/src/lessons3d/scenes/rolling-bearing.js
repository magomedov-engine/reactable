// Подшипник качения в разрезе: кольца, шарики, сепаратор, защитные шайбы; вращение,
// нагрузки, маркировка, роликовый вариант. Ось подшипника — Y.
import { createStage, animator, THREE, PALETTE, cylY } from '../stage.js'
import { ballBearing, sectionMat, ph } from './joints-kit.js'

const STEPS = [
  { title: 'Из чего состоит', text: 'Наружное кольцо, внутреннее кольцо, шарики (тела качения) и сепаратор, который держит шарики на равном шаге. Четверть вырезана, чтобы видеть внутри.' },
  { title: 'Как он крутится', text: 'Внутреннее кольцо вращается вместе с валом, наружное стоит в корпусе. Шарики катятся между ними, а сепаратор идёт примерно вдвое медленнее вала — следите за красными рисками.' },
  { title: 'Дорожки качения', text: 'Шарики бегут по желобам — дорожкам качения. Касание идёт маленьким пятном, поэтому любая вмятина или грязь на дорожке даёт гул и быстрый износ.' },
  { title: 'Две нагрузки', text: 'Радиальная — поперёк вала (вес детали, натяжение ремня). Осевая — вдоль вала. Шариковый радиальный держит радиальную и немного осевую.' },
  { title: 'Закрытый и с номером', text: 'Защитные шайбы с двух сторон: смазка заложена на заводе, такой подшипник не промывают. На торце кольца — номер, например 6205: 05 × 5 = 25 мм отверстие. Ставят только номер из ТК.' },
  { title: 'Роликовый подшипник', text: 'Вместо шариков — цилиндрические ролики. Пятно касания — линия, поэтому он держит большую радиальную нагрузку, но почти не держит осевую.' },
]

export default {
  title: 'Подшипник качения',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [5.2, 4.6, 5.2], target: [0, 0, 0], fov: 30, fit: new THREE.Box3(new THREE.Vector3(-2.3, -1.2, -2.3), new THREE.Vector3(2.3, 1.4, 2.3)), pad: 0.82 })
    const to = animator(stage)
    const { root } = stage
    const sec = sectionMat(stage)

    const b = ballBearing(stage, { secMat: sec })
    root.add(b.group)

    // вал — появляется на шаге «как крутится»
    const shaft = new THREE.Group()
    shaft.add(stage.mesh(cylY(0.995, 2.0, 48), 'steelDark'))
    const sm = stage.mesh(new THREE.BoxGeometry(0.06, 2.02, 0.08), 'mark')
    sm.position.set(0, 0, 0.97)
    shaft.add(sm)
    root.add(shaft)

    // нагрузки
    const radial = stage.arrow(new THREE.Vector3(-3.4, 0, 3.4), new THREE.Vector3(-1.65, 0, 1.65), PALETTE.milk, { head: 0.35, width: 0.26 })
    const axial = stage.arrow(new THREE.Vector3(0, 3.0, 0), new THREE.Vector3(0, 1.75, 0), PALETTE.oil, { head: 0.35, width: 0.26 })
    root.add(radial, axial)

    const L = {
      outer: stage.label('Наружное кольцо', new THREE.Vector3(-1.6, 0.4, -1.4), { side: 'top' }),
      inner: stage.label('Внутреннее кольцо', new THREE.Vector3(0.95, -0.4, 0.15), { side: 'bottom' }),
      balls: stage.label('Шарики', new THREE.Vector3(1.6 * Math.SQRT1_2, 0.26, 1.6 * Math.SQRT1_2), { side: 'right' }),
      cage: stage.label('Сепаратор', new THREE.Vector3(-1.6, 0.16, 0.2), { side: 'left' }),
      race: stage.label('Дорожка качения', new THREE.Vector3(1.86 * Math.SQRT1_2, 0, 1.86 * Math.SQRT1_2), { side: 'right', tone: 'accent' }),
      race2: stage.label('Дорожка', new THREE.Vector3(1.0, -0.9, 0.4), { side: 'left', tone: 'accent' }),
      radial: stage.label('Радиальная', new THREE.Vector3(-2.9, 0.05, 2.9), { side: 'top' }),
      axial: stage.label('Осевая', new THREE.Vector3(0, 2.3, 0), { side: 'right', tone: '' }),
      cageSpeed: stage.label('Сепаратор ≈ ½ скорости вала', new THREE.Vector3(-1.6, 0.2, 0), { side: 'left', tone: 'accent' }),
      shield: stage.label('Защитная шайба', new THREE.Vector3(-1.2, 0.38, -1.0), { side: 'top' }),
      num: stage.label('6205 → Ø 25 мм', new THREE.Vector3(-0.85, 0.4, 0.85), { side: 'bottom', tone: 'big' }),
      roll: stage.label('Ролики', new THREE.Vector3(1.6 * Math.SQRT1_2, 0.3, 1.6 * Math.SQRT1_2), { side: 'right' }),
    }
    const SHOW = [
      ['outer', 'inner', 'balls', 'cage'],
      ['cageSpeed'],
      ['race', 'race2'],
      ['radial', 'axial'],
      ['shield', 'num'],
      ['roll'],
    ]

    // состояние сцены по шагам
    const st = { shaft: 0, explode: 0, load: 0, shield: 0, roller: 0, speed: 0.35 }
    let angle = 0
    let step = 0
    let lt = 0

    stage.onFrame((dt) => {
      lt += dt
      if (stage.playing) angle += dt * st.speed * 2.2
      b.setAngle(angle)
      b.setRoller(st.roller)
      shaft.visible = st.shaft > 0.01
      shaft.scale.set(1, Math.max(0.001, st.shaft), 1)
      shaft.rotation.y = angle
      b.shields.visible = st.shield > 0.01
      b.shields.scale.set(1, Math.max(0.001, st.shield), 1)
      // «разборка» для показа дорожек: наружное кольцо вверх, внутреннее вниз
      b.outer.position.y = st.explode * 0.75
      b.inner.position.y = -st.explode * 0.75
      // стрелки нагрузок «давят» в такт
      const pulse = step === 3 ? 0.12 * Math.sin(lt * 4) : 0
      radial.visible = axial.visible = st.load > 0.02
      radial.set(new THREE.Vector3(-3.4 - pulse, 0, 3.4 + pulse), new THREE.Vector3(-1.62 - (1 - st.load) * 0.9, 0, 1.62 + (1 - st.load) * 0.9))
      axial.set(new THREE.Vector3(0, 2.8 + pulse, 0), new THREE.Vector3(0, 1.05 + (1 - st.load) * 1.2, 0))
      L.race2.show(step === 2 && ph(lt, 0.6, 0.8) > 0.5)
    })

    function apply(i, instant) {
      step = i
      lt = instant ? 99 : 0
      const d = instant ? 0 : 0.8
      const s = [
        { shaft: 0, explode: 0, load: 0, shield: 0, roller: 0, speed: 0.35 },
        { shaft: 1, explode: 0, load: 0, shield: 0, roller: 0, speed: 1 },
        { shaft: 0, explode: 1, load: 0, shield: 0, roller: 0, speed: 0.25 },
        { shaft: 1, explode: 0, load: 1, shield: 0, roller: 0, speed: 0.5 },
        { shaft: 0, explode: 0, load: 0, shield: 1, roller: 0, speed: 0.3 },
        { shaft: 1, explode: 0, load: 0, shield: 0, roller: 1, speed: 0.6 },
      ][i]
      for (const k of Object.keys(s)) to(st, k, s[k], k === 'roller' ? d * 1.4 : d)
      Object.entries(L).forEach(([k, l]) => l.show(SHOW[i].includes(k)))
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
