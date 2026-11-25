// Манжета (сальник) в разрезе на вращающемся валу: каркас, рабочая кромка, пружина, пыльник.
// Кромка к маслу — сухо; перевернули — течь; запрессовка оправкой; надевание через гильзу.
// Всё строится в группе ax, где локальная ось Y — ось вала; группа повёрнута так, что вал идёт вдоль X
// (масло справа, +X; снаружи слева).
import { createStage, THREE, PALETTE, cylY } from '../stage.js'
import { cutRing, sectionMat, arc, ph, saw } from './joints-kit.js'

const STEPS = [
  { title: 'Устройство манжеты', text: 'Металлический каркас плотно сидит в корпусе. Резиновая рабочая кромка обнимает вал, пружина прижимает её. Пыльник снаружи не пускает грязь. Четверть вырезана.' },
  { title: 'Кромка — к маслу', text: 'Рабочая кромка и пружина смотрят внутрь, к маслу. Давление масла только сильнее прижимает кромку к валу: вал крутится, снаружи сухо.' },
  { title: 'Перевернули — течь', text: 'Если поставить манжету наоборот, масло отжимает кромку от вала и сразу течёт наружу. Проверяйте направление до запрессовки; стрелка вращения на манжете должна совпасть с вращением вала.' },
  { title: 'Запрессовка оправкой', text: 'Оправка давит по наружному краю манжеты по всему кругу — ровно, без перекоса, до упора или до размера по ТК. Бородком или молотком по краю нельзя: перекос и течь.' },
  { title: 'Через защитную гильзу', text: 'Кромку смазать (чем — по ТК). Шпоночный паз, шлицы или резьбу закрывают тонкой гильзой, иначе кромку порежет. Кромку не трогать пальцами и инструментом.' },
]

const CUT = -Math.PI / 4 // вырезанная четверть смотрит вверх-вперёд (к камере)
const BOX = (x0, x1) => new THREE.Box3(new THREE.Vector3(x0, -0.9, -0.6), new THREE.Vector3(x1, 2.5, 0.6))
const FRAMES = [BOX(-1.6, 1.9), BOX(-1.6, 1.9), BOX(-2.4, 1.9), BOX(-3.4, 1.9), BOX(-4.8, 1.9)]

