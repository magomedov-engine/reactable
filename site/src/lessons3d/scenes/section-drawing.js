// Разрез: втулку с фланцем «режет» плоскость (отсечение рендером), срез показан цветом
// со штриховкой. Затем — сборочный узел в разрезе с позициями 1–4 и спецификацией.
// Срез: у отсечённой детали видны её внутренние (задние) грани — их красим цветом среза
// и штрихуем в экранных координатах, как на чертеже.
import { createStage, animator, THREE, PALETTE, ringY } from '../stage.js'

const STEPS = [
  { title: 'Втулка снаружи', text: 'Снаружи видна только форма. Отверстие и стенки спрятаны внутри: на обычном виде их рисуют штрихами, и читать это неудобно.' },
  { title: 'Разрезаем', text: 'Разрез — деталь мысленно «режут» плоскостью и убирают переднюю часть. Становится видно, что внутри.' },
  { title: 'Штриховка = металл', text: 'Там, где нож прошёл по металлу, ставят штриховку — косые линии под 45°. Пустое место (отверстие) не штрихуют. Сразу видно стенки и их толщину.' },
  { title: 'Сборочный чертёж', text: 'Узел тоже показывают в разрезе: видно, как детали стоят друг относительно друга. Соседние детали штрихуют в разные стороны. Болты и шайбы вдоль оси не разрезают.' },
  { title: 'Позиции и спецификация', text: 'Каждая деталь — номер на выноске. Видите «3» → в спецификации строка 3: болт М10×40, 4 штуки. Так узнают, какие детали и сколько нужно.' },
]

const SPEC = [
  ['Поз.', 'Наименование', 'Кол.'],
  ['1', 'Корпус', '1'],
  ['2', 'Крышка', '1'],
  ['3', 'Болт М10×40', '4'],
  ['4', 'Шайба 10', '4'],
]

