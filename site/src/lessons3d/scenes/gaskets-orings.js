// Прокладка между фланцами (течь без затяжки, затяжка крест-накрест, чистка, новая прокладка)
// и резиновое кольцо в канавке (сжатие сечения, смазка, скрученное/порезанное — течь).
import { createStage, THREE, PALETTE, cylY } from '../stage.js'
import { cutRing, sectionMat, arc, ph, saw } from './joints-kit.js'

const STEPS = [
  { title: 'Без затяжки — течёт', text: 'Между фланцами стоит прокладка. Пока болты не затянуты, остаются щели: жидкость под давлением находит путь через неровности поверхностей.' },
  { title: 'Затяжка по ТК', text: 'Болты тянут крест-накрест, в порядке и с моментом по ТК. Мягкая прокладка сжимается и заполняет неровности обеих деталей — щелей нет, сухо. Перетянуть тоже нельзя: прокладку выдавит или порвёт.' },
  { title: 'Чистые поверхности', text: 'Старую прокладку и герметик снимают пластиковым скребком или средством из ТК. Отвёрткой и наждаком нельзя: царапина поперёк уплотнения — готовый канал для течи.' },
  { title: 'Только новая прокладка', text: 'Старая прокладка уже смята «под чужие» неровности и второй раз не уплотнит. Ставят новую, с номером по ТК, и проверяют, что все отверстия совпали.' },
  { title: 'Резиновое кольцо', text: 'Кольцо лежит в канавке и при сборке сжимается: круглое сечение сплющивается и закрывает щель. Перед установкой его смазывают тем, что указано в ТК, и не растягивают сильнее нужного.' },
  { title: 'Скрутили или порезали — течь', text: 'Скрученное кольцо видно по спиральной линии, порезанное — по надрезу (протащили по резьбе или острой кромке). Такое кольцо течёт: снять и поставить новое.' },
]

const B = (x0, y0, x1, y1, z = 2.0) => new THREE.Box3(new THREE.Vector3(x0, y0, -z), new THREE.Vector3(x1, y1, z))
const FRAMES = [B(-2, -1.6, 2, 1.9), B(-2, -1.6, 2, 1.9), B(-2.4, -0.8, 2.6, 2.2), B(-2.2, -0.8, 4.2, 2.2), B(-2.2, -1.8, 2.2, 3.4, 2.2), B(-2.2, -1.8, 2.2, 1.8, 2.2)]

