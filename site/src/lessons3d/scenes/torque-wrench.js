// Щелчковый динамометрический ключ: установка момента по шкале, плавное усилие на рукоять,
// щелчок — стоп; затем доворот на угол по угломеру и метке; после работы — шкалу на минимум.
import { createStage, animator, THREE, PALETTE, cylX, cylY } from '../stage.js'
import { hexGeo, canvasTex, smooth, lerpRange, arcArrow } from './fastenersKit.js'

const STEPS = [
  { title: 'Щелчковый ключ', text: 'Квадрат с головкой надевают на болт. На трубе — основная шкала, ручка служит барабаном с мелкой шкалой. На конце ручки — стопор.' },
  { title: 'Выставить момент', text: 'Открыть стопор, вращать ручку: край барабана — на нужной цифре основной шкалы, на линии — цифра барабана. Например, 90 + 4 = 94 Н·м. Значение — только из ТК. Закрыть стопор.' },
  { title: 'Тянуть плавно', text: 'Тянуть за рукоять в отмеченном месте, под прямым углом к ключу, плавно, без рывков. Трубу на ключ не надевать.' },
  { title: 'Щелчок — сразу стоп', text: 'Ключ щёлкнул и чуть «сломался» в головке — момент достигнут. Сразу прекратить усилие, дальше не тянуть. Рывком щелчок легко пропустить.' },
  { title: 'Доворот на угол', text: 'Если ТК требует «момент + угол»: метка маркером на болте против метки на детали, затем довернуть на заданный угол (например, 90°) одним плавным движением. Контрольный проход ключом таким болтам не делают.' },
  { title: 'После работы', text: 'Ручку выкрутить на минимум шкалы (не до нуля), чтобы пружина не уставала, и убрать ключ в футляр. Откручивать динамометрическим ключом нельзя.' },
]

const AXIS_Y = 0.95
const HEAD_H = 0.42
const EDGE_MIN = 3.06 // край барабана на минимуме (ниже 50)
const EDGE_SET = 2.214 // край барабана: 90 + 4 (пример со схемы)
const TURNS = 3