export default {
  title: 'Разрез и сборочный чертёж',
  animated: false,
  steps: STEPS,
  mount(host) {
    const C = PALETTE
    const BUSH = new THREE.Box3(new THREE.Vector3(-1.3, -1.7, -1.7), new THREE.Vector3(1.5, 1.7, 1.7))
        const BUSH_FRONT = new THREE.Box3(new THREE.Vector3(-1.6, -1.8, 0), new THREE.Vector3(1.8, 1.8, 0))
    const ASM = new THREE.Box3(new THREE.Vector3(-2.4, -1.8, -2.2), new THREE.Vector3(2.4, 2.4, 2.2))
    const ASM_SPEC = new THREE.Box3(new THREE.Vector3(-3.3, -4.4, 0), new THREE.Vector3(3.3, 2.2, 0))
    const ASM_WIDE = new THREE.Box3(new THREE.Vector3(-3.1, -1.9, 0), new THREE.Vector3(8.9, 2.2, 0))
    const stage = createStage(host, { position: [6, 4.2, 8.5], target: [0, 0, 0], fov: 30, fit: BUSH, pad: 1.05 })
    const to = animator(stage)
    const { root } = stage
    const timers = []
    const later = (fn, ms) => timers.push(setTimeout(fn, ms))
    const clearTimers = () => timers.splice(0).forEach(clearTimeout)

    // плоскость разреза: оставляем z < constant; большое значение — разреза нет
    const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 50)
    const ghostCut = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

    function hatchMat(dir) {
      const m = new THREE.MeshBasicMaterial({ color: C.section, side: THREE.BackSide, clippingPlanes: [cut], toneMapped: false })
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          float hs = mod(gl_FragCoord.x ${dir > 0 ? '+' : '-'} gl_FragCoord.y, 11.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.93, 0.90, 0.85), step(hs, 1.7) * 0.8);`,
        )
      }
      m.customProgramCacheKey = () => 'l3d-hatch' + dir
      return m
    }
    const hatchA = hatchMat(1)
    const hatchB = hatchMat(-1)
    // деталь, которую режем: лицевые грани + «срез»
    function cutMesh(geo, kind, hatch) {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(geo, stage.mat(kind, { clippingPlanes: [cut] })))
      g.add(new THREE.Mesh(geo, hatch))
      return g
    }
    // диск с отверстиями (ось Y, от y=0 до y=h)
    function holedDisc(R, h, rBore, holes, rHole) {
      const s = new THREE.Shape()
      s.absarc(0, 0, R, 0, Math.PI * 2, false)
      const add = (x, y, r) => {
        const p = new THREE.Path()
        p.absarc(x, y, r, 0, Math.PI * 2, true)
        s.holes.push(p)
      }
      if (rBore) add(0, 0, rBore)
      for (const [x, y] of holes) add(x, y, rHole)
      return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 40 }).rotateX(-Math.PI / 2)
    }

    // ================= втулка с фланцем (ось вдоль X)
    const bushGeos = [
      ringY(0.5, 0.9, 1.8, 64).translate(0, -0.1, 0),
      holedDisc(1.6, 0.4, 0.5, [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]], 0.17).translate(0, 0.8, 0),
    ]
    const bush = new THREE.Group()
    bush.rotation.z = -Math.PI / 2
    for (const g of bushGeos) bush.add(cutMesh(g, 'steel', hatchA))
    root.add(bush)
    // отрезанная половина уезжает к зрителю
    const ghostMat = stage.mat('steel', { clippingPlanes: [ghostCut], transparent: true, opacity: 0 })
    const ghost = new THREE.Group()
    ghost.rotation.z = -Math.PI / 2
    for (const g of bushGeos) ghost.add(new THREE.Mesh(g, ghostMat))
    root.add(ghost)
    // «нож» — секущая плоскость
    const knifeMat = new THREE.MeshBasicMaterial({ color: C.mark, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
    const knife = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), knifeMat)
    const knifeEdge = new THREE.LineSegments(new THREE.EdgesGeometry(knife.geometry), new THREE.LineBasicMaterial({ color: C.mark }))
    knife.add(knifeEdge)
    root.add(knife)

    // ================= сборочный узел (ось Y): корпус 1, крышка 2, болты 3, шайбы 4
    const asm = new THREE.Group()
    const BOLTS = [[1.45, 0], [-1.45, 0], [0, 1.45], [0, -1.45]]
    const housing = cutMesh(holedDisc(2.0, 1.6, 0.8, BOLTS, 0.14).translate(0, -1.6, 0), 'iron', hatchA)
    const cover = new THREE.Group()
    cover.add(cutMesh(holedDisc(2.0, 0.4, 0.45, BOLTS, 0.16), 'steelDark', hatchB))
    cover.add(cutMesh(ringY(0.45, 0.79, 0.36, 64).translate(0, -0.18, 0), 'steelDark', hatchB))
    const boltMat = stage.mat('steel', { emissive: new THREE.Color(C.mark), emissiveIntensity: 0 })
    const bolts = new THREE.Group()
    const boltGeo = new THREE.CylinderGeometry(0.13, 0.13, 1.45, 20).translate(0, -0.33, 0)
    const headGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.2, 6).translate(0, 0.56, 0)
    const washerGeo = ringY(0.15, 0.3, 0.06, 32).translate(0, 0.43, 0)
    const washers = new THREE.Group()
    // болт перед плоскостью разреза не показываем: на чертеже виден только то, что за ней
    for (const [x, zz] of BOLTS.filter(([, zz]) => zz !== -1.45)) {
      const b = new THREE.Group()
      b.add(new THREE.Mesh(boltGeo, boltMat), new THREE.Mesh(headGeo, boltMat))
      b.position.set(x, 0, -zz)
      bolts.add(b)
      const w = stage.mesh(washerGeo, 'chrome')
      w.position.set(x, 0, -zz)
      washers.add(w)
    }
    asm.add(housing, cover, bolts, washers)
    root.add(asm)

    // выноски с номерами позиций
    const leadMat = new THREE.LineBasicMaterial({ color: C.milk, transparent: true, opacity: 0.85 })
    const leaders = new THREE.Group()
    const dotGeo = new THREE.SphereGeometry(0.045, 10, 8)
    const dotMat = new THREE.MeshBasicMaterial({ color: C.milk, toneMapped: false })
    const POS = [
      ['1', [-1.0, -0.9, 0], [-2.6, -1.4, 0], 'left'],
      ['2', [-1.1, 0.22, 0], [-2.6, 1.2, 0], 'left'],
      ['3', [1.45, 0.62, 0], [2.5, 1.7, 0], 'right'],
      ['4', [1.75, 0.45, 0], [2.5, 0.75, 0], 'right'],
    ]
    const posLabels = POS.map(([n, a, b, side]) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)])
      leaders.add(new THREE.Line(g, leadMat))
      const d = new THREE.Mesh(dotGeo, dotMat)
      d.position.set(...a)
      leaders.add(d)
      return stage.label(n, new THREE.Vector3(...b), { side, tone: 'big' })
    })
    root.add(leaders)

    // спецификация — табличка под узлом (canvas-текстура)
    const cv = document.createElement('canvas')
    cv.width = 1024
    cv.height = 340
    const specTex = new THREE.CanvasTexture(cv)
    specTex.colorSpace = THREE.SRGBColorSpace
    specTex.anisotropy = stage.renderer.capabilities.getMaxAnisotropy()
    function drawSpec(hi) {
      const g = cv.getContext('2d')
      g.fillStyle = C.milk
      g.fillRect(0, 0, cv.width, cv.height)
      const rh = 64, top = 10, cols = [10, 150, 860, 1014]
      for (let r = 0; r < SPEC.length; r++) {
        const y = top + r * rh
        if (r === hi) {
          g.fillStyle = 'rgba(176, 88, 74, 0.28)'
          g.fillRect(cols[0], y, cols[3] - cols[0], rh)
        }
        g.fillStyle = C.graphite
        g.font = `${r === 0 ? 600 : 500} 38px Arial, sans-serif`
        g.textBaseline = 'middle'
        g.textAlign = 'center'
        g.fillText(SPEC[r][0], (cols[0] + cols[1]) / 2, y + rh / 2 + 2)
        g.textAlign = 'left'
        g.fillText(SPEC[r][1], cols[1] + 22, y + rh / 2 + 2)
        g.textAlign = 'center'
        g.fillText(SPEC[r][2], (cols[2] + cols[3]) / 2, y + rh / 2 + 2)
      }
      g.strokeStyle = C.graphite
      g.lineWidth = 3
      g.strokeRect(cols[0], top, cols[3] - cols[0], rh * SPEC.length)
      for (let r = 1; r < SPEC.length; r++) {
        g.beginPath()
        g.moveTo(cols[0], top + r * rh)
        g.lineTo(cols[3], top + r * rh)
        g.stroke()
      }
      for (const x of [cols[1], cols[2]]) {
        g.beginPath()
        g.moveTo(x, top)
        g.lineTo(x, top + rh * SPEC.length)
        g.stroke()
      }
      specTex.needsUpdate = true
    }
    drawSpec(-1)
    const specMat = new THREE.MeshBasicMaterial({ map: specTex, transparent: true, opacity: 0, toneMapped: false })
    const spec = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4 * (340 / 1024)), specMat)
    spec.position.set(0, -3.3, 0.6)
    root.add(spec)

    // ---------- подписи
    const lBush = stage.label('Втулка', new THREE.Vector3(0.2, 1.0, 0), { side: 'top' })
    const lMetal = stage.label('Металл: штриховка', new THREE.Vector3(-0.4, 0.72, 0), { side: 'left', tone: 'accent' })
    const lVoid = stage.label('Пусто: отверстие', new THREE.Vector3(-0.85, 0, 0), { side: 'left' })
    const lKnife = stage.label('Секущая плоскость', knife, { offset: [1.6, 2.1, 0], side: 'right' })

    const state = { asm: 1, ghostZ: 0, knifeY: 3.2, hl: 0, spin: 0 }
    stage.onFrame((dt, t) => {
      ghost.position.z = state.ghostZ
      ghost.visible = ghostMat.opacity > 0.01
      knife.position.y = state.knifeY
      knife.visible = knifeMat.opacity > 0.01
      lKnife.show(knife.visible)
      cover.position.y = (1 - state.asm) * 1.6
      washers.position.y = (1 - state.asm) * 2.4
      bolts.position.y = (1 - state.asm) * 3.4
      boltMat.emissiveIntensity = state.hl * (0.35 + 0.3 * Math.sin(t * 5))
      spec.visible = specMat.opacity > 0.01
    })

    let cur = { box: BUSH, dir: [0.75, 0.5, 1] }
    const view = (box, dir, ms, pad = 1.04) => {
      cur = { box, dir, pad }
      stage.fit(box, { dir, pad, ms })
    }
    const apply = (i, instant) => {
      clearTimers()
      const k = instant ? 0 : 1
      const ms = instant ? 0 : 1000
      const isBush = i <= 2
      bush.visible = isBush
      asm.visible = !isBush
      leaders.visible = i === 4
      posLabels.forEach((l) => l.show(i === 4))
      lBush.show(i === 0)
      lMetal.show(i === 2)
      lVoid.show(i === 2)
      to(specMat, 'opacity', i === 4 ? 1 : 0, 0.6 * k)
      drawSpec(i === 4 ? 3 : -1)
      to(state, 'hl', i === 4 ? 1 : 0, 0.4 * k)
      to(knifeMat, 'opacity', 0, 0.3 * k)
      to(ghostMat, 'opacity', 0, 0.3 * k)

      if (i === 0) {
        cut.constant = 50
        view(BUSH, [0.75, 0.5, 1], ms)
      } else if (i === 1) {
        view(BUSH, [0.85, 0.45, 1], ms)
        if (instant) cut.constant = 0
        else {
          // нож опускается, потом передняя половина отъезжает и тает
          cut.constant = 50
          state.knifeY = 3.2
          to(knifeMat, 'opacity', 0.3, 0.3)
          to(state, 'knifeY', 0, 1.0)
          later(() => {
            cut.constant = 0
            state.ghostZ = 0
            ghostMat.opacity = 0.9
            to(state, 'ghostZ', 2.4, 1.3)
            to(ghostMat, 'opacity', 0, 1.6)
            to(knifeMat, 'opacity', 0, 1.2)
          }, 1100)
        }
      } else if (i === 2) {
        cut.constant = 0
        view(BUSH_FRONT, [0.1, 0.12, 1], ms)
      } else {
        cut.constant = 0
        if (i === 3 && !instant) {
          state.asm = 0
          to(state, 'asm', 1, 1.6)
        } else state.asm = 1
        if (i === 3) view(ASM, [0.35, 0.55, 1], ms)
        else {
          // широкий блок — табличка справа, узкий (телефон) — под узлом
          const wide = stage.camera.aspect > 1.25
          spec.scale.setScalar(wide ? 0.8 : 1)
          spec.position.set(wide ? 6.2 : 0, wide ? 0.1 : -3.3, 0.6)
          view(wide ? ASM_WIDE : ASM_SPEC, [0.02, 0.06, 1], ms, wide ? 0.88 : 0.98)
        }
      }
    }

    stage.ready()
    return stage.controller({
      setStep: (i, o) => apply(i, o?.instant),
      resetView: () => stage.fit(cur.box, { dir: cur.dir, pad: cur.pad || 1.04, ms: 700 }),
      dispose() {
        clearTimers()
        specTex.dispose()
        hatchA.dispose()
        hatchB.dispose()
      },
    })
  },
}