export default {
  title: 'Прокладки и резиновые кольца',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [4.6, 4.2, 6.6], target: [0, 0, 0], fov: 30, fit: FRAMES[0], pad: 1.0 })
    const { root } = stage
    const sec = sectionMat(stage)
    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3()

    // ================= А. Фланцевый стык
    const A = new THREE.Group()
    root.add(A)
    const BOLTS = [[-1.1, 1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, -1.1]] // порядок затяжки крест-накрест
    function plate(w, holeR, boltR) {
      const s = new THREE.Shape()
      s.moveTo(-w / 2, -w / 2); s.lineTo(w / 2, -w / 2); s.lineTo(w / 2, w / 2); s.lineTo(-w / 2, w / 2); s.closePath()
      s.holes.push(new THREE.Path().absarc(0, 0, holeR, 0, Math.PI * 2, true))
      for (const [x, z] of BOLTS) s.holes.push(new THREE.Path().absarc(x, -z, boltR, 0, Math.PI * 2, true))
      return s
    }
    const flangeGeo = new THREE.ExtrudeGeometry(plate(3.2, 0.62, 0.2), { depth: 0.5, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2)
    const low = new THREE.Group()
    const lowF = stage.mesh(flangeGeo, 'iron')
    lowF.position.y = -0.5
    const lowP = stage.mesh(ringY(0.62, 0.8, 1.5), 'iron')
    lowP.position.y = -1.25
    low.add(lowF, lowP)
    const up = new THREE.Group()
    const upF = stage.mesh(flangeGeo, 'iron')
    const upP = stage.mesh(ringY(0.62, 0.8, 1.5), 'iron')
    upP.position.y = 1.25
    up.add(upF, upP)
    A.add(low, up)
    const gasketGeo = new THREE.ExtrudeGeometry(plate(3.2, 0.66, 0.22), { depth: 1, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2)
    const newMat = stage.mat('milk', { color: '#b9b29c', roughness: 0.9, metalness: 0 })
    const oldMat = stage.mat('milk', { color: '#5d5141', roughness: 0.95, metalness: 0 })
    const gasket = new THREE.Mesh(gasketGeo, newMat)
    const oldGasket = new THREE.Mesh(gasketGeo, oldMat)
    A.add(gasket, oldGasket)
    // болты: головка снизу, гайка сверху
    const boltGroups = []
    const nuts = BOLTS.map(([x, z]) => {
      const b = new THREE.Group()
      const sh = stage.mesh(cylY(0.17, 1.9, 16), 'steelBlack')
      sh.position.y = 0.15
      const head = stage.mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 6), 'steelBlack')
      head.position.y = -0.61
      b.add(sh, head)
      b.position.set(x, 0, z)
      A.add(b)
      boltGroups.push(b)
      const nut = stage.mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.26, 6), 'steelDark')
      nut.position.set(x, 0.8, z)
      A.add(nut)
      return nut
    })
    // остатки старой прокладки на нижнем фланце
    const dirtMat = stage.mat('milk', { color: '#4a3f33', roughness: 1, metalness: 0, transparent: true })
    const dirt = []
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Shape()
      const n = 6
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2
        const r = 0.16 + 0.12 * Math.abs(Math.sin(i * 7.3 + k * 2.1))
        k ? s.lineTo(r * Math.cos(a), r * Math.sin(a)) : s.moveTo(r * Math.cos(a), r * Math.sin(a))
      }
      const m = new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), dirtMat)
      const a = (i / 9) * Math.PI * 2 + 0.3
      const r = i % 2 ? 1.05 : 0.9
      m.position.set(r * Math.cos(a), 0.004, r * Math.sin(a))
      A.add(m)
      dirt.push(m)
    }
    const scraper = new THREE.Group()
    const blade = stage.mesh(new THREE.BoxGeometry(0.08, 0.5, 1.3), stage.mat('milk', { color: '#d6cdb8' }))
    blade.position.y = 0.25
    const sHandle = stage.mesh(new THREE.BoxGeometry(0.16, 1.2, 0.32), stage.mat('ok', { color: '#6f8a5a' }))
    sHandle.position.y = 1.0
    scraper.add(blade, sHandle)
    scraper.rotation.z = 0.55
    A.add(scraper)
    // капли течи из щели
    const NDROP = 10
    const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), stage.mat('oil'), NDROP)
    root.add(drops)
    const dm = new THREE.Object3D()

    // ================= Б. Резиновое кольцо в канавке (разрез)
    const Bg = new THREE.Group()
    root.add(Bg)
    const housing = cutRing([[1.2, -1.8], [2.2, -1.8], [2.2, 0.8], [1.38, 0.8], [1.2, 0.62]], stage.mat('iron'), { secMat: sec })
    const hBottom = cutRing([[0.01, -2.1], [2.2, -2.1], [2.2, -1.8], [0.01, -1.8]], stage.mat('iron'), { secMat: sec })
    const fluidMat = stage.mat('oil', { transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide })
    const fluid = cutRing([[0.01, -1.79], [1.19, -1.79], [1.19, -0.72], [0.01, -0.72]], fluidMat, { secMat: fluidMat })
    Bg.add(housing, hBottom, fluid)
    const plug = new THREE.Group()
    plug.add(cutRing([[0.01, -0.9], [1.17, -0.9], [1.17, -0.42], [0.98, -0.42], [0.98, 0.02], [1.17, 0.02], [1.17, 0.6], [1.6, 0.6], [1.6, 1.0], [0.01, 1.0]], stage.mat('steel'), { secMat: sec }))
    Bg.add(plug)
    // кольцо: сечение — круг R 0.14, центр r 1.12, y −0.2 (в координатах пробки)
    const RC = 1.12, YC = -0.2, RA = 0.14, R0 = 0.98
    const ringMat = stage.mat('rubber', { color: '#45413d', roughness: 0.7 })
    const oring = cutRing([[RC + RA, YC], ...arc(RC, YC, RA, 0, Math.PI * 2, 20)], ringMat, { secMat: sec, seg: 64 })
    plug.add(oring)
    // спиральная линия скрученного кольца
    const helix = []
    for (let i = 0; i <= 220; i++) {
      const phi = Math.PI / 2 + (i / 220) * Math.PI * 1.5
      const psi = phi * 5
      const rr = RC + RA * 1.03 * Math.cos(psi)
      helix.push(new THREE.Vector3(rr * Math.sin(phi), YC + RA * 1.03 * Math.sin(psi), rr * Math.cos(phi)))
    }
    const twist = stage.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 400, 0.014, 5), 'bad')
    plug.add(twist)
    // надрез: красная метка на видимой части кольца
    const nick = stage.mesh(new THREE.BoxGeometry(0.12, 0.34, 0.03), 'bad')
    nick.position.set(RC + 0.09, YC, 0.0)
    plug.add(nick)
    // смазка — блестящая плёнка вокруг кольца
    const lubeMat = stage.mat('oil', { transparent: true, opacity: 0.0, depthWrite: false, emissive: PALETTE.oil, emissiveIntensity: 0.3 })
    const lube = cutRing([[RC + RA * 1.12, YC], ...arc(RC, YC, RA * 1.12, 0, Math.PI * 2, 20)], lubeMat, { seg: 64 })
    plug.add(lube)
    // деформация сечения: радиально сжать к дну канавки, по высоте раздать
    const deformables = []
    for (const g of [oring, twist, lube]) g.traverse((m) => m.isMesh && deformables.push({ m, base: m.geometry.attributes.position.array.slice() }))
    let lastSq = -1
    function squeeze(k) {
      if (Math.abs(k - lastSq) < 1e-4) return
      lastSq = k
      const sx = 1 - 0.22 * k, sy = 1 + 0.26 * k
      for (const { m, base } of deformables) {
        const pos = m.geometry.attributes.position
        const arr = pos.array
        for (let i = 0; i < arr.length; i += 3) {
          const x = base[i], y = base[i + 1], z = base[i + 2]
          const rho = Math.hypot(x, z) || 1e-6
          const rho2 = R0 + (rho - R0) * sx
          arr[i] = (x * rho2) / rho
          arr[i + 2] = (z * rho2) / rho
          arr[i + 1] = YC + (y - YC) * sy
        }
        pos.needsUpdate = true
        m.geometry.computeBoundingSphere()
      }
    }

    // ================= подписи
    const L = {
      flange: stage.label('Фланец', new THREE.Vector3(1.6, 0.75, 1.6), { side: 'right' }),
      gasket: stage.label('Прокладка', new THREE.Vector3(-1.6, 0.07, 1.6), { side: 'left', tone: 'accent' }),
      gap: stage.label('Щель', new THREE.Vector3(1.6, 0.2, 0.2), { side: 'right' }),
      leak: stage.label('✖ Течь', new THREE.Vector3(0.4, -0.9, 1.75), { side: 'right', tone: 'warn' }),
      n1: stage.label('1', nuts[0], { offset: [0, 0.2, 0], side: 'top' }),
      n2: stage.label('2', nuts[1], { offset: [0, 0.2, 0], side: 'top' }),
      n3: stage.label('3', nuts[2], { offset: [0, 0.2, 0], side: 'top' }),
      n4: stage.label('4', nuts[3], { offset: [0, 0.2, 0], side: 'top' }),
      dry: stage.label('✔ Сжата — сухо', new THREE.Vector3(-1.6, 0.05, 1.6), { side: 'left', tone: 'ok' }),
      scraper: stage.label('Пластиковый скребок', scraper, { offset: [0, 1.6, 0], side: 'top' }),
      dirt: stage.label('Остатки старой прокладки', new THREE.Vector3(0.9, 0, -0.3), { side: 'right' }),
      noScrew: stage.label('Отвёрткой нельзя', new THREE.Vector3(-1.6, 0, 1.6), { side: 'left', tone: 'warn' }),
      clean: stage.label('✔ Чисто, без царапин', new THREE.Vector3(-1.6, 0, 1.6), { side: 'left', tone: 'ok' }),
      old: stage.label('Старая: уже смята', oldGasket, { offset: [1.6, 0, 1.6], side: 'right', tone: 'warn' }),
      neu: stage.label('Новая', gasket, { offset: [1.6, 0.1, 1.6], side: 'right', tone: 'ok' }),
      oring: stage.label('Резиновое кольцо', plug, { offset: [-RC * 0.71, YC - 0.15, RC * 0.71], side: 'left' }),
      groove: stage.label('Канавка', plug, { offset: [0.98, -0.42, 0], side: 'right' }),
      lube: stage.label('Смазать по ТК', plug, { offset: [-RC * 0.71, YC + 0.12, RC * 0.71], side: 'left', tone: 'accent' }),
      squeezed: stage.label('Сечение сплющилось — щели нет', plug, { offset: [1.2, YC, 0], side: 'right', tone: 'ok' }),
      twist: stage.label('Скручено: спиральная линия', plug, { offset: [0, YC + 0.15, -RC], side: 'top', tone: 'warn' }),
      nick: stage.label('Порез', nick, { offset: [0, 0, 0], side: 'left', tone: 'warn' }),
      leak2: stage.label('✖ Течь', new THREE.Vector3(1.4, 0.8, 1.4), { side: 'right', tone: 'warn' }),
    }
    const SHOW = [['flange', 'gasket', 'gap', 'leak'], ['n1', 'n2', 'n3', 'n4'], ['scraper', 'dirt'], ['old'], ['oring', 'groove', 'lube'], ['twist', 'nick']]

    let step = 0, lt = 0, cyc = 0

    function pose() {
      const isA = step < 4
      A.visible = isA
      Bg.visible = !isA
      let leak = 0
      // --- фланцы
      if (isA) {
        let t = 0.14, gap = 0.12, lift = 0
        let gx = 0, ox = 0, oldOn = false, newOn = true, scr = false
        if (step === 0) leak = 1
        else if (step === 1) {
          const k = ph(lt, 0.3, 1.6), c = ph(lt, 1.6, 3.6)
          gap = 0.12 * (1 - k)
          t = 0.14 - 0.05 * c
          leak = 1 - ph(lt, 0.3, 1.2)
          // гайки по очереди (1 → 4) — подсветка номера
          nuts.forEach((n, i) => {
            const on = lt > 0.3 + i * 0.8 && lt < 1.1 + i * 0.8
            n.rotation.y = 3 * ph(lt, 0.3 + i * 0.8, 1.1 + i * 0.8) + 2 * c
            L['n' + (i + 1)].tone(on ? 'accent' : '')
          })
          L.dry.show(lt > 3.6)
        } else if (step === 2) {
          lift = 1.6
          newOn = false
          scr = true
        } else if (step === 3) {
          lift = 1.6
          oldOn = true
          ox = 3.6 * ph(lt, 0.2, 1.6)
          gx = 3.6 * (1 - ph(lt, 1.8, 3.2))
          t = 0.14
          L.neu.show(lt > 2.6)
          oldGasket.visible = ox < 3.5
          L.old.show(ox < 2.5)
        }
        if (step !== 1) nuts.forEach((n) => (n.rotation.y = 0))
        gasket.visible = newOn
        gasket.position.set(gx, 0, 0)
        gasket.scale.y = t
        oldGasket.visible = oldOn && ox < 3.5
        oldGasket.position.set(ox, 0, 0)
        oldGasket.scale.y = 0.09
        up.position.y = t + gap + lift
        nuts.forEach((n) => {
          n.position.y = t + gap + 0.5 + 0.13
          n.visible = lift < 0.1
        })
        boltGroups.forEach((b) => (b.visible = lift < 0.1))
        // скребок проходит слева направо и снимает остатки
        scraper.visible = scr
        const sx = -2.0 + 4.2 * ph(lt, 0.4, 3.4)
        scraper.position.set(sx, 0, 0)
        dirt.forEach((d) => {
          d.visible = step === 2 && (d.position.x > sx - 0.15 || lt < 0.4)
        })
        if (step === 2) {
          L.dirt.show(lt < 1.6)
          L.noScrew.show(lt < 3.4)
          L.clean.show(lt > 3.5)
          L.scraper.show(lt < 3.6)
        }
      } else {
        // --- кольцо: пробку вставляют, кольцо сжимается
        const y = 2.4 - 2.2 * ph(lt, 0.8, 2.8)
        plug.position.y = y
        const k = Math.min(1, Math.max(0, (1.05 - y) / 0.35))
        squeeze(k)
        lubeMat.opacity = step === 4 ? 0.5 * (1 - ph(lt, 0.6, 1.2)) : 0
        lube.visible = lubeMat.opacity > 0.01
        twist.visible = nick.visible = step === 5
        if (step === 4) {
          L.lube.show(lt < 1.2)
          L.squeezed.show(lt > 2.8)
          L.oring.show(lt < 2.8)
        } else {
          leak = ph(lt, 3.0, 3.6)
          L.leak2.show(lt > 3.4)
        }
      }
      // капли
      drops.visible = leak > 0.01
      if (drops.visible) {
        for (let i = 0; i < NDROP; i++) {
          const p = saw(cyc * 0.7 + i * 0.37, 1)
          if (isA) {
            // выходят из щели на переднем крае и падают
            const x = -1.2 + (i % 5) * 0.6
            const ooz = Math.min(1, p / 0.3), fall = Math.max(0, (p - 0.3) / 0.7)
            v1.set(x, 0.07 - fall * fall * 2.4, 1.6 + 0.06 * ooz)
            dm.scale.setScalar(leak * (0.4 + 0.6 * ooz))
          } else {
            // выдавливаются по зазору у пробки и стекают по корпусу
            const a = (i % 2 ? 0.66 : 1.84) * Math.PI + ((i % 5) - 2) * 0.12
            const ooz = Math.min(1, p / 0.25), run = Math.max(0, (p - 0.25) / 0.45), fall = Math.max(0, (p - 0.7) / 0.3)
            const r = 1.22 + run * 0.98 + fall * 0.05
            v1.set(r * Math.sin(a), 0.82 - fall * fall * 2.4, r * Math.cos(a))
            dm.scale.setScalar(leak * (0.4 + 0.6 * ooz))
          }
          dm.position.copy(v1)
          dm.updateMatrix()
          drops.setMatrixAt(i, dm.matrix)
        }
        drops.instanceMatrix.needsUpdate = true
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
      Object.entries(L).forEach(([k, l]) => l.show(SHOW[i].includes(k)))
      if (i === 1) BOLTS.forEach((_, j) => L['n' + (j + 1)].tone(''))
      if (!instant) stage.fit(FRAMES[i], { pad: 1.0, ms: 800 })
      pose()
    }

    stage.ready()
    return stage.controller({ setStep: (i, o) => apply(i, o?.instant) })
  },
}

function ringY(rIn, rOut, h) {
  return new THREE.LatheGeometry(
    [[rIn, -h / 2], [rOut, -h / 2], [rOut, -h / 2], [rOut, h / 2], [rOut, h / 2], [rIn, h / 2], [rIn, h / 2], [rIn, -h / 2]].map(([r, y]) => new THREE.Vector2(r, y)),
    40,
  )
}
