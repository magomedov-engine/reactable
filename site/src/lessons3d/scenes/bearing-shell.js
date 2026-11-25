// Коренной вкладыш: устройство и установка в постель блока (блок перевёрнут на стенде,
// поэтому постель снизу, а крышка ставится сверху). Толщины слоёв увеличены.
import { createStage, animator, THREE, PALETTE, cylY, cylZ } from '../stage.js'
import { annulusZ, canvasTexture, particles, sequencer, fitBox } from './ep-kit.js'

const STEPS = [
  { title: 'Из чего вкладыш', text: 'Вкладыш — тонкое полукольцо. Снаружи стальная основа (спинка), внутри мягкий рабочий слой. На краю — «усик», посередине — масляное отверстие и канавка.' },
  { title: 'Усик — в паз', text: 'Блок перевёрнут, постель коренной опоры смотрит вверх. Вкладыш ставят так, чтобы усик вошёл в паз постели. Тогда вкладыш стоит на своём месте и не провернётся.' },
  { title: 'Отверстие над каналом', text: 'Отверстие во вкладыше должно встать точно над масляным каналом блока. Тогда масло под давлением проходит к шейке вала.' },
  { title: 'Так нельзя', text: 'Вкладыш сдвинут: усик не в пазу, отверстие ушло с канала. Масло к шейке не идёт — будет задир и проворот вкладыша. Вкладыши не подпиливают и не подгоняют.' },
  { title: 'Чистота и смазка', text: 'Рабочий слой не трогают пальцами и ничем не царапают. Чистым маслом по ТК смазывают только рабочую поверхность. Спинка и постель — сухие и чистые.' },
  { title: 'Вал и крышка', text: 'Укладывают вал, ставят крышку со своим вкладышем строго по номеру и меткам. Между шейкой и вкладышами остаётся масляная плёнка — это и есть рабочий зазор.' },
]

const RB = 1.12 // радиус постели
const RW = 1.0 // рабочий радиус вкладыша
const RS = 1.04 // граница рабочего слоя и спинки
const DZ = 1.0 // ширина опоры

