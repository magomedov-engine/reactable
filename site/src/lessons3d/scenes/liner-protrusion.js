// Выступание бурта гильзы над плоскостью блока и его замер индикатором на мостике.
// Выступание в реальности — доли миллиметра; здесь сильно увеличено.
import { createStage, animator, THREE, PALETTE, lathe, cylY, cylZ } from '../stage.js'
import { canvasTexture, sequencer, halfPlate, halfPlateSection, halfLathe, lathe2Section, fitBox } from './ep-kit.js'

const STEPS = [
  { title: 'Бурт чуть выше блока', text: 'Верхний бурт гильзы немного выступает над плоскостью блока. В жизни это доли миллиметра (точное значение — по ТК), здесь масштаб сильно увеличен.' },
  { title: 'Зачем это нужно', text: 'Головка через прокладку прижимает в первую очередь бурт. Так гильза зажата, а газы и жидкость не проходят под прокладкой.' },
  { title: 'Ноль на блоке', text: 'Индикатор на мостике. Мостик стоит ножками на плоскости блока, наконечник индикатора — тоже на блоке. Шкалу поворачивают так, чтобы стрелка встала на «0».' },
  { title: 'Замер на бурте', text: 'Мостик сдвигают, чтобы наконечник встал на бурт гильзы. Стрелка отклонилась — это и есть выступание. Часто гильзу перед замером прижимают приспособлением — смотрите ТК.' },
  { title: 'Несколько точек', text: 'Мерят в нескольких точках по кругу каждой гильзы, каждый раз заново выставляя ноль на блоке. Каждое показание записывают в карту.' },
  { title: 'Сравнить с ТК', text: 'Мало или ниже блока — гильза не прижата: прорыв газов, жидкость в цилиндре. Много — перекос головки, может треснуть бурт или прокладка. Не в допуске — стоп, сообщить мастеру, не «подгонять».' },
]

const P = 0.12 // выступание (увеличено)
const RC = 1.4 // радиус бурта

