// Блок цилиндров с мокрой гильзой: разрез одного цилиндра (задняя половина, срез к зрителю).
// Высоты и зазоры условные; выступание бурта сильно увеличено, чтобы его было видно.
import { createStage, animator, THREE, PALETTE } from '../stage.js'
import { halfLathe, lathe2Section, halfPlate, halfPlateSection, particles, sequencer, fitBox } from './ep-kit.js'

const STEPS = [
  { title: 'Блок цилиндров', text: 'Блок — литой «скелет» двигателя. Здесь показан разрез одного цилиндра: гнездо под гильзу и пустая полость вокруг него — рубашка охлаждения.' },
  { title: 'Мокрая гильза', text: 'Гильза вставляется в гнездо свободно, без пресса. Снаружи её омывает охлаждающая жидкость — поэтому гильза «мокрая». Так она лучше охлаждается.' },
  { title: 'Верхний бурт', text: 'Сверху у гильзы «воротник» — бурт. Он лежит на уступе в выточке блока и чуть выступает над плоскостью блока. Головка через прокладку прижмёт именно бурт.' },
  { title: 'Нижние кольца', text: 'Внизу гильзу уплотняют резиновые кольца. Их проверяют на порезы и скрутки и смазывают разрешённой смазкой по ТК. Если кольцо порезано или скручено — жидкость уйдёт вниз, в картер, и смешается с маслом.' },
  { title: 'В сборе', text: 'На блок кладут новую прокладку, сверху ставят головку и затягивают по схеме. Внутри гильзы ходит поршень, снаружи течёт жидкость, а прокладка держит газы, воду и масло.' },
]