export default {
  title: 'Вкладыш: установка',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [2.5, 3.5, 7], target: [0, 0, 0], fov: 30 })
    const to = animator(stage)
    const seq = sequencer(stage)
    const { root } = stage

    // ---------- постель блока (снизу) и крышка (сверху)
    const saddleShape = new THREE.Shape()
    saddleShape.moveTo(-2.1, 0)
    saddleShape.lineTo(-RB, 0)
    saddleShape.absarc(0, 0, RB, Math.PI, Math.PI * 2, false)
    saddleShape.lineTo(2.1, 0)
    saddleShape.lineTo(2.1, -2.3)
    saddleShape.lineTo(-2.1, -2.3)
    saddleShape.closePath()
    const sGeo = new THREE.ExtrudeGeometry(saddleShape, { depth: DZ, bevelEnabled: false, curveSegments: 48 })
    sGeo.translate(0, 0, -DZ / 2)
    root.add(stage.mesh(sGeo, 'iron'))
    // паз под усик (тёмная выемка на кромке постели)
    const notch = stage.mesh(new THREE.PlaneGeometry(0.2, 0.26).rotateX(-Math.PI / 2), stage.mat('rubber', { color: '#18181a' }))
    notch.position.set(-RB - 0.06, 0.002, 0.28)
    root.add(notch)
    // масляный канал в постели: отверстие на дне
    const holeB = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20).rotateX(-Math.PI / 2), stage.mat('oil', { color: '#5a4a22' }))
    holeB.position.y = -RB + 0.004
    root.add(holeB)

    const capShape = new THREE.Shape()
    capShape.moveTo(-1.95, 0)
    capShape.lineTo(-RB, 0)
    capShape.absarc(0, 0, RB, Math.PI, 0, true)
    capShape.lineTo(1.95, 0)
    capShape.lineTo(1.95, 1.15)
    capShape.lineTo(-1.95, 1.15)
    capShape.closePath()
    const cGeo = new THREE.ExtrudeGeometry(capShape, { depth: DZ * 0.96, bevelEnabled: false, curveSegments: 48 })
    cGeo.translate(0, 0, -DZ * 0.48)
    const cap = new THREE.Group()
    cap.add(stage.mesh(cGeo, 'ironDark'))
    root.add(cap)
    // болты крышки
    const bolts = new THREE.Group()
    for (const x of [-1.6, 1.6]) {
      const b = stage.mesh(cylY(0.13, 2.0, 16), 'steelBlack')
      b.position.set(x, 0.5, 0)
      const h = stage.mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.22, 6), 'steelBlack')
      h.position.set(x, 1.26, 0)
      bolts.add(b, h)
    }
    cap.add(bolts)
    // номер опоры на блоке и на крышке
    const numTex = canvasTexture(64, 64, (g, w) => {
      g.fillStyle = '#b0584a'
      g.font = 'bold 48px monospace'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('3', w / 2, w / 2 + 2)
    })
    const numMat = new THREE.MeshBasicMaterial({ map: numTex, transparent: true, toneMapped: false, depthWrite: false })
    const numB = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), numMat)
    numB.position.set(1.62, -0.35, DZ / 2 + 0.003)
    root.add(numB)
    const numC = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), numMat)
    numC.position.set(1.0, 0.75, DZ * 0.48 + 0.003)
    cap.add(numC)

    // ---------- вкладыш: рабочий слой + спинка, канавка, отверстие, усик
    function makeShell(a0, a1, withHole) {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(annulusZ(RW, RS, a0, a1, DZ - 0.04), stage.mat('bronze')))
      g.add(new THREE.Mesh(annulusZ(RS, RB, a0, a1, DZ - 0.04), stage.mat('steel')))
      const tab = stage.mesh(new THREE.BoxGeometry(0.16, 0.07, 0.2), 'steel')
      tab.position.set(-RB - 0.06, -0.031, 0.28)
      if (a0 < 0.1) tab.position.y = 0.031
      g.add(tab)
      if (withHole) {
        g.add(new THREE.Mesh(annulusZ(RW - 0.006, RW + 0.002, a0 + 0.12, a1 - 0.12, 0.1), stage.mat('steelBlack')))
        const h = new THREE.Mesh(new THREE.CircleGeometry(0.085, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#141517' }))
        h.position.y = -RW + 0.012
        g.add(h)
        g.hole = h
      }
      g.tab = tab
      return g
    }
    const shell = makeShell(Math.PI, Math.PI * 2, true)
    root.add(shell)
    const capShell = makeShell(0, Math.PI, false)
    cap.add(capShell)
    // плёнка масла на рабочем слое (шаг «смазка»)
    const coatMat = stage.mat('oil', { transparent: true, opacity: 0, depthWrite: false, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide })
    const coat = new THREE.Mesh(annulusZ(RW - 0.012, RW - 0.002, Math.PI + 0.02, Math.PI * 2 - 0.02, DZ - 0.06), coatMat)
    shell.add(coat)
    // отпечаток пальца на рабочем слое
    const fpTex = canvasTexture(128, 128, (g) => {
      g.strokeStyle = 'rgba(207,126,111,0.95)'
      g.lineWidth = 5
      for (let k = 0; k < 7; k++) {
        g.beginPath()
        g.ellipse(64, 66, 10 + k * 7, 16 + k * 8, 0, 0, Math.PI * 2)
        g.stroke()
      }
    })
    const fpMat = new THREE.MeshBasicMaterial({ map: fpTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), fpMat)
    const fa = Math.PI * 1.28
    fp.position.set(Math.cos(fa) * (RW - 0.02), Math.sin(fa) * (RW - 0.02), 0.05)
    fp.lookAt(0, 0, 0.05)
    shell.add(fp)

    // ---------- шейка вала и плёнка
    const journal = new THREE.Group()
    journal.add(stage.mesh(cylZ(RW - 0.012, 2.2, 48), 'chrome'))
    const keyMark = stage.mesh(new THREE.BoxGeometry(0.05, 0.05, 2.1), 'mark')
    keyMark.position.y = RW - 0.02
    journal.add(keyMark)
    root.add(journal)
    const filmMat = stage.mat('oil', { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    const film = new THREE.Mesh(new THREE.CylinderGeometry(RW - 0.005, RW - 0.005, DZ - 0.06, 48, 1, true).rotateX(Math.PI / 2), filmMat)
    root.add(film)

    // ---------- масло: снизу по каналу, через отверстие, в стороны по рабочему слою
    const NP = 26
    const oilP = particles(stage, NP, 0.04, '#f0cf7a')
    root.add(oilP)
    const feed = stage.arrow(new THREE.Vector3(0, -3.2, 0.7), new THREE.Vector3(0, -2.4, 0.7), PALETTE.oil, { head: 0.2, width: 0.15 })
    root.add(feed)

    // ---------- подписи
    const aWork = new THREE.Object3D()
    aWork.position.set(Math.cos(-0.7) * RW, Math.sin(-0.7) * RW, 0.3)
    const aBack = new THREE.Object3D()
    aBack.position.set(Math.cos(Math.PI + 0.45) * RB, Math.sin(Math.PI + 0.45) * RB, 0.3)
    shell.add(aWork, aBack)
    const L = {
      work: stage.label('Рабочий слой: не трогать', aWork, { side: 'right', tone: 'accent' }),
      back: stage.label('Стальная основа', aBack, { side: 'left' }),
      tab: stage.label('Усик', shell.tab, { side: 'left', tone: 'accent' }),
      hole: stage.label('Масляное отверстие', shell.hole, { side: 'top' }),
      notch: stage.label('Паз в постели', notch, { side: 'top', offset: [0, 0, -0.1] }),
      oil: stage.label('', new THREE.Vector3(0, -RB, DZ / 2), { side: 'bottom', tone: 'ok' }),
      feed: stage.label('Масляный канал блока', new THREE.Vector3(0, -3.2, 0.7), { side: 'right' }),
      clean: stage.label('', fp, { side: 'left', offset: [0, 0, 0] }),
      dry: stage.label('Спинка и постель — сухие', new THREE.Vector3(1.6, 0, 0.5), { side: 'top' }),
      film: stage.label('Масляная плёнка (зазор)', new THREE.Vector3(0.75, -0.66, DZ / 2), { side: 'right', tone: 'accent' }),
      num: stage.label('Крышка — по номеру и меткам', new THREE.Vector3(1.3, 1.2, DZ / 2), { side: 'top' }),
    }
    const showLabels = (keys) => Object.entries(L).forEach(([k, l]) => l.show(keys.includes(k)))

    // ---------- состояние
    const st = { sy: 1.9, srz: 0.0, spin: 1, wrong: 0, oil: 0, block: 0, fp: 0, coat: 0, jy: 4, cy: 5, film: 0 }
    const tabMat = shell.tab.material
    const tabBad = stage.mat('bad')
    let spinA = 0, oilT = 0

    stage.onFrame((dt, t) => {
      if (stage.playing) {
        spinA += dt * 0.6 * st.spin
        oilT += dt
      }
      shell.position.y = st.sy + st.wrong * 0.06
      shell.rotation.set(0.5 * st.spin, Math.sin(spinA) * 0.8 * st.spin, st.srz - 0.18 * st.wrong)
      shell.tab.material = st.wrong > 0.5 ? tabBad : tabMat
      cap.position.y = st.cy
      cap.visible = st.cy < 4.9
      journal.position.y = st.jy
      journal.visible = st.jy < 3.9
      journal.rotation.z = st.film > 0.5 ? -oilT * 1.2 : 0
      film.visible = st.film > 0.02
      filmMat.opacity = 0.45 * st.film
      fpMat.opacity = st.fp
      fp.visible = st.fp > 0.02
      coatMat.opacity = 0.55 * st.coat
      coat.visible = st.coat > 0.02
      // масло
      oilP.visible = st.oil > 0.02
      feed.visible = st.oil > 0.5
      if (oilP.visible) {
        oilP.place((i, p) => {
          const k = (oilT * 0.35 + i / NP) % 1
          const side = i % 2 ? 1 : -1
          if (st.block > 0.5) {
            // упирается в спинку сдвинутого вкладыша
            const y = -RB + 0.02 + Math.sin(oilT * 5 + i) * 0.02
            p.set(Math.sin(i) * 0.05, y, Math.cos(i) * 0.05)
            return k < 0.5 ? 0.9 : 0
          }
          if (k < 0.25) {
            p.set(0, -RB - 0.1 + (k / 0.25) * 0.12, 0)
            return k < 0.08 ? 0 : 1
          }
          const a = Math.PI * 1.5 + side * ((k - 0.25) / 0.75) * 1.35
          const zz = ((i * 0.37) % 1 - 0.5) * (DZ - 0.15) * Math.min(1, (k - 0.25) * 4)
          p.set(Math.cos(a) * (RW - 0.03), Math.sin(a) * (RW - 0.03), zz)
          return Math.min(1, (1 - k) * 5)
        })
      }
    })

    const box = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b))
    const VIEWS = [
      [box([-1.4, 0.4, -0.6], [1.4, 2.3, 0.6]), [0.2, 0.25, 1]],
      [box([-1.9, -1.3, -0.5], [0.2, 0.6, 0.6]), [-0.35, 0.8, 1]],
      [box([-1.3, -2.4, -0.5], [1.3, 0.3, 0.6]), [0.2, 1.2, 1]],
      [box([-1.6, -2.4, -0.5], [1.3, 0.4, 0.6]), [-0.2, 1.1, 1]],
      [box([-1.6, -1.4, -0.5], [1.8, 0.4, 0.6]), [0.15, 1.0, 1]],
      [box([-2.1, -2.3, -0.5], [2.1, 1.5, 0.5]), [0.3, 0.35, 1]],
    ]

    const apply = (i, instant) => {
      const d = instant ? 0 : 0.9
      seq.stop()
      const set = (k, v, dur = d) => to(st, k, v, dur)
      set('spin', i === 0 ? 1 : 0, 0.4)
      if (i === 0) spinA = 0
      set('wrong', i === 3 ? 1 : 0, 0.6)
      set('block', i === 3 ? 1 : 0, 0)
      set('oil', i === 2 || i === 3 ? 1 : 0, 0.3)
      set('fp', 0, 0.3)
      set('coat', i >= 4 ? 1 : 0, i === 4 ? 0 : d)
      set('jy', i === 5 ? 0 : 4, instant ? 0 : 1.4)
      set('cy', 5, 0.6)
      set('film', i === 5 ? 1 : 0)
      L.oil.set(i === 3 ? 'Масло не идёт → задир, проворот' : 'Масло проходит к шейке').tone(i === 3 ? 'warn' : 'ok')
      showLabels([['work', 'back', 'tab', 'hole'], ['tab', 'notch'], ['oil', 'feed', 'hole'], ['oil', 'tab'], ['clean', 'dry'], ['film', 'num']][i])
      L.tab.set(i === 3 ? 'Усик не в пазу' : i === 1 ? 'Усик в пазу' : 'Усик').tone(i === 3 ? 'warn' : i === 1 ? 'ok' : 'accent')
      if (i === 0) {
        set('sy', 1.9)
        set('srz', 0)
      } else if (i === 1) {
        // сначала усик — в паз, потом прижать второй край
        to(st, 'sy', 1.4, 0)
        to(st, 'srz', -0.6, 0)
        if (instant) {
          to(st, 'sy', 0, 0)
          to(st, 'srz', 0, 0)
        } else {
          L.tab.set('Усик').tone('accent')
          seq.run([
            [0.3, () => to(st, 'sy', 0.25, 0.9)],
            [1.3, () => to(st, 'srz', 0, 0.8)],
            [1.3, () => to(st, 'sy', 0, 0.8)],
            [2.2, () => L.tab.set('Усик в пазу').tone('ok')],
          ])
        }
      } else {
        set('sy', 0)
        set('srz', 0)
      }
      if (i === 4) {
        L.clean.set('Пальцами — нельзя!').tone('warn')
        set('fp', 1, 0.3)
        set('coat', 0, 0)
        seq.run([
          [2.4, () => {
            to(st, 'fp', 0, 0.6)
            L.clean.set('Масло — только на рабочий слой').tone('ok')
          }],
          [2.8, () => to(st, 'coat', 1, 1.0)],
        ])
        if (instant) {
          to(st, 'fp', 0, 0)
          to(st, 'coat', 1, 0)
          L.clean.set('Масло — только на рабочий слой').tone('ok')
        }
      }
      if (i === 5) seq.run([[instant ? 0 : 1.2, () => to(st, 'cy', 0, instant ? 0 : 1.2)]])
      const [bx, dir] = VIEWS[i]
      fitBox(stage, bx, dir, { pad: 1.12, ms: instant ? 0 : 900 })
      if (instant) stage.setHome()
    }

    stage.ready()
    return stage.controller({
      setStep: (i, o) => apply(i, o?.instant),
      dispose() {
        numTex.dispose()
        fpTex.dispose()
      },
    })
  },
}