export default {
  title: 'Выступание гильзы',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [2, 2.5, 7], target: [0, 0, 0], fov: 30 })
    const to = animator(stage)
    const seq = sequencer(stage)
    const { root } = stage

    // плита W×D с круглым отверстием r, толщина y0..y1
    const plate = (r, y0, y1) => {
      const sh = new THREE.Shape()
      sh.moveTo(-3.2, -2.6)
      sh.lineTo(3.2, -2.6)
      sh.lineTo(3.2, 2.6)
      sh.lineTo(-3.2, 2.6)
      sh.closePath()
      if (r > 0) {
        const h = new THREE.Path()
        h.absarc(0, 0, r, 0, Math.PI * 2, true)
        sh.holes.push(h)
      }
      const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 64 })
      g.rotateX(-Math.PI / 2)
      g.translate(0, y0, 0)
      return g
    }
    const cutBlock = stage.mat('mark', { color: PALETTE.section, side: THREE.DoubleSide, roughness: 0.8, metalness: 0.1 })
    const cutSteel = stage.mat('steelDark', { side: THREE.DoubleSide, color: '#9c988f', roughness: 0.7, metalness: 0.3 })
    // целиком (для замеров) и в разрезе (чтобы было видно уступ)
    const full = new THREE.Group()
    const cut = new THREE.Group()
    root.add(full, cut)
    const DECK = [[RC + 0.02, -0.3, 0], [1.2, -1.0, -0.3]]
    for (const [r, y0, y1] of DECK) {
      full.add(stage.mesh(plate(r, y0, y1), 'iron'))
      cut.add(stage.mesh(halfPlate(3.2, 2.6, r, y0, y1), 'iron'))
      cut.add(new THREE.Mesh(halfPlateSection(3.2, r, y0, y1), cutBlock))
    }

    // ---------- гильза: бурт + труба
    const LINER = [[1.0, -1.2], [1.18, -1.2], [1.18, -0.3], [RC, -0.3], [RC, P], [1.0, P], [1.0, -1.2]]
    const liner = new THREE.Group()
    const collarMat = stage.mat('steel', {})
    const linerFull = new THREE.Mesh(lathe(LINER, 72), collarMat)
    const dark = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48).rotateX(-Math.PI / 2), stage.mat('rubber', { color: '#1b1b1d' }))
    dark.position.y = -1.0
    linerFull.add(dark)
    const linerCut = new THREE.Group()
    linerCut.add(new THREE.Mesh(halfLathe(LINER, 56), collarMat), new THREE.Mesh(lathe2Section(LINER), cutSteel))
    liner.add(linerFull, linerCut)
    root.add(liner)
    // размерная планка «выступание» (в разрезе)
    const dim = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1, 0.03), new THREE.MeshBasicMaterial({ color: PALETTE.ok, toneMapped: false }))
    dim.position.set(RC + 0.2, 0, 0.02)
    root.add(dim)
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: PALETTE.milk, toneMapped: false }))
    tick.position.set(RC + 0.05, 0, 0.02)
    root.add(tick)

    // ---------- прокладка и головка (шаг «зачем»), в разрезе
    const top = new THREE.Group()
    top.add(stage.mesh(halfPlate(3.2, 2.6, 1.02, 0, 0.07), 'steelBlack'))
    top.add(new THREE.Mesh(halfPlateSection(3.2, 1.02, 0, 0.07), stage.mat('steel', { side: THREE.DoubleSide })))
    const headMat = stage.mat('ironDark', {})
    top.add(new THREE.Mesh(halfPlate(3.2, 2.6, 0, 0.07, 1.0), headMat))
    top.add(new THREE.Mesh(halfPlateSection(3.2, 0, 0.07, 1.0), stage.mat('mark', { color: '#8a5040', side: THREE.DoubleSide, roughness: 0.8 })))
    root.add(top)
    const press = [-1.2, 1.2].map((x) => {
      const a = stage.arrow(new THREE.Vector3(x, 2.6, -0.3), new THREE.Vector3(x, 1.8, -0.3), PALETTE.milk, { head: 0.22, width: 0.16 })
      root.add(a)
      return a
    })

    // ---------- мостик с индикатором
    const pivot = new THREE.Group() // поворот вокруг оси гильзы
    const rig = new THREE.Group() // радиальный сдвиг (по локальной X)
    pivot.add(rig)
    root.add(pivot)
    const bar = stage.mesh(new THREE.BoxGeometry(0.2, 0.16, 2.7), 'steelDark')
    bar.position.y = 0.9
    rig.add(bar)
    for (const z of [-1.15, 1.15]) {
      const f = stage.mesh(new THREE.BoxGeometry(0.2, 0.82, 0.2), 'steelDark')
      f.position.set(0, 0.41, z)
      rig.add(f)
      const pad = stage.mesh(cylY(0.13, 0.06, 16), 'steelBlack')
      pad.position.set(0, 0.03, z)
      rig.add(pad)
    }
    // ствол индикатора и подвижный шток
    const sleeve = stage.mesh(cylY(0.06, 0.7, 16), 'chrome')
    sleeve.position.y = 1.15
    rig.add(sleeve)
    const plunger = new THREE.Group()
    const rod = stage.mesh(cylY(0.028, 0.75, 10), 'chrome')
    rod.position.y = 0.375
    const tip = stage.mesh(new THREE.SphereGeometry(0.055, 14, 10), 'steelBlack')
    plunger.add(rod, tip)
    rig.add(plunger)
    // корпус-циферблат, наклонён к зрителю
    const dialHolder = new THREE.Group()
    dialHolder.position.y = 1.85
    dialHolder.rotation.y = Math.PI / 2
    rig.add(dialHolder)
    const dial = new THREE.Group()
    dial.rotation.x = -0.55
    dialHolder.add(dial)
    const body = stage.mesh(cylZ(0.5, 0.2, 40), 'steel')
    dial.add(body)
    const tex = canvasTexture(256, 256, (g, w) => {
      g.fillStyle = '#ece6da'
      g.beginPath()
      g.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#141517'
      g.fillStyle = '#141517'
      g.translate(w / 2, w / 2)
      g.font = 'bold 22px monospace'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      for (let i = 0; i < 100; i++) {
        const a = (i / 100) * Math.PI * 2
        const long = i % 10 === 0, mid = i % 5 === 0
        g.lineWidth = long ? 3 : 1.5
        const r0 = long ? 96 : mid ? 104 : 110
        g.beginPath()
        g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0)
        g.lineTo(Math.sin(a) * 122, -Math.cos(a) * 122)
        g.stroke()
        if (long) {
          g.fillStyle = i === 0 ? '#b0584a' : '#141517'
          g.fillText(String(i), Math.sin(a) * 74, -Math.cos(a) * 74)
        }
      }
    })
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.44, 48), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
    face.position.z = 0.101
    dial.add(face)
    const rim = stage.mesh(new THREE.TorusGeometry(0.46, 0.035, 8, 40), 'chrome')
    rim.position.z = 0.1
    dial.add(rim)
    const needleGeo = new THREE.BoxGeometry(0.02, 0.38, 0.01).translate(0, 0.15, 0)
    const needle = new THREE.Mesh(needleGeo, new THREE.MeshBasicMaterial({ color: '#b0584a', toneMapped: false }))
    needle.position.z = 0.115
    dial.add(needle)
    const hub = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: '#141517' }))
    hub.position.z = 0.12
    dial.add(hub)

    // метки замеренных точек на бурте
    const POINTS = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]
    const marks = POINTS.map((phi) => {
      const m = stage.mesh(cylY(0.06, 0.02, 12), 'mark')
      m.position.set(1.2 * Math.cos(phi), P + 0.01, -1.2 * Math.sin(phi))
      m.visible = false
      root.add(m)
      return m
    })

    // ---------- подписи
    const L = {
      deck: stage.label('Плоскость блока', new THREE.Vector3(2.5, 0, -1.4), { side: 'top' }),
      deckF: stage.label('Плоскость блока', new THREE.Vector3(-2.4, 0, 1.6), { side: 'bottom' }),
      collar: stage.label('Бурт гильзы', new THREE.Vector3(1.15, P, 0), { side: 'top', tone: 'accent' }),
      protr: stage.label('Выступание', dim, { side: 'right', offset: [0.03, 0, 0] }),
      gasket: stage.label('Прокладка прижимает бурт', top, { side: 'top', offset: [1.4, 1.0, 0] }),
      read: stage.label('', tip, { side: 'right', tone: 'accent', offset: [0, 0, 0] }),
      tk: stage.label('', new THREE.Vector3(1.0, 0.45, 0), { side: 'top', tone: 'big' }),
    }
    const showLabels = (keys) => Object.entries(L).forEach(([k, l]) => l.show(keys.includes(k)))

    // ---------- состояние
    const st = { cut: 1, topY: 2.5, topVis: 0, press: 0, rig: 0, phi: -Math.PI / 2, s: 1.95, lift: 0, bezel: 0, collarH: P, tint: 0, tintBad: 0 }
    const PRELOAD = 0.9, K = 1.7 / P
    const okC = new THREE.Color(PALETTE.ok), badC = new THREE.Color(PALETTE.bad), baseC = new THREE.Color(PALETTE.steel)
    let follow = false
    const camDir = new THREE.Vector3()

    stage.onFrame((dt, t) => {
      liner.position.y = st.collarH - P
      top.visible = st.topVis > 0.02
      top.position.y = st.topY + st.collarH
      full.visible = linerFull.visible = st.cut < 0.5
      cut.visible = linerCut.visible = st.cut > 0.5
      dim.visible = tick.visible = st.cut > 0.5 && st.topVis < 0.5
      dim.scale.y = Math.max(0.005, Math.abs(st.collarH))
      dim.position.y = st.collarH / 2
      press.forEach((a, i) => {
        a.visible = st.press > 0.05
        a.position.y = 2.6 + st.topY + Math.sin(t * 3 + i) * 0.05
      })
      pivot.visible = st.rig > 0.02
      pivot.rotation.y = st.phi
      rig.position.set(st.s, st.lift, 0)
      // наконечник: на блоке y = 0, на бурте y = высота бурта
      const k = THREE.MathUtils.smoothstep(st.s, RC - 0.05, RC + 0.05)
      const tipY = st.lift > 0.01 ? 0 : (1 - k) * st.collarH
      plunger.position.y = tipY + 0.055
      tip.position.y = 0
      needle.rotation.z = -(PRELOAD + tipY * K) - (st.lift > 0.01 ? -0.3 * st.lift : 0)
      face.rotation.z = -st.bezel
      const c = baseC.clone().lerp(okC, st.tint).lerp(badC, st.tintBad)
      collarMat.color.copy(c)
      if (follow && pivot.visible) {
        camDir.set(Math.cos(st.phi), 0, -Math.sin(st.phi))
        const far = Math.max(1, 1.7 / stage.camera.aspect)
        const tgt = camDir.clone().multiplyScalar(0.5).setY(0.7)
        const pos = camDir.clone().multiplyScalar(7.6 * far).setY(1 + 4.6 * far)
        stage.camera.position.lerp(pos, Math.min(1, dt * 2.5))
        stage.controls.target.lerp(tgt, Math.min(1, dt * 2.5))
      }
    })

    const box = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b))
    const VIEWS = [
      [box([0.6, -0.6, -0.2], [2.5, 0.5, 0]), [0.12, 0.15, 1]],
      [box([-1.5, -0.6, -0.2], [2.1, 1.3, 0]), [0.15, 0.2, 1]],
      [box([-1.4, -0.2, 0.6], [1.4, 2.4, 2.4]), [0.45, 0.45, 1]],
      [box([-1.4, -0.2, 0.6], [1.4, 2.4, 2.4]), [0.45, 0.45, 1]],
      null,
      [box([0.6, -0.6, -0.2], [2.5, 0.6, 0]), [0.12, 0.15, 1]],
    ]

    const zeroThenCollar = (t0, idx) => [
      [t0, () => {
        to(st, 'lift', 0.35, 0.5)
        to(st, 'bezel', PRELOAD - 0.4, 0.5)
        L.read.set('Переставить мостик').tone('')
      }],
      [t0 + 0.5, () => {
        to(st, 'phi', POINTS[idx], 0.9)
        to(st, 's', 1.95, 0.6)
      }],
      [t0 + 1.5, () => to(st, 'lift', 0, 0.4)],
      [t0 + 2.0, () => {
        to(st, 'bezel', PRELOAD, 0.5)
        L.read.set('Ноль на блоке').tone('')
      }],
      [t0 + 2.8, () => to(st, 's', 1.2, 0.8)],
      [t0 + 3.7, () => {
        marks[idx].visible = true
        L.read.set(`Точка ${idx + 1}: записать в карту`).tone('accent')
      }],
    ]

    const apply = (i, instant) => {
      const d = instant ? 0 : 0.9
      seq.stop()
      follow = false
      const set = (k, v, dur = d) => to(st, k, v, dur)
      set('topY', i === 1 ? 0 : 2.5, instant ? 0 : 1.2)
      set('topVis', i === 1 ? 1 : 0, i === 1 ? 0.3 : 0.4)
      set('press', i === 1 ? 1 : 0, 0.3)
      set('rig', i >= 2 && i <= 4 ? 1 : 0, 0)
      set('cut', i >= 2 && i <= 4 ? 0 : 1, 0)
      set('collarH', P, 0.5)
      set('tint', 0, 0.4)
      set('tintBad', 0, 0.4)
      set('lift', 0, 0.3)
      marks.forEach((m) => (m.visible = false))
      showLabels([['deck', 'collar', 'protr'], ['collar', 'gasket'], ['deckF', 'read'], ['read'], ['read'], ['tk', 'deck', 'collar']][i])
      if (i === 2) {
        set('phi', POINTS[0], d)
        set('s', 1.95, d)
        set('bezel', 0, 0)
        L.read.set('Наконечник на блоке').tone('')
        seq.run([[1.0, () => {
          to(st, 'bezel', PRELOAD, 0.8)
          L.read.set('Шкалу на «0»').tone('accent')
        }]])
      } else if (i === 3) {
        set('phi', POINTS[0], d)
        set('bezel', PRELOAD, d)
        set('s', 1.95, 0)
        L.read.set('Ноль на блоке').tone('')
        seq.run([
          [0.6, () => to(st, 's', 1.2, 1.0)],
          [1.7, () => L.read.set('Показание = выступание').tone('accent')],
        ], 0)
      } else if (i === 4) {
        follow = true
        set('bezel', PRELOAD, 0)
        let ev = []
        POINTS.forEach((_, k) => (ev = ev.concat(zeroThenCollar(k * 4.4, k))))
        ev.push([17.6, () => marks.forEach((m) => (m.visible = false))])
        seq.run(ev, 17.7)
      } else if (i === 5) {
        const lvl = (h, txt, ok) => () => {
          to(st, 'collarH', h, 0.8)
          to(st, 'tint', ok ? 1 : 0, 0.5)
          to(st, 'tintBad', ok ? 0 : 1, 0.5)
          L.tk.set(txt).tone(ok ? 'ok' : 'warn')
        }
        lvl(P, 'В допуске ТК — записать', true)()
        seq.run([[2.6, lvl(-0.05, 'Мало: гильза не прижата', false)], [5.2, lvl(P * 2.4, 'Много: перекос, трещина бурта', false)], [7.8, lvl(P, 'В допуске ТК — записать', true)]], 10.4)
      }
      if (VIEWS[i]) {
        const [bx, dir] = VIEWS[i]
        fitBox(stage, bx, dir, { pad: 1.12, ms: instant ? 0 : 900 })
      }
      if (instant) stage.setHome()
    }

    stage.ready()
    return stage.controller({
      setStep: (i, o) => apply(i, o?.instant),
      dispose() {
        tex.dispose()
      },
    })
  },
}

