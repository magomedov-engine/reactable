// Режим «Работа двигателя»: что происходит внутри цилиндров.
// Газ в цилиндре (цвет = температура), впуск и выпуск синхронно с клапанами,
// впрыск топлива, вспышка, импульсы топлива по трубкам ВД, стрелки сил, вращение турбокомпрессора.
import * as THREE from 'three'

const DEG = Math.PI / 180
// те же размеры, что в engineModel.js (1 ед. ≈ 130 мм)
const R = 0.54
const ROD = 2.0

// ---------- упрощённая физика цикла (учебная, порядок величин как у дизеля с наддувом)
export const EPS = 16 // степень сжатия
const P_IN = 2.4 // бар абс.: давление наддува
const P_EX = 2.0 // бар: противодавление перед турбиной
const T_IN = 320 // К: воздух после охладителя
const GAMMA = 1.35
const Q = 1.0 // прирост давления от сгорания
const VMAX = EPS / (EPS - 1)
const mod = (a, m) => ((a % m) + m) % m

// a — угол от ВМТ рабочего хода (−360…360): 0 — ВМТ начала рабочего хода
export function angleFromTdc(psi) {
  const p = mod(psi, 720)
  return p <= 360 ? p : p - 720
}
function volume(a) {
  const phi = a * DEG
  const x = R * (1 - Math.cos(phi)) + ROD - Math.sqrt(ROD * ROD - (R * Math.sin(phi)) ** 2)
  return { v: 1 / (EPS - 1) + x / (2 * R), x: x / (2 * R) }
}
// доля сгоревшего топлива (закон Вибе)
function burned(a) {
  if (a < -4) return 0
  const t = Math.min(1, (a + 4) / 54)
  return 1 - Math.exp(-6.9 * t * t * t)
}
function closedPressure(a) {
  const { v } = volume(a)
  return P_IN * Math.pow(VMAX / v, GAMMA) * (1 + Q * burned(a))
}
const P_EVO = closedPressure(130)

// состояние газа в цилиндре по углу psi (0…720 от начала рабочего хода)
export function cylState(psi) {
  const a = angleFromTdc(psi)
  const { v, x } = volume(a)
  let p, T
  if (a >= -130 && a <= 130) {
    p = closedPressure(a)
    T = (T_IN * p * v) / (P_IN * VMAX)
  } else if (a > 130 && a <= 190) {
    p = P_EX + (P_EVO - P_EX) * Math.exp(-(a - 130) / 12)
    T = 1000 - (a - 130) * 3
  } else if (a > 190) {
    p = P_EX
    T = 820
  } else {
    p = P_IN
    T = T_IN + 15
  }
  const burnedGas = a > 0 && a < 360
  let phase
  if (a < -180) phase = 'intake'
  else if (a < -14) phase = 'compression'
  else if (a < 0) phase = 'injection'
  else if (a < 45) phase = 'combustion'
  else if (a < 130) phase = 'expansion'
  else if (a < 180) phase = 'blowdown'
  else phase = 'exhaust'
  return { a, v, x, p, T, burned: burnedGas, xb: burned(a), phase }
}