export default {
  title: 'Блок цилиндров и мокрая гильза',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [4.5, 4.5, 9], target: [0, 2, 0], fov: 30 })
    const to = animator(stage)
    const seq = sequencer(stage)
    const { root } = stage
    const W = 2.3, D = 2.3

    // ---------- блок: стопка «плит» с вырезами разного радиуса
    const blockCut = stage.mat('mark', { color: PALETTE.section, side: THREE.DoubleSide, roughness: 0.8, metalness: 0.1 })
    const block = new THREE.Group()
    const LAYERS = [
      [1.17, -0.6, 1.0], // нижний пояс: здесь уплотняют резиновые кольца
      [1.62, 1.0, 3.6], // рубашка охлаждения
      [1.2, 3.6, 3.88], // уступ под бурт
      [1.4, 3.88, 4.15], // выточка под бурт; верх — плоскость блока
    ]
    for (const [r, y0, y1] of LAYERS) {
      block.add(stage.mesh(halfPlate(W, D, r, y0, y1), 'iron'))
      block.add(new THREE.Mesh(halfPlateSection(W, r, y0, y1), blockCut))
    }
    root.add(block)

    // ---------- гильза
    const LINER = [[1.0, -0.4], [1.14, -0.4], [1.14, 1.0], [1.12, 1.05], [1.12, 3.55], [1.19, 3.6], [1.19, 3.88], [1.38, 3.88], [1.38, 4.2], [1.0, 4.2], [1.0, -0.4]]
    const liner = new THREE.Group()
    liner.add(stage.mesh(halfLathe(LINER, 48), 'steel'))
    liner.add(stage.mesh(lathe2Section(LINER), stage.mat('steelDark', { side: THREE.DoubleSide, roughness: 0.7, metalness: 0.3, color: '#9c988f' })))
    // резиновые кольца
    const ringMats = []
    const RING_Y = [0.15, 0.4, 0.65]
    for (const y of RING_Y) {
      const m = stage.mat('rubber', { color: '#7f9468', roughness: 0.6 })
      ringMats.push(m)
      const g = new THREE.TorusGeometry(1.15, 0.065, 10, 40, Math.PI).rotateX(-Math.PI / 2)
      const o = new THREE.Mesh(g, m)
      o.position.y = y
      liner.add(o)
      for (const s of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), m)
        c.position.set(s * 1.15, y, 0.004)
        liner.add(c)
      }
    }
    root.add(liner)

    // ---------- жидкость в рубашке + поток частиц
    const waterMat = stage.mat('water', { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    const water = new THREE.Mesh(halfLathe([[1.125, 1.0], [1.61, 1.0], [1.61, 3.6], [1.125, 3.6], [1.125, 1.0]], 40), waterMat)
    root.add(water)
    const N = 70
    const flow = particles(stage, N, 0.035, '#a9c4d8')
    root.add(flow)
    const leak = particles(stage, 10, 0.045, '#a9c4d8')
    root.add(leak)

    // ---------- прокладка и головка
    const top = new THREE.Group()
    const gasket = new THREE.Group()
    gasket.add(stage.mesh(halfPlate(W, D, 1.0, 4.2, 4.27), 'steelBlack'))
    gasket.add(stage.mesh(halfPlateSection(W, 1.0, 4.2, 4.27), stage.mat('steel', { side: THREE.DoubleSide })))
    const head = new THREE.Group()
    head.add(stage.mesh(halfPlate(W, D, 0, 4.27, 5.15), 'ironDark'))
    head.add(new THREE.Mesh(halfPlateSection(W, 0, 4.27, 5.15), stage.mat('mark', { color: '#8a5040', side: THREE.DoubleSide, roughness: 0.8 })))
    top.add(gasket, head)
    root.add(top)
    // стрелки прижатия
    const press = [-1.25, 1.25].map((x) => {
      const a = stage.arrow(new THREE.Vector3(x, 6.4, -0.3), new THREE.Vector3(x, 5.6, -0.3), PALETTE.milk, { head: 0.22, width: 0.16 })
      root.add(a)
      return a
    })

    // ---------- поршень (для шага «в сборе»)
    const PISTON = [[0, 2.3], [0.975, 2.3], [0.975, 3.95], [0.55, 3.95], [0.35, 3.8], [0, 3.8], [0, 2.3]]
    const piston = new THREE.Group()
    piston.add(stage.mesh(halfLathe(PISTON, 40), 'steelDark'))
    piston.add(stage.mesh(lathe2Section(PISTON, 0.004), stage.mat('steel', { side: THREE.DoubleSide, color: '#a9a59c' })))
    for (const y of [3.75, 3.6, 3.42]) {
      const r = new THREE.Mesh(halfLathe([[0.9, y - 0.03], [0.99, y - 0.03], [0.99, y + 0.03], [0.9, y + 0.03], [0.9, y - 0.03]], 40), stage.mat('steelBlack'))
      piston.add(r)
    }
    root.add(piston)

    // ---------- подписи
    const L = {
      block: stage.label('Блок цилиндров', new THREE.Vector3(-1.9, 0.4, 0), { side: 'left' }),
      bore: stage.label('Гнездо под гильзу', new THREE.Vector3(0, 4.15, -1.2), { side: 'top' }),
      jacket: stage.label('Рубашка охлаждения', new THREE.Vector3(1.4, 2.3, 0), { side: 'right' }),
      deck: stage.label('Плоскость блока', new THREE.Vector3(-1.9, 4.15, 0), { side: 'left' }),
      liner: stage.label('Гильза', new THREE.Vector3(-1.06, 2.6, 0), { side: 'left', tone: 'accent' }),
      collar: stage.label('Бурт гильзы', new THREE.Vector3(1.3, 4.2, 0), { side: 'top', tone: 'accent' }),
      seat: stage.label('Уступ в блоке', new THREE.Vector3(1.3, 3.88, 0), { side: 'right' }),
      protr: stage.label('Чуть выше блока (увеличено)', new THREE.Vector3(1.9, 4.18, 0), { side: 'right' }),
      rings: stage.label('Резиновые кольца', new THREE.Vector3(1.2, 0.4, 0), { side: 'right', tone: 'accent' }),
      leak: stage.label('', new THREE.Vector3(1.15, -1.2, -0.3), { side: 'right' }),
      gasket: stage.label('Прокладка головки', new THREE.Vector3(1.9, 4.24, 0), { side: 'right' }),
      head: stage.label('Головка блока', new THREE.Vector3(0, 5.15, -1.0), { side: 'top' }),
      piston: stage.label('Поршень', new THREE.Vector3(-0.5, 3.0, 0), { side: 'left' }),
    }
    const showLabels = (keys) => Object.entries(L).forEach(([k, l]) => l.show(keys.includes(k)))

    // ---------- состояние
    const st = { linerY: 6, water: 0, topY: 3, topVis: 0, press: 0, piston: 0, leak: 0, bad: 0 }
    const okColor = new THREE.Color('#7f9468'), badColor = new THREE.Color(PALETTE.bad)
    let leakT = 0

    stage.onFrame((dt, t) => {
      liner.position.y = st.linerY
      liner.visible = st.linerY < 5.9
      water.visible = st.water > 0.02
      waterMat.opacity = 0.42 * st.water
      flow.visible = st.water > 0.5
      if (flow.visible) {
        flow.place((i, p) => {
          const u = (i * 0.6180339) % 1
          const k = (t * 0.22 + i / N) % 1
          const a = Math.PI / 2 + 0.06 + (Math.PI - 0.12) * ((u + 0.04 * t) % 1)
          const r = 1.18 + ((i * 0.377) % 1) * 0.38
          p.set(r * Math.sin(a), 1.05 + k * 2.5, r * Math.cos(a))
          return Math.min(1, k * 8, (1 - k) * 8) * st.water
        })
      }
      // утечка вниз мимо повреждённого кольца
      if (stage.playing) leakT += dt
      leak.visible = st.leak > 0.05 && liner.visible
      if (leak.visible) {
        leak.place((i, p) => {
          const k = (leakT * 0.7 + i / 10) % 1
          const a = Math.PI / 2 + 0.5 + (i % 5) * 0.45
          p.set(1.15 * Math.sin(a), -0.45 - k * 1.6, 1.15 * Math.cos(a))
          return st.leak * Math.min(1, (1 - k) * 5)
        })
      }
      ringMats[2].color.copy(okColor).lerp(badColor, st.bad)
      top.position.y = st.topY
      top.visible = st.topVis > 0.02
      press.forEach((a, i) => {
        a.visible = st.press > 0.05
        a.position.y = 5.15 + st.topY + 0.95 + Math.sin(t * 3 + i) * 0.06
      })
      piston.position.y = (1 - st.piston) * 4 + Math.sin(t * 1.6) * 0.35 * st.piston - 0.35 * st.piston
      piston.visible = st.piston > 0.02 && piston.position.y < 3
    })

    const box = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b))
    const VIEWS = [
      [box([-W, -0.6, -D], [W, 4.3, 0]), [0.45, 0.6, 1]],
      [box([-W, -0.6, -D], [W, 4.3, 0]), [0.35, 0.35, 1]],
      [box([0.6, 3.3, -0.6], [W, 4.9, 0]), [0.35, 0.3, 1]],
      [box([0.7, -1.7, -0.3], [1.9, 1.1, 0]), [0.3, 0.12, 1]],
      [box([-W, -0.6, -D], [W, 5.2, 0]), [0.5, 0.5, 1]],
    ]

    const apply = (i, instant) => {
      const d = instant ? 0 : 0.9
      seq.stop()
      const set = (k, v, dur = d) => to(st, k, v, dur)
      set('linerY', i === 0 ? 6 : 0, instant ? 0 : 1.4)
      set('water', i === 0 ? 0 : 1)
      set('leak', 0, 0.3)
      set('bad', 0, 0.3)
      set('topY', i === 4 ? 0 : i === 2 ? 0.9 : 3)
      set('topVis', i === 2 || i === 4 ? 1 : 0, 0)
      set('press', i === 2 ? 1 : 0, 0.3)
      set('piston', i === 4 ? 1 : 0, instant ? 0 : 1.2)
      showLabels(
        [
          ['block', 'bore', 'jacket', 'deck'],
          ['liner', 'jacket'],
          ['collar', 'seat', 'protr'],
          ['rings', 'leak'],
          ['gasket', 'head', 'piston', 'jacket'],
        ][i],
      )
      if (i === 3) {
        // ok → порез → ok …
        const good = () => {
          L.leak.set('Кольца целые — сухо').tone('ok')
          set('bad', 0, 0.4)
          set('leak', 0, 0.4)
        }
        const badF = () => {
          L.leak.set('Кольцо порезано: жидкость в картер').tone('warn')
          set('bad', 1, 0.4)
          set('leak', 1, 0.4)
        }
        good()
        seq.run([[2.5, badF], [7, good]], 9)
      }
      const [bx, dir] = VIEWS[i]
      fitBox(stage, bx, dir, { pad: 1.12, ms: instant ? 0 : 900 })
      if (instant) stage.setHome()
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}