export default {
  title: 'Манжета (сальник)',
  animated: true,
  steps: STEPS,
  mount(host) {
    const stage = createStage(host, { position: [0.9, 2.6, 7.6], target: [0, 0.8, 0], fov: 30, fit: FRAMES[0], pad: 0.95 })
    const { root } = stage
    const sec = sectionMat(stage)
    const o = { cutAt: CUT, secMat: sec }

    const ax = new THREE.Group()
    ax.rotation.z = -Math.PI / 2
    root.add(ax)

    // вал: вращается, на нём риска и (у торца) шпоночный паз
    const shaft = new THREE.Group()
    const body = stage.mesh(cylY(0.995, 5.8, 64), 'chrome')
    body.position.y = 0.3
    const endCh = stage.mesh(new THREE.CylinderGeometry(0.995, 0.93, 0.06, 64), 'chrome')
    endCh.position.y = -2.63
    const stripe = stage.mesh(new THREE.BoxGeometry(0.05, 2.6, 0.04), 'mark')
    stripe.position.set(0, 1.9, 0.985)
    const keyway = stage.mesh(new THREE.BoxGeometry(0.03, 1.1, 0.3), 'steelBlack')
    keyway.position.set(-0.985, -2.05, 0)
    shaft.add(body, endCh, stripe, keyway)
    ax.add(shaft)

    // узел: корпус + манжета + масло (на последнем шаге узел надевают на вал)
    const unit = new THREE.Group()
    ax.add(unit)
    const housing = cutRing([[1.6, -0.4], [2.3, -0.4], [2.3, 1.8], [1.95, 1.8], [1.95, 0.62], [1.45, 0.62], [1.45, 0.4], [1.6, 0.4]], stage.mat('iron'), o)
    unit.add(housing)
    const oilMat = stage.mat('oil', { transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide })
    const oil = cutRing([[1.0, 0.37], [1.45, 0.37], [1.45, 0.62], [1.95, 0.62], [1.95, 1.8], [1.0, 1.8]], oilMat, { cutAt: CUT, secMat: oilMat })
    unit.add(oil)

    const seal = new THREE.Group()
    const caseM = cutRing([[1.18, -0.36], [1.6, -0.36], [1.6, 0.36], [1.52, 0.36], [1.52, -0.28], [1.18, -0.28]], stage.mat('steelDark'), o)
    const rubber = cutRing(
      [[1.5, -0.28], [1.5, -0.02], [1.3, 0.04], [1.17, 0.14], [1.17, 0.3], [1.12, 0.36], [1.0, 0.22], [1.03, 0.16], [1.12, 0.02], [1.1, -0.1], [1.0, -0.2], [1.04, -0.26], [1.18, -0.28]],
      stage.mat('rubber', { color: '#3a3532' }), o,
    )
    const springPts = [[1.305, 0.22], ...arc(1.24, 0.22, 0.065, 0, Math.PI * 2, 14)]
    const springM = stage.mat('brass', { color: '#c9b27a' })
    const spring = cutRing(springPts, springM, { cutAt: CUT, secMat: springM, seg: 48 })
    // смазка на кромке (последний шаг)
    const grease = cutRing([[1.0, 0.12], [1.04, 0.12], [1.06, 0.3], [1.0, 0.3]], stage.mat('oil', { emissive: PALETTE.oil, emissiveIntensity: 0.25 }), { cutAt: CUT })
    seal.add(caseM, rubber, spring, grease)
    unit.add(seal)

    // оправка (чашка по наружному краю) — в координатах манжеты
    const mandrel = cutRing([[1.25, -0.37], [1.58, -0.37], [1.58, -0.92], [1.95, -0.92], [1.95, -1.08], [1.06, -1.08], [1.06, -0.92], [1.25, -0.92]], stage.mat('brass'), o)
    unit.add(mandrel)
    // защитная гильза на конце вала
    const sleeveMat = stage.mat('milk', { transparent: true, opacity: 0.55, depthWrite: false })
    const sleeve = cutRing([[1.0, -2.75], [1.0, -1.25], [1.035, -1.25], [1.05, -1.35], [1.05, -2.6], [1.02, -2.75]].reverse(), sleeveMat, { cut: false, seg: 48 })
    ax.add(sleeve)

    // стрелки: давление масла на кромку; усилие пресса на оправку
    const oilArrow = stage.arrow(new THREE.Vector3(1.3, 1.55, 0.05), new THREE.Vector3(0.42, 1.12, 0.05), PALETTE.oil, { head: 0.25, width: 0.18 })
    const pressArrow = stage.arrow(new THREE.Vector3(-3.2, 1.75, 0.05), new THREE.Vector3(-1.9, 1.75, 0.05), PALETTE.ok, { head: 0.3, width: 0.24 })
    root.add(oilArrow, pressArrow)

    // капли утечки (в мировых координатах, вал вдоль X)
    const NDROP = 12
    const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), stage.mat('oil'), NDROP)
    root.add(drops)
    const filmMat = stage.mat('oil', { transparent: true, opacity: 0.0, depthWrite: false })
    const film = new THREE.Mesh(new THREE.CylinderGeometry(1.008, 1.008, 1.4, 48, 1, true).rotateZ(Math.PI / 2), filmMat)
    film.position.x = -1.1
    root.add(film)
    const dm = new THREE.Object3D()

    const L = {
      case: stage.label('Каркас', seal, { offset: [-1.56, -0.32, 0], side: 'left' }),
      lip: stage.label('Рабочая кромка', seal, { offset: [-1.0, 0.22, 0], side: 'bottom' }),
      spring: stage.label('Пружина', seal, { offset: [-1.24, 0.22, 0], side: 'top' }),
      dust: stage.label('Пыльник', seal, { offset: [-1.0, -0.2, 0], side: 'left' }),
      oil: stage.label('Масло', new THREE.Vector3(1.3, 1.6, 0), { side: 'right' }),
      out: stage.label('Снаружи', new THREE.Vector3(-1.8, 1.0, 0.4), { side: 'top' }),
      toOil: stage.label('✔ Кромка и пружина — к маслу', new THREE.Vector3(0.9, 2.0, 0), { side: 'top', tone: 'ok' }),
      dry: stage.label('Сухо', new THREE.Vector3(-1.4, 1.0, 0.3), { side: 'top', tone: 'ok' }),
      leak: stage.label('✖ Течь', new THREE.Vector3(-1.3, -1.2, 0.8), { side: 'left', tone: 'warn' }),
      flipped: stage.label('Кромка смотрит наружу', seal, { offset: [-1.0, 0.2, 0], side: 'bottom', tone: 'warn' }),
      mandrel: stage.label('Оправка по наружному краю', mandrel, { offset: [-1.9, -1.0, 0], side: 'bottom', tone: 'accent' }),
      square: stage.label('Ровно, до упора', new THREE.Vector3(0, 2.35, 0), { side: 'top' }),
      sleeve: stage.label('Защитная гильза', new THREE.Vector3(-2.0, 1.05, 0), { side: 'top', tone: 'accent' }),
      grease: stage.label('Кромку смазать', seal, { offset: [-1.0, 0.22, 0], side: 'bottom' }),
      keyway: stage.label('Шпоночный паз', new THREE.Vector3(-2.05, 0.5, 0.9), { side: 'bottom' }),
    }
    const SHOW = [['case', 'lip', 'spring', 'dust', 'oil', 'out'], ['toOil', 'dry'], ['flipped'], ['mandrel', 'square'], ['sleeve', 'grease', 'keyway']]

    let step = 0, lt = 0, cyc = 0, spin = 0

    function pose(dt) {
      if (stage.playing) spin += dt * 2.4
      shaft.rotation.y = spin
      let flip = 1, sy = 0, uy = 0, leak = 0
      mandrel.visible = false
      sleeve.visible = false
      grease.visible = false
      oil.visible = true
      oilArrow.visible = false
      pressArrow.visible = false
      if (step === 1) {
        oilArrow.visible = true
        const k = 0.06 * Math.sin(lt * 4)
        oilArrow.set(new THREE.Vector3(1.3 + k, 1.55 + k, 0.05), new THREE.Vector3(0.42, 1.12, 0.05))
      } else if (step === 2) {
        sy = -1.5 * ph(lt, 0, 0.6) * (1 - ph(lt, 1.3, 1.9))
        flip = 1 - 2 * ph(lt, 0.6, 1.3)
        leak = ph(lt, 2.0, 2.6)
        L.flipped.show(lt > 1.9 && lt < 4)
        L.leak.show(lt > 2.4)
      } else if (step === 3) {
        mandrel.visible = true
        pressArrow.visible = true
        sy = -2.0 * (1 - ph(lt, 0.4, 2.6))
        const x = sy - 1.4
        pressArrow.set(new THREE.Vector3(x - 1.3, 1.75, 0.05), new THREE.Vector3(x - 0.05, 1.75, 0.05))
        L.square.show(lt > 2.6)
      } else if (step === 4) {
        // узел с манжетой надевают на вал через гильзу; гильзу снимают
        oil.visible = false
        grease.visible = true
        uy = -4.4 * (1 - ph(lt, 0.8, 3.4))
        const off = ph(lt, 3.8, 4.6)
        sleeve.visible = off < 0.99
        sleeve.position.y = -2.2 * off
        sleeveMat.opacity = 0.55 * (1 - off)
        L.sleeve.show(off < 0.5)
        L.keyway.show(off > 0.6)
      }
      seal.position.y = sy
      seal.scale.y = Math.abs(flip) < 0.02 ? 0.02 : flip
      mandrel.position.y = sy
      unit.position.y = uy
      // утечка: плёнка на валу снаружи и капли, стекающие вниз
      drops.visible = leak > 0.01
      film.visible = leak > 0.01
      filmMat.opacity = 0.5 * leak
      if (drops.visible) {
        for (let i = 0; i < NDROP; i++) {
          const p = saw(cyc * 0.8 + i * 0.29, 1)
          const th = -0.2 + (i % 4) * 0.35
          const creep = Math.min(1, p / 0.55)
          const fall = Math.max(0, (p - 0.55) / 0.45)
          const x = -0.45 - creep * 1.1
          const r = 1.03
          const y = r * Math.cos(th + creep * 1.6) - fall * fall * 2.6
          const z = r * Math.sin(th + creep * 1.6)
          dm.position.set(x, y, z)
          dm.scale.setScalar(leak * (fall > 0 ? 1.1 : 0.4 + creep * 0.7))
          dm.updateMatrix()
          drops.setMatrixAt(i, dm.matrix)
        }
        drops.instanceMatrix.needsUpdate = true
      }
    }

    stage.onFrame((dt) => {
      lt += dt
      if (stage.playing) cyc += dt
      pose(dt)
    })

    function apply(i, instant) {
      step = i
      lt = instant ? 99 : 0
      Object.entries(L).forEach(([k, l]) => l.show(SHOW[i].includes(k)))
      if (!instant) stage.fit(FRAMES[i], { pad: 0.95, ms: 800 })
      pose(0)
    }

    stage.ready()
    return stage.controller({ setStep: (i, o2) => apply(i, o2?.instant) })
  },
}