// цвет газа: холодный воздух → голубой, горячий → жёлто-белый, отработавший → дымный
const C_COLD = new THREE.Color('#86a8c6')
const C_WARM = new THREE.Color('#d9a35c')
const C_HOT = new THREE.Color('#f4e8cc')
const C_FIRE = new THREE.Color('#e0703c')
const C_SMOKE = new THREE.Color('#7f7970')
function gasColor(st, out) {
  const k1 = THREE.MathUtils.clamp((st.T - 330) / 600, 0, 1)
  out.copy(C_COLD).lerp(C_WARM, k1)
  if (st.T > 930) out.lerp(C_HOT, THREE.MathUtils.clamp((st.T - 930) / 900, 0, 1))
  if (st.phase === 'combustion') out.lerp(C_FIRE, 0.35)
  if (st.burned && st.a > 60) out.lerp(C_SMOKE, THREE.MathUtils.clamp((st.a - 60) / 150, 0, 0.85))
  return out
}

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(250,244,228,1)')
  grd.addColorStop(0.25, 'rgba(236,184,116,0.9)')
  grd.addColorStop(0.6, 'rgba(214,112,62,0.35)')
  grd.addColorStop(1, 'rgba(190,80,48,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
function dotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.55, 'rgba(255,255,255,1)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ---------- частицы с цветом у каждой точки
function particlePool(parent, n, size, tex) {
  const pos = new Float32Array(n * 3).fill(-999)
  const col = new Float32Array(n * 3)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const mat = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  pts.renderOrder = 22
  pts.userData.noPick = true
  parent.add(pts)
  return {
    pts, geo, mat, n,
    set(i, v, c) {
      pos[i * 3] = v.x
      pos[i * 3 + 1] = v.y
      pos[i * 3 + 2] = v.z
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    },
    park(i) {
      pos[i * 3 + 1] = -999
    },
    commit() {
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate = true
    },
  }
}

// ================================================================
export function createOperation(ctx) {
  const { root, banks, cyls, hpCurve, DECK, IN_WIN, EX_WIN, FIRE_AT, lift, inPath, exPath } = ctx
  const group = new THREE.Group()
  group.visible = false
  root.add(group)
  const disposables = []
  const keep = (x) => (disposables.push(x), x)
  const glowTex = keep(glowTexture())
  const dotTex = keep(dotTexture())

  const fx = { gas: true, air: true, fuel: true, fire: true, exhaust: true, forces: true }

  // ---------- газ в цилиндре, вспышка, факелы впрыска, стрелки: в координатах ряда
  const gasGeo = keep(new THREE.CylinderGeometry(0.47, 0.47, 1, 28, 1, false).translate(0, 0.5, 0))
  // факел распылителя: конус от сопла вниз-наружу
  const jetGeo = keep(new THREE.ConeGeometry(0.075, 0.55, 10, 1, true).translate(0, -0.275, 0).rotateX(Math.PI))
  const jetMat = keep(new THREE.MeshBasicMaterial({ color: '#e8b273', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }))
  const tmpC = new THREE.Color()

  const per = cyls.map((cy) => {
    const g = banks[cy.side]
    const gasMat = keep(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false }))
    const gas = new THREE.Mesh(gasGeo, gasMat)
    gas.position.set(cy.x, 2, 0)
    gas.userData.noPick = true
    gas.renderOrder = 15
    gas.visible = false
    g.add(gas)
    // огненный шар
    const glowMat = keep(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }))
    const glow = new THREE.Sprite(glowMat)
    glow.renderOrder = 23
    glow.visible = false
    g.add(glow)
    // факелы впрыска: 6 отверстий распылителя
    const spray = new THREE.Group()
    for (let i = 0; i < 6; i++) {
      const j = new THREE.Mesh(jetGeo, jetMat)
      const h = new THREE.Group()
      j.rotation.z = 62 * DEG
      h.add(j)
      h.rotation.y = (i * 60 + 30) * DEG
      spray.add(h)
    }
    spray.position.set(cy.x, DECK + 0.02, 0)
    spray.visible = false
    spray.traverse((o) => (o.renderOrder = 25))
    g.add(spray)
    // стрелка силы на поршень
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(cy.x, 3, 0), 1, 0xd0644f, 0.3, 0.22)
    for (const m of [arrow.line.material, arrow.cone.material]) {
      m.depthTest = false
      m.transparent = true
      m.toneMapped = false
      keep(m)
    }
    arrow.line.renderOrder = arrow.cone.renderOrder = 24
    arrow.visible = false
    g.add(arrow)
    return { cy, g, gas, gasMat, glow, glowMat, spray, arrow, st: null }
  })

  // свет вспышки: один на двигатель, у цилиндра, где сейчас рабочий ход
  const fireLight = new THREE.PointLight('#f08a4a', 0, 5, 1.6)
  group.add(fireLight)

  // ---------- впуск и выпуск: частицы по цилиндрам
  const K = 12
  const W = (cy, x, y, z) => banks[cy.side].localToWorld(new THREE.Vector3(x, y, z))
  root.updateMatrixWorld(true)
  const lanes = per.map((p) => {
    const cy = p.cy
    const xi = cy.x - 0.3, xe = cy.x + 0.3
    // по впускному патрубку и каналу головки к клапану; от клапана по выпускному каналу в коллектор
    const inCurve = new THREE.CatmullRomCurve3([...inPath(cy).slice(0, -2), W(cy, xi, DECK - 0.02, 0)], false, 'centripetal')
    const exCurve = new THREE.CatmullRomCurve3([W(cy, xe, DECK - 0.02, 0), ...exPath(cy).slice(2)], false, 'centripetal')
    const seeds = (n) => Array.from({ length: n }, (_, i) => ({ u: i / n, rx: (Math.random() - 0.5) * 0.7, rz: (Math.random() - 0.5) * 0.7, k: Math.random() }))
    return { cy, inCurve, exCurve, inP: seeds(K), exP: seeds(K) }
  })
  const inPool = particlePool(group, lanes.length * K, 0.2, dotTex)
  const exPool = particlePool(group, lanes.length * K, 0.22, dotTex)
  keep(inPool.geo), keep(inPool.mat), keep(exPool.geo), keep(exPool.mat)
  const C_AIR = new THREE.Color('#a2c08f')
  const C_EXH = new THREE.Color('#958e84')
  const C_EXH_HOT = new THREE.Color('#d0734f')

  // ---------- импульсы топлива по трубкам ВД: ТНВД → форсунка перед впрыском
  const TRAIL = 5
  const fuelPool = particlePool(group, cyls.length * TRAIL, 0.24, dotTex)
  keep(fuelPool.geo), keep(fuelPool.mat)
  const C_FUEL = new THREE.Color('#e39a5e')

  // ---------- крыльчатки компрессоров: видно, как раскручивается турбокомпрессор
  const wheelMat = keep(new THREE.MeshStandardMaterial({ color: '#c9c5bc', metalness: 0.8, roughness: 0.3 }))
  const bladeGeo = keep(new THREE.BoxGeometry(0.03, 0.38, 0.08).translate(0, 0.21, 0))
  const hubGeo = keep(new THREE.ConeGeometry(0.1, 0.18, 16).rotateZ(-Math.PI / 2))
  const wheels = []
  for (const side of ['L', 'R']) {
    const comp = banks[side].comp
    if (!comp) continue
    const w = new THREE.Group()
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(bladeGeo, wheelMat)
      b.rotation.x = (i * 40 * Math.PI) / 180
      b.rotation.y = 0.35
      w.add(b)
    }
    const hub = new THREE.Mesh(hubGeo, wheelMat)
    hub.position.x = 0.06
    w.add(hub)
    w.position.copy(comp.position).add(new THREE.Vector3(0.3, 0, 0))
    w.traverse((m) => (m.userData.noPick = true))
    w.visible = false
    banks[side].add(w)
    wheels.push(w)
  }

  let enabled = false
  let follow = null
  let focusAll = false
  let solo = null // Set показанных цилиндров: эффекты остальных прячем
  let turboShown = true // колёса компрессоров видны, только когда виден сам компрессор
  const tmpV = new THREE.Vector3()
  const tmpW = new THREE.Vector3()
  let turbo = 0

  function update(theta, dt, speed) {
    if (!enabled) return
    // поток выхлопа и наддув держат турбину раскрученной
    turbo += dt * (6 + 18 * Math.min(1, speed)) * (fx.exhaust || fx.air ? 1 : 0)
    for (const w of wheels) {
      w.rotation.x = turbo
      w.visible = turboShown && (fx.air || fx.exhaust)
    }
    let fireBest = 0
    for (let i = 0; i < per.length; i++) {
      const p = per[i]
      const cy = p.cy
      const psi = mod(theta - FIRE_AT[cy.c], 720)
      const st = cylState(psi)
      p.st = st
      if (solo && !solo.has(cy.c)) {
        p.gas.visible = p.glow.visible = p.spray.visible = p.arrow.visible = false
        for (let j = 0; j < K; j++) inPool.park(i * K + j), exPool.park(i * K + j)
        for (let j = 0; j < TRAIL; j++) fuelPool.park(i * TRAIL + j)
        continue
      }
      const crown = cy.sPin + 0.5
      // газ
      p.gas.visible = fx.gas
      if (fx.gas) {
        p.gas.position.y = crown
        p.gas.scale.y = Math.max(0.02, DECK - crown)
        gasColor(st, p.gasMat.color)
        p.gasMat.opacity = (follow == null || follow === cy.c || focusAll ? 1 : 0.45) * (st.phase === 'combustion' ? 0.8 : st.burned ? 0.55 : 0.45 + 0.3 * THREE.MathUtils.clamp((st.T - 330) / 500, 0, 1))
      }
      // впрыск: факелы растут, затем гаснут
      const inj = st.a >= -14 && st.a < 6 ? (st.a + 14) / 20 : -1
      p.spray.visible = fx.fuel && inj >= 0
      if (p.spray.visible) {
        // факел долетает до камеры сгорания в днище поршня
        const len = Math.min(1, inj * 2.2) * (inj > 0.75 ? 1 - (inj - 0.75) * 2 : 1)
        p.spray.scale.set(1, Math.max(0.05, len), 1)
      }
      // вспышка
      const f = st.a >= -2 && st.a < 55 ? Math.sin(((st.a + 2) / 57) * Math.PI) * (st.a < 12 ? 1 : 1 - (st.a - 12) / 60) : 0
      p.glow.visible = fx.fire && f > 0.02
      if (p.glow.visible) {
        p.glowMat.opacity = Math.min(1, f * 1.3)
        const sz = 0.6 + 1.0 * f
        p.glow.scale.set(sz, sz, 1)
        p.glow.position.set(cy.x, (crown + DECK) / 2, 0)
      }
      if (fx.fire && f > fireBest) {
        fireBest = f
        p.glow.getWorldPosition(tmpW)
        fireLight.position.copy(root.worldToLocal(tmpW))
      }
      // силы: на рабочем ходу газы давят на поршень, на остальных — вал тянет/толкает поршень
      p.arrow.visible = fx.forces && (focusAll || follow == null || follow === cy.c)
      if (p.arrow.visible) {
        const down = st.a > 0 ? st.a < 180 : st.a < -180
        if (st.phase === 'combustion' || st.phase === 'expansion') {
          const L = 0.35 + Math.min(1.6, st.p / 70)
          p.arrow.position.set(cy.x, crown + L + 0.05, 0)
          p.arrow.setDirection(tmpV.set(0, -1, 0))
          p.arrow.setLength(L, 0.28, 0.22)
          p.arrow.setColor(0xd0644f)
        } else {
          const L = 0.55
          p.arrow.position.set(cy.x, cy.sPin + (down ? 0.35 : -0.35) - (down ? 0 : 0), 0)
          p.arrow.setDirection(tmpV.set(0, down ? -1 : 1, 0))
          p.arrow.setLength(L, 0.2, 0.16)
          p.arrow.setColor(0xa39f96)
        }
      }
      // впуск / выпуск
      const lane = lanes[i]
      const li = lift(psi, IN_WIN), le = lift(psi, EX_WIN)
      for (let j = 0; j < K; j++) {
        const idx = i * K + j
        const q = lane.inP[j]
        if (fx.air && li > 0.03) {
          q.u = (q.u + dt * (0.5 + 1.4 * li) * Math.max(0.35, speed)) % 1
          if (q.u < 0.55) lane.inCurve.getPointAt(q.u / 0.55, tmpV)
          else {
            // внутри цилиндра: разлетается к поршню, закручиваясь
            const t = (q.u - 0.55) / 0.45
            const ang = q.k * 6.28 + t * 2.5
            const r = 0.12 + 0.3 * t
            tmpW.set(cy.x - 0.3 * (1 - t) + Math.cos(ang) * r, DECK - t * (DECK - crown - 0.05), Math.sin(ang) * r)
            banks[cy.side].localToWorld(tmpW)
            tmpV.copy(root.worldToLocal(tmpW))
          }
          inPool.set(idx, tmpV, C_AIR)
        } else inPool.park(idx)
        const e = lane.exP[j]
        if (fx.exhaust && le > 0.03) {
          e.u = (e.u + dt * (0.6 + 1.6 * le) * Math.max(0.35, speed)) % 1
          if (e.u < 0.35) {
            const t = e.u / 0.35
            tmpW.set(cy.x + 0.3 * t + e.rx * (1 - t) * 0.6, crown + 0.05 + t * (DECK - crown - 0.07), e.rz * (1 - t) * 0.6)
            banks[cy.side].localToWorld(tmpW)
            tmpV.copy(root.worldToLocal(tmpW))
          } else lane.exCurve.getPointAt((e.u - 0.35) / 0.65, tmpV)
          tmpC.copy(C_EXH).lerp(C_EXH_HOT, st.phase === 'blowdown' ? 0.85 : 0.25)
          exPool.set(idx, tmpV, tmpC)
        } else exPool.park(idx)
      }
      // топливо в трубке ВД: порция идёт к форсунке перед впрыском
      const curve = hpCurve(cy.c)
      for (let j = 0; j < TRAIL; j++) {
        const idx = i * TRAIL + j
        const t = (st.a + 46 - j * 2.2) / 32
        if (fx.fuel && curve && t >= 0 && t <= 1) {
          curve.getPointAt(t, tmpV)
          fuelPool.set(idx, tmpV, C_FUEL)
        } else fuelPool.park(idx)
      }
    }
    fireLight.intensity = fx.fire ? fireBest * 9 : 0
    inPool.commit()
    exPool.commit()
    fuelPool.commit()
  }

  return {
    fx,
    get enabled() {
      return enabled
    },
    setEnabled(v) {
      enabled = v
      group.visible = v
      for (const p of per) {
        p.gas.visible = p.glow.visible = p.spray.visible = p.arrow.visible = false
        if (v) p.gas.visible = fx.gas
      }
      for (const w of wheels) w.visible = v && turboShown && (fx.air || fx.exhaust)
    },
    setFx(key, v) {
      fx[key] = v
    },
    setTurboShown(v) {
      turboShown = v
    },
    setSolo(c) {
      solo = c || null
    },
    setFollow(c, all = false) {
      follow = c
      focusAll = all
    },
    update,
    dispose() {
      disposables.forEach((d) => d.dispose?.())
    },
  }
}