export default {
  title: 'Динамометрический ключ и доворот на угол',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { fov: 30, position: [2, 4, 6], target: [1.6, 0.5, 0] })
    const to = animator(stage)
    const { root } = stage
    const textures = []

    // деталь и болт
    const plate = stage.mesh(new THREE.BoxGeometry(3.2, 0.4, 2.8), 'iron')
    plate.position.set(0.4, -0.2, 0)
    root.add(plate)
    const bolt = new THREE.Group()
    const head = stage.mesh(hexGeo(0.75, HEAD_H), 'steelDark')
    head.position.y = HEAD_H / 2
    const washerFace = stage.mesh(cylY(0.44, 0.03, 32), 'steelDark')
    washerFace.position.y = 0.015
    const boltMark = stage.mesh(new THREE.BoxGeometry(0.05, 0.01, 0.4), 'mark')
    boltMark.position.set(0, HEAD_H + 0.006, 0.2)
    bolt.add(head, washerFace, boltMark)
    root.add(bolt)
    // метка на детали (против метки на болте)
    const partMark = stage.mesh(new THREE.BoxGeometry(0.05, 0.01, 0.42), stage.mat('milk', { color: '#7fa0c4' }))
    partMark.position.set(0, 0.006, 0.95)
    root.add(partMark)

    // --- ключ: всё вращается вокруг оси болта
    const wrench = new THREE.Group()
    root.add(wrench)
    const socket = stage.mesh(cylY(0.45, 0.62, 32), 'chrome')
    socket.position.y = 0.36
    const square = stage.mesh(new THREE.BoxGeometry(0.28, 0.2, 0.28), 'steelBlack')
    square.position.y = 0.72
    wrench.add(socket, square)
    // корпус ключа отдельной группой: при щелчке он чуть «ломается» относительно головки
    const body = new THREE.Group()
    body.position.set(0, AXIS_Y, 0)
    wrench.add(body)
    const wHead = stage.mesh(cylY(0.34, 0.3, 32), 'steelBlack')
    const neck = stage.mesh(new THREE.BoxGeometry(0.7, 0.2, 0.3), 'steelBlack')
    neck.position.x = 0.45
    const tube = stage.mesh(cylX(0.12, 3.15, 24), 'chrome')
    tube.position.x = 0.75 + 3.15 / 2
    body.add(wHead, neck, tube)
    // основная шкала (через 10)
    const scaleTex = canvasTex(512, 96, (g, w, h) => {
      g.fillStyle = '#d9d3c7'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#1d1d1f'
      g.fillStyle = '#1d1d1f'
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(0, h * 0.62)
      g.lineTo(w, h * 0.62)
      g.stroke()
      g.font = '700 30px Arial'
      g.textAlign = 'center'
      // числа растут к головке ключа (влево)
      ;[50, 60, 70, 80, 90].forEach((n, i) => {
        const x = w - 40 - i * 104
        g.fillRect(x - 2, h * 0.42, 4, h * 0.4)
        g.fillText(String(n), x, h * 0.32)
      })
    })
    textures.push(scaleTex)
    const scale = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.16).rotateX(-Math.PI / 2), stage.mat('milk', { map: scaleTex, color: '#ffffff', roughness: 0.6, metalness: 0 }))
    scale.position.set(2.62, 0.125, 0)
    body.add(scale)
    // ручка = барабан (с мелкой шкалой) + резиновая рукоять + стопор
    const drumTex = canvasTex(512, 64, (g, w, h) => {
      g.fillStyle = '#cfc9bd'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#1d1d1f'
      g.font = '700 22px Arial'
      g.textAlign = 'center'
      for (let i = 0; i < 20; i++) {
        const x = (i / 20) * w
        g.fillRect(x - 1.5, 0, 3, i % 2 ? h * 0.3 : h * 0.45)
        if (i % 2 === 0) g.fillText(String((i / 2) % 10), x + 2, h * 0.82)
      }
    })
    textures.push(drumTex)
    const handle = new THREE.Group()
    body.add(handle)
    const drum = stage.mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.32, 40, 1, true).rotateZ(Math.PI / 2), stage.mat('chrome', { map: drumTex, color: '#ffffff', metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }))
    drum.position.x = 0.16
    const grip = stage.mesh(cylX(0.19, 1.1, 28), 'rubber')
    grip.position.x = 0.32 + 0.55
    const pullMark = stage.mesh(cylX(0.195, 0.12, 28), 'mark')
    pullMark.position.x = 1.05
    handle.add(drum, grip, pullMark)
    const lock = stage.mesh(cylX(0.15, 0.16, 24), 'steelBlack')
    handle.add(lock)
    const st = { edge: EDGE_MIN, lockOpen: 0, kink: 0, flash: 0, wrenchOn: 1, angle: 0, gauge: 0 }

    // стрелка усилия (в системе корпуса ключа)
    const pull = stage.arrow(new THREE.Vector3(0, 0, 0.28), new THREE.Vector3(0, 0, 1.25), PALETTE.ok, { head: 0.26, width: 0.2 })
    body.add(pull)
    // вспышка щелчка
    const flashMat = new THREE.MeshBasicMaterial({ color: PALETTE.milk, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
    const flash = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40).rotateX(-Math.PI / 2), flashMat)
    flash.position.y = AXIS_Y + 0.17
    root.add(flash)
    // стрелка вращения ручки при установке
    const turnArr = arcArrow(0.3, 0.6, -2.6, PALETTE.milk, { tube: 0.018 })
    turnArr.rotation.z = -Math.PI / 2 // ось дуги → X
    turnArr.position.set(3.75, AXIS_Y, 0)
    root.add(turnArr)

    // угломер: кольцо с делениями (0…90 по часовой), сектор угла
    const gaugeTex = canvasTex(512, 512, (g, w, h) => {
      const cx = w / 2, cy = h / 2
      g.clearRect(0, 0, w, h)
      g.fillStyle = 'rgba(236,230,218,0.16)'
      g.beginPath()
      g.arc(cx, cy, 250, 0, Math.PI * 2)
      g.arc(cx, cy, 120, 0, Math.PI * 2, true)
      g.fill()
      g.strokeStyle = '#ece6da'
      g.fillStyle = '#ece6da'
      g.font = '700 30px Arial'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      for (let d = 0; d <= 180; d += 10) {
        // мировое направление: θ = -π/2 - d (по часовой сверху); на холсте вниз = +Z мира
        const th = -Math.PI / 2 - (d * Math.PI) / 180
        const cs = Math.cos(th), sn = -Math.sin(th)
        const r0 = d % 30 ? 215 : 195
        g.lineWidth = d % 30 ? 3 : 5
        g.beginPath()
        g.moveTo(cx + cs * r0, cy + sn * r0)
        g.lineTo(cx + cs * 248, cy + sn * 248)
        g.stroke()
        if (d % 30 === 0 && d <= 90) g.fillText(`${d}°`, cx + cs * 160, cy + sn * 160)
      }
    })
    textures.push(gaugeTex)
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: gaugeTex, transparent: true, depthWrite: false, toneMapped: false }))
    gauge.position.y = 0.012
    root.add(gauge)
    const sectorMat = new THREE.MeshBasicMaterial({ color: PALETTE.mark, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    const sector = new THREE.Mesh(new THREE.BufferGeometry(), sectorMat)
    sector.position.y = 0.016
    root.add(sector)
    let sectorA = -1
    const setSector = (a) => {
      if (Math.abs(a - sectorA) < 0.004) return
      sectorA = a
      sector.geometry.dispose()
      // RingGeometry лежит в XY; после поворота θ идёт против часовой сверху → берём [-π/2 - a, -π/2]
      sector.geometry = new THREE.RingGeometry(0.5, 1.15, 24, 1, -Math.PI / 2 - a, Math.max(0.001, a)).rotateX(-Math.PI / 2)
    }

    // подписи
    const L = {
      head: stage.label('квадрат + головка', square, { offset: [0, 0.4, 0], side: 'top' }),
      scale: stage.label('основная шкала', scale, { offset: [0, 0.05, -0.05], side: 'top' }),
      drum: stage.label('ручка = барабан', drum, { offset: [0, -0.2, 0], side: 'bottom' }),
      lock: stage.label('стопор', lock, { offset: [0.1, 0.18, 0], side: 'top' }),
      value: stage.label('момент — по ТК', scale, { offset: [0, 0.05, -0.05], side: 'top', tone: 'accent' }),
      pull: stage.label('тянуть за рукоять: плавно, под 90°', pullMark, { offset: [0, 0, 1.2], side: 'right', tone: 'accent' }),
      click: stage.label('щелчок!', new THREE.Vector3(0, AXIS_Y + 0.45, 0), { side: 'top', tone: 'big' }),
      stop: stage.label('стоп, дальше не тянуть', pullMark, { offset: [0, 0, 0.5], side: 'right', tone: 'warn' }),
      angle: stage.label('', new THREE.Vector3(-1.2, 0, 0.3), { side: 'left', tone: 'accent' }),
      marks: stage.label('метка на болте против метки на детали', new THREE.Vector3(0, 0, 1.25), { side: 'bottom' }),
      min: stage.label('на минимум, не до нуля', lock, { offset: [0.1, 0.18, 0], side: 'top', tone: 'accent' }),
    }
    const SHOW = [['head', 'scale', 'drum', 'lock'], ['value'], ['pull'], ['click', 'stop'], ['angle', 'marks'], ['min']]

    const pA = new THREE.Vector3(), pB = new THREE.Vector3()
    let step = 0, t = 0
    const HOLD = [0, 4.2, 2.8, 2.4, 3.6, 3]
    const PULL_MAX = -0.42
    stage.onFrame((dt) => {
      if (stage.playing) t += dt
      let edge = st.edge, rotDrum = 0, lockOpen = 0, wRot = 0, kink = 0, fl = 0, ang = 0
      if (step === 1) {
        const k = t % 6
        lockOpen = smooth(0.2, 0.7, k) * (1 - smooth(3.6, 4.1, k))
        const s = smooth(0.9, 3.4, k)
        edge = lerpRange(EDGE_MIN, EDGE_SET, s)
        rotDrum = -s * TURNS * Math.PI * 2
        turnArr.visible = k > 0.8 && k < 3.5
        L.value.set(k < 3.6 ? 'открыть стопор, вращать ручку' : 'пример: 90 + 4 = 94 Н·м, по ТК').show(true)
      } else turnArr.visible = false
      if (step === 2) {
        const k = t % 5
        wRot = PULL_MAX * 0.85 * smooth(0.3, 3.0, k)
        pull.visible = k < 3.1
      } else if (step === 3) {
        const k = t % 5
        wRot = PULL_MAX * (0.85 + 0.15 * smooth(0, 0.8, k))
        kink = smooth(0.8, 0.9, k)
        fl = k > 0.8 ? Math.max(0, 1 - (k - 0.8) / 0.7) : 0
        pull.visible = k < 0.8
        L.click.show(k > 0.8 && k < 2.4)
        L.stop.show(k > 0.8)
      } else pull.visible = step === 2 && pull.visible
      if (step === 4) {
        const k = t % 6
        ang = (Math.PI / 2) * smooth(0.8, 3.4, k)
        const deg = Math.round((ang * 180) / Math.PI)
        L.angle.set(deg >= 90 ? 'довернули на 90° (пример)' : `доворот: ${deg}°`)
      }
      if (step === 5) {
        const k = t % 5
        const s = 1 - smooth(0.4, 2.6, k)
        edge = lerpRange(EDGE_MIN, EDGE_SET, s)
        rotDrum = -s * TURNS * Math.PI * 2
      }
      if (step >= 1 && step <= 3) edge = step === 1 ? edge : EDGE_SET
      handle.position.x = edge
      pA.set(edge + 1.05, 0, 0.28)
      pB.set(edge + 1.05, 0, 1.25)
      pull.set(pA, pB)
      handle.rotation.x = step === 1 || step === 5 ? rotDrum : 0
      lock.position.x = 1.42 + 0.08 + lockOpen * 0.14
      lock.material = stage.mat(lockOpen > 0.5 ? 'ok' : 'steelBlack')
      wrench.rotation.y = wRot
      body.rotation.y = kink * -0.06
      bolt.rotation.y = step === 4 || step === 5 ? -ang : wRot
      flashMat.opacity = fl
      flash.scale.setScalar(1 + (1 - fl) * 1.6)
      flash.visible = fl > 0.01
      flash.rotation.y = wRot
      wrench.visible = step !== 4
      gauge.visible = sector.visible = step === 4
      boltMark.visible = partMark.visible = step === 4
      setSector(ang)
    })

    const VIEW = [
      { box: [[-0.6, 0, -0.6], [4.6, 1.4, 0.6]], dir: [0.15, 0.75, 1] },
      { box: [[1.9, 0.6, -0.4], [4.6, 1.3, 0.4]], dir: [0.1, 0.9, 1] },
      { box: [[-0.6, 0, -0.6], [4.6, 1.4, 1.6]], dir: [0.1, 1.1, 1] },
      { box: [[-0.6, 0, -0.6], [4.6, 1.4, 1.6]], dir: [0.1, 1.1, 1] },
      { box: [[-1.3, 0, -1.3], [1.3, 0.5, 1.3]], dir: [0, 1.5, 1] },
      { box: [[0.5, 0.5, -0.5], [4.6, 1.3, 0.5]], dir: [0.1, 0.8, 1] },
    ]
    const apply = (i, instant) => {
      step = i
      t = stage.playing ? 0 : HOLD[i]
      for (const [n, l] of Object.entries(L)) l.show(SHOW[i].includes(n))
      const v = VIEW[i]
      stage.fit(new THREE.Box3(new THREE.Vector3(...v.box[0]), new THREE.Vector3(...v.box[1])), { dir: v.dir, pad: 0.82, ms: instant ? 0 : 900 })
      if (instant) stage.setHome()
      to(st, 'edge', i === 0 ? EDGE_MIN : EDGE_SET, 0)
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
