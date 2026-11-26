// Сцены на полной 3D-модели двигателя (та же, что на странице «3D-модель»).
// Каждый шаг — «пресет»: какие детали видны, разрез, режим работы, угол вала, камера.
import { createEngine, FIRING, FIRE_AT } from '../../model3d/engineModel.js'
import { PART, PARTS } from '../../model3d/partsInfo.js'
import { ASSEMBLY } from '../../model3d/assemblySteps.js'
import { ROUTES } from '../../model3d/systemRoutes.js'

const ALL_FX = { gas: true, air: true, fuel: true, fire: true, exhaust: true, forces: true, glass: true }

// значения по умолчанию для каждого шага
const BASE = {
  only: null, fresh: null, section: 'none', pair: 1, op: false, fx: null, follow: 1, allForces: false,
  layer: 'all', casing: 0.3, explode: 0, select: null, numbers: true, cylinder: null,
  playing: true, speed: 1, theta: null, loop: null, fly: null, view: null, focus: null,
  // show — какие детали видны (остальные скрыты), solo — цилиндр или список цилиндров,
  // xray — полупрозрачные детали, flows — бегущие потоки систем, focusCyl — камера к цилиндру
  show: null, solo: null, xray: null, flows: null, focusCyl: null, focusDist: 8,
  // arrive — детали, которые на этом шаге «подлетают» на своё место (анимация сборки, повторяется)
  arrive: null, tighten: null,
}
const ALL_IDS = PARTS.map((p) => p.id)
const hiddenFor = (show) => (show ? ALL_IDS.filter((id) => !show.includes(id) && !(id === 'gearmark' && show.includes('gear'))) : [])
// детали одного цилиндра с клапанным механизмом: поршневая группа, вал, распредвал, клапаны
const PISTON_GRP = ['piston', 'rings', 'pin', 'rod', 'rodcap', 'rodbearing', 'liner']
const ONE_CYL = [...PISTON_GRP, 'crank', 'head', 'valve_in', 'valve_ex', 'spring', 'rocker', 'adjscrew', 'pushrod', 'tappet', 'camshaft', 'port_in', 'port_ex', 'manifold_in', 'injector']
const FUEL = ['fuelline', 'fuelfilter', 'fuelel', 'pump', 'hpline', 'injector']
// впускной (кулачок 340…590°) и выпускной (130…380°) клапан 1-го цилиндра: состояние для подписи
const IN_WIN = [340, 590], EX_WIN = [130, 380]
// эффекты сцены про топливо (шаг задаёт fx целиком, поэтому общая основа)
const FUEL_FX = { gas: false, air: false, exhaust: false, forces: false, fire: true, fuel: true }
const isOpen = (psi, [a, b]) => psi > a && psi < b
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const VALVE_TRAIN = ['camshaft', 'tappet', 'pushrod', 'rocker', 'adjscrew', 'valve_in', 'valve_ex', 'spring', 'head', 'gear', 'gearmark', 'crank']

function engineScene(def) {
  return {
    title: def.title,
    animated: true,
    steps: def.steps.map(({ title, text }) => ({ title, text })),
    mount(host) {
      // подсказка с названием детали под курсором
      const tip = document.createElement('div')
      tip.className = 'l3d-tag right'
      tip.style.display = 'none'
      const layer = document.createElement('div')
      layer.className = 'l3d-labels'
      layer.appendChild(tip)
      const note = document.createElement('div')
      note.className = 'l3d-tag accent big'
      note.style.cssText = 'display:none; left:12px; top:12px; translate:none; transform:none'
      layer.appendChild(note)

      let picked = null
      let cur = null
      const h = {
        note(t) {
          note.textContent = t || ''
          note.style.display = t ? '' : 'none'
        },
      }
      const eng = createEngine(
        host,
        {
          onHover(id, x, y) {
            if (!id) return (tip.style.display = 'none')
            const r = host.getBoundingClientRect()
            tip.textContent = PART[id]?.name || ''
            tip.style.display = ''
            tip.style.transform = `translate(${x - r.left}px, ${y - r.top}px)`
          },
          onPick(id) {
            picked = id && id !== picked ? id : null
            eng.select(picked || cur?.select || null, { keepMesh: true })
          },
          onCycle(cycle, theta) {
            cur?.onCycle?.(eng, cycle, theta, h)
          },
        },
        { inline: true },
      )
      host.appendChild(layer)

      let playing = true
      let active = false
      let raf = 0
      let last = 0
      let loopT = 0
      let arriveT = 0 // время анимации подлёта деталей шага

      function apply(i, instant) {
        const p = { ...BASE, ...(def.base || {}), ...def.steps[i].p }
        cur = p
        picked = null
        clearInterval(seqTimer)
        h.note(p.note || '')
        eng.setOperation(false)
        eng.setSection(p.section, p.pair)
        eng.setOnly(p.only ? new Set(p.only) : null, p.fresh ? new Set(p.fresh) : null)
        eng.setHidden(hiddenFor(p.show))
        eng.setSolo(p.solo)
        eng.setXray(p.xray)
        eng.setFlows(p.flows)
        eng.setLayer(p.layer)
        eng.setCasing(p.casing)
        eng.setExplode(p.explode)
        arriveT = 0
        // порядок затяжки: номера над болтами (tighten: { kind: 'maincap' | 'headbolt', order, cyl })
        eng.setTighten(p.tighten?.kind || null, p.tighten ? { order: p.tighten.order, cyl: p.tighten.cyl || 1, at: -1 } : {})
        // сначала детали на месте — камера наводится на них, потом разносим детали шага
        eng.setPartExplode(null, { tubes: false })
        eng.setNumbers(p.numbers)
        eng.setSpeed(p.speed)
        if (p.op) {
          const fx = { ...ALL_FX, ...(p.fx || {}) }
          for (const [k, v] of Object.entries(fx)) eng.setOpFx(k, v)
          eng.setOperation(true)
          eng.opFollow(p.follow, { all: p.allForces })
        }
        eng.setCylinder(p.cylinder, { focus: false })
        eng.select(p.select, { keepMesh: false })
        loopT = 0
        if (p.theta != null) eng.setTheta(p.theta)
        eng.setPlaying(!p.loop && playing && p.playing)
        if (p.fly) eng.fly(p.fly[0], p.fly[1], instant ? 0 : 900)
        else if (p.focusCyl) eng.focusCylinder(p.focusCyl, p.focusDist)
        else if (p.view) eng.view(p.view)
        else if (p.focus) eng.focusPart(p.focus)
        p.enter?.(eng, h)
        if (p.arrive) eng.setPartExplode(Object.fromEntries(p.arrive.map((id) => [id, 1])), { tubes: false })
        else eng.setPartExplode(null)
        p._k = undefined
      }

      // свой цикл: прокрутка вала в заданном диапазоне углов (шаги про отдельный такт, фазы, метки)
      function tick(now) {
        raf = requestAnimationFrame(tick)
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
        last = now
        if (cur?.loop && playing) {
          const [a, b, speed = 40] = cur.loop
          loopT += dt * speed
          eng.setTheta(a + (loopT % (b - a)))
        }
        // подлёт: 0,6 с пауза → 1,6 с движение → 2 с стоит на месте → снова (пока не нажата пауза — тогда стоит на месте)
        if (cur?.arrive) {
          const T = 4.2
          if (playing) arriveT += dt
          const t = arriveT % T
          const k = !playing ? 0 : t < 0.6 ? 1 : t < 2.2 ? 1 - easeInOut((t - 0.6) / 1.6) : 0
          if (k !== cur._k) {
            cur._k = k
            eng.setPartExplode(Object.fromEntries(cur.arrive.map((id) => [id, k])), { tubes: k === 0 })
          }
        }
      }

      eng.setActive(false)
      return {
        setStep: (i, o) => apply(i, o?.instant),
        setPlaying(v) {
          playing = v
          if (cur && !cur.loop) eng.setPlaying(v && cur.playing)
        },
        setActive(v) {
          if (v === active) return
          active = v
          eng.setActive(v)
          cancelAnimationFrame(raf)
          if (v) {
            last = performance.now()
            raf = requestAnimationFrame(tick)
          }
        },
        setZoom: (v) => eng.setZoom(v),
        setInteractive: (v) => eng.setInteractive(v),
        resetView() {
          if (!cur) return
          if (cur.fly) eng.fly(cur.fly[0], cur.fly[1], 700)
          else if (cur.focusCyl) eng.focusCylinder(cur.focusCyl, cur.focusDist)
          else if (cur.view) eng.view(cur.view)
          else if (cur.focus) eng.focusPart(cur.focus)
          else eng.view('iso')
        },
        dispose() {
          cancelAnimationFrame(raf)
          clearInterval(seqTimer)
          eng.dispose()
          layer.remove()
        },
      }
    },
  }
}

// 1-й цилиндр крупно спереди-сбоку: вал уходит в глубину, видно поршень, шатун, клапаны и их привод
const CYL1 = [[-9.8, 4.1, -5.9], [-4.5, 2.0, -0.9]]
// шестерни распределения у ЯМЗ-240 сзади: смотрим со стороны маховика
const REAR_GEARS = [[14, 2.6, -4], [6.0, 1.0, 0]]
const VALVE1 = [[-9.5, 6.5, -7.5], [-4.4, 2.8, -1.2]]

export { engineScene, PISTON_GRP, FUEL, VALVE_TRAIN, CYL1, REAR_GEARS, VALVE1, valveNote }

export const SCENES = {
  // ---------------------------------------------------------------- engine-01
  'v12-overview': engineScene({
    title: 'V12 (ЯМЗ-240М2) целиком',
    base: { numbers: false, playing: true },
    steps: [
      { title: 'Двигатель целиком', text: 'V-образный дизель по образцу ЯМЗ-240М2: двенадцать цилиндров в два ряда, развал 90°. Сверху головки и клапанные крышки, в развале впускной коллектор и ТНВД, снизу поддон. Наведите на деталь — увидите название.', p: { view: 'iso', casing: 1 } },
      { title: 'Блок и коленвал', text: 'Корпус сделан прозрачным: внутри лежит коленчатый вал. Это «позвоночник» двигателя: от него крутится всё остальное.', p: { view: 'side', casing: 0.12, select: 'crank' } },
      { title: 'Цилиндры и поршни', text: 'В каждом цилиндре ходит поршень. Через шатун он крутит вал. На анимации видно, как поршни ходят по очереди.', p: { view: 'iso', casing: 0.12, select: 'piston' } },
      { title: 'Головки и клапаны', text: 'Сверху цилиндры закрыты головками. В головках — клапаны и форсунки, над ними коромысла.', p: { view: 'iso', casing: 0.3, select: 'head' } },
      { title: 'Выпускные коллекторы', text: 'Снаружи рядов идут выпускные коллекторы, от их задних концов — приёмные трубы к глушителю. Турбокомпрессоров у ЯМЗ-240М2 нет: воздух засасывают сами поршни.', p: { view: 'back', select: 'manifold_ex' } },
      { title: 'Перёд и зад', text: 'Спереди — гаситель колебаний и шкив привода, сзади — маховик, а между блоком и маховиком шестерни распределения. Перёд и зад важно знать: от переднего торца считают номера цилиндров.', p: { view: 'iso', casing: 1, select: 'flywheel', numbers: true } },
    ],
  }),
  'v12-front': engineScene({
    title: 'Вид спереди: развал 90°',
    base: { numbers: false },
    steps: [
      { title: 'Вид с переднего торца', text: 'Смотрим на двигатель спереди. Видно букву «V»: два ряда цилиндров под прямым углом друг к другу.', p: { view: 'front', casing: 1 } },
      { title: 'Разрез: развал 90°', text: 'Режем двигатель поперёк через первую пару цилиндров (1 и 7). Угол между рядами у ЯМЗ-240 — 90°. Внутри разреза стенки подкрашены.', p: { section: 'x', pair: 1 } },
      { title: 'Два шатуна на одной шейке', text: 'Шатуны левого и правого цилиндра пары сидят рядом на одной шатунной шейке вала.', p: { section: 'x', pair: 1, select: 'rod' } },
      { title: 'Распредвал в развале', text: 'Один распределительный вал лежит в развале между рядами и управляет клапанами обоих рядов.', p: { section: 'x', pair: 1, select: 'camshaft' } },
      { title: 'Впуск внутри, выпуск снаружи', text: 'Впускной коллектор — в развале, выпускные коллекторы — по наружным сторонам рядов.', p: { view: 'front', casing: 1, layer: 'air' } },
    ],
  }),
  'v12-numbering': engineScene({
    title: 'Нумерация цилиндров и порядок работы',
    base: { view: 'top', numbers: true, casing: 0.3 },
    steps: [
      { title: 'Вид сверху', text: 'Слева на экране — перёд двигателя (гаситель колебаний), справа — маховик. Номера цилиндров висят над головками.', p: { playing: false } },
      { title: 'Ряд 1–6', text: 'Считают от переднего торца: в одном ряду цилиндры с 1 по 6. В документации ЯМЗ этот ряд называют правым — какую сторону считают правой, проверьте по ТК.', p: { playing: false, enter: (e) => litSeq(e, [1, 2, 3, 4, 5, 6]) } },
      { title: 'Ряд 7–12', text: 'Во втором ряду — с 7 по 12, тоже от переда. Цилиндр 7 сидит на одной шейке вала с цилиндром 1, 8 — с 2 и так далее.', p: { playing: false, enter: (e) => litSeq(e, [7, 8, 9, 10, 11, 12]) } },
      {
        title: 'Порядок работы',
        text: `Рабочий ход идёт не подряд, а по порядку работы: ${FIRING.join('–')}. Интервалы неравные: поочерёдно 90° и 30° поворота вала. Подсвечен цилиндр, где сейчас начался рабочий ход.`,
        p: { speed: 0.5, onCycle: firingHighlight },
      },
    ],
  }),
  'four-stroke': engineScene({
    title: 'Четыре такта дизеля',
    // один цилиндр крупно: поршень с шатуном на валу, клапаны с приводом от распредвала, форсунка
    base: { op: true, follow: 1, numbers: false, solo: 1, show: ONE_CYL, fly: CYL1, onCycle: valveNote },
    steps: [
      { title: 'Впуск', text: 'Поршень идёт вниз, впускной клапан открыт: поршень засасывает в цилиндр чистый воздух (наддува у 240М2 нет).', p: { loop: [360, 540, 45] } },
      { title: 'Сжатие', text: 'Клапаны закрыты, поршень идёт вверх и сжимает воздух. Воздух сильно нагревается.', p: { loop: [540, 714, 45] } },
      { title: 'Впрыск и рабочий ход', text: 'В конце сжатия форсунка впрыскивает топливо, оно само воспламеняется. Газы давят на поршень — это единственный такт, когда поршень толкает вал.', p: { loop: [700, 900, 40] } },
      { title: 'Выпуск', text: 'Выпускной клапан открыт, поршень идёт вверх и выталкивает газы в выпускной коллектор.', p: { loop: [180, 360, 45] } },
      { title: 'Весь цикл: два оборота', text: 'Четыре такта занимают два оборота коленвала (720°), а распредвал за это время делает один оборот: каждый клапан открывается один раз за цикл. Остальные одиннадцать цилиндров работают так же, по очереди.', p: { speed: 0.25 } },
    ],
  }),
  // ---------------------------------------------------------------- engine-03
  'crank-train': engineScene({
    title: 'Кривошипно-шатунный механизм',
    // один цилиндр на валу: гильза полупрозрачная, вид наискосок спереди — видно, как кривошип ведёт шатун
    base: { show: [...PISTON_GRP, 'crank', 'bearing', 'maincap', 'flywheel'], solo: 1, xray: ['liner'], numbers: false, fly: [[-9.3, 3.7, -5.5], [-4.3, 1.2, -0.7]] },
    steps: [
      { title: 'Как ход поршня становится вращением', text: 'Поршень, поршневой палец, шатун и коленвал — это КШМ. Здесь один цилиндр: поршень ходит вверх-вниз в гильзе, шатун передаёт это движение на шатунную шейку, и вал крутится.', p: { speed: 0.5 } },
      { title: 'ВМТ', text: 'Верхняя мёртвая точка: поршень в самом верху, шатун стоит вертикально, кривошип смотрит вверх.', p: { playing: false, theta: 0, select: 'piston' } },
      { title: 'Середина хода', text: 'Вал повернулся примерно на 90°: шатун наклонён сильнее всего, поршень посередине.', p: { playing: false, theta: 90, select: 'rod' } },
      { title: 'НМТ', text: 'Нижняя мёртвая точка: поршень в самом низу. За один оборот вала поршень проходит вниз и вверх.', p: { playing: false, theta: 180, select: 'crank' } },
      { title: 'Шатун и крышка', text: 'Нижняя головка шатуна разъёмная: крышка с двумя болтами, внутри вкладыши. Метки шатуна и крышки должны совпадать.', p: { speed: 0.3, select: 'rodcap' } },
      { title: 'Два шатуна на одной шейке', text: 'У ЯМЗ-240 на каждой шатунной шейке рядом сидят два шатуна: по одному из каждого ряда. Здесь это 1-й и 7-й. Ряды стоят под 90°, поэтому 7-й приходит в ВМТ через 90° после 1-го.', p: { speed: 0.3, solo: [1, 7], show: [...PISTON_GRP, 'crank'], fly: [[-9.6, 6.6, 1.4], [-4.2, 1.0, 0]] } },
    ],
  }),
  // ---------------------------------------------------------------- engine-04
  'timing-marks': engineScene({
    title: 'Метки ГРМ',
    base: { only: ['gear', 'gearmark', 'crank', 'camshaft', 'block', 'damper', 'bearing', 'maincap'], casing: 0.1, numbers: false, fly: REAR_GEARS },
    steps: [
      { title: 'Привод распредвала', text: 'У ЯМЗ-240 шестерни распределения стоят сзади, между блоком и маховиком. Шестерня коленвала через промежуточную крутит шестерню распредвала. У распредвальной зубьев вдвое больше: она делает один оборот за два оборота коленвала.', p: { speed: 0.6, select: 'gear' } },
      { title: 'ВМТ 1-го цилиндра: метки совпали', text: 'Вал поставлен в ВМТ такта сжатия 1-го цилиндра. Красные и синие точки стоят напротив друг друга — так шестерни и ставят.', p: { playing: false, theta: 0, select: 'gearmark' } },
      { title: 'Плюс один оборот', text: 'Повернули вал на 360°: красные метки опять совпали, а синие — нет. Распредвал прошёл только пол-оборота.', p: { playing: false, theta: 360, select: 'gearmark' } },
      { title: 'Проверка двумя оборотами', text: 'После затяжки вал проворачивают на два оборота и снова проверяют: все метки должны совпасть ровно через 720°.', p: { loop: [0, 720, 90], select: 'gearmark', note: 'Медленно: 2 оборота' } },
    ],
  }),
  'valve-train': engineScene({
    title: 'Клапанный механизм',
    base: { only: VALVE_TRAIN, casing: 0.1, numbers: false, fly: VALVE1 },
    steps: [
      { title: 'От кулачка к клапану', text: 'Кулачок распредвала → толкатель → штанга → коромысло → клапан. Так вращение вала превращается в открытие клапана.', p: { speed: 0.35 } },
      { title: 'Кулачок поднимает толкатель', text: 'Когда под толкатель приходит «носик» кулачка, толкатель и штанга идут вверх.', p: { speed: 0.25, select: 'tappet' } },
      { title: 'Коромысло открывает клапан', text: 'Штанга поднимает один конец коромысла, другой конец давит на клапан вниз — клапан открывается.', p: { speed: 0.25, select: 'rocker' } },
      { title: 'Пружина закрывает', text: 'Когда кулачок уходит, пружина возвращает клапан на седло. Поэтому пружины сжимаются и разжимаются в такт.', p: { speed: 0.25, select: 'spring' } },
      { title: 'Здесь регулируют зазор', text: 'На коромысле — регулировочный винт с контргайкой. Им выставляют тепловой зазор, только при закрытом клапане.', p: { playing: false, theta: 0, select: 'adjscrew' } },
    ],
  }),
  'valve-timing': engineScene({
    title: 'Фазы газораспределения',
    // один цилиндр: видно, где поршень, когда кулачок открывает каждый клапан; подпись — состояние клапанов
    base: { op: true, follow: 1, numbers: false, solo: 1, show: ONE_CYL, fly: CYL1, fx: { forces: false, fuel: false, fire: false }, onCycle: valveNote },
    steps: [
      { title: 'Впуск открывается до ВМТ', text: 'Впускной клапан начинает открываться ещё до того, как поршень дошёл до верха (до ВМТ). Так цилиндр лучше наполняется.', p: { loop: [300, 380, 18] } },
      { title: 'Перекрытие клапанов', text: 'Около ВМТ открыты оба клапана: свежий воздух продувает цилиндр и выталкивает остатки газов.', p: { loop: [330, 400, 14] } },
      { title: 'Впуск закрывается после НМТ', text: 'Впускной закрывается уже после нижней точки: воздух по инерции ещё входит в цилиндр.', p: { loop: [520, 620, 20] } },
      { title: 'Выпуск открывается до НМТ', text: 'Выпускной открывается раньше нижней точки: газы под остаточным давлением сами вырываются в коллектор.', p: { loop: [100, 200, 20] } },
      { title: 'Полный цикл', text: 'Все моменты открытия и закрытия вместе называют фазами газораспределения. Их задаёт распредвал, поэтому шестерни ставят строго по меткам.', p: { speed: 0.2 } },
    ],
  }),
  // ---------------------------------------------------------------- engine-05
  'fuel-path': engineScene({
    title: 'Путь топлива',
    // только топливная аппаратура; поршни и гильзы — там, где нужен цилиндр
    base: { op: true, numbers: false, show: FUEL, fx: FUEL_FX },
    steps: [
      { title: 'Фильтр', text: 'Топливо от бака приходит по тонкой трубке в корпус фильтра, проходит бумажную шторку снаружи внутрь — грязь и вода остаются в банке — и по центральной трубке выходит к насосу.', p: { op: false, flows: ['fuel'], show: ['fuelline', 'fuelfilter', 'fuelel'], fly: [[0.6, 1.4, -6.6], [3.0, -0.35, -1.95]] } },
      { title: 'Линия к ТНВД', text: 'От фильтра топливо под небольшим давлением идёт по трубке назад вдоль блока и поднимается к ТНВД — секционному насосу высокого давления в развале.', p: { op: false, flows: ['fuel'], show: ['fuelline', 'fuelfilter', 'fuelel', 'pump'], select: 'fuelline', fly: [[3.5, 4.5, -10], [4.6, 1.2, -1.0]] } },
      { title: 'ТНВД и трубки высокого давления', text: 'ТНВД по очереди посылает порцию топлива по трубке к форсунке нужного цилиндра — по порядку работы. Давление здесь в сотни раз выше, чем до насоса.', p: { speed: 0.25, select: 'hpline', fly: [[8, 9, -8], [2.0, 3.4, 0]], fx: { ...FUEL_FX, fire: false } } },
      { title: 'Впрыск в цилиндр', text: 'Форсунка распыляет топливо в раскалённый сжатый воздух в конце такта сжатия — и оно вспыхивает.', p: { loop: [690, 730, 8], follow: 1, solo: 1, show: [...FUEL, 'piston', 'rings', 'liner'], fx: { ...FUEL_FX, gas: true }, fly: [[-9.2, 4.6, -5.4], [-4.5, 2.4, -1.4]] } },
      { title: 'Все цилиндры', text: 'Порции идут одна за другой по порядку работы, поочерёдно через 90° и 30° поворота вала. Трубки ставят строго по номерам цилиндров.', p: { speed: 0.3, show: [...FUEL, 'piston', 'liner'], view: 'iso' } },
    ],
  }),
  // ---------------------------------------------------------------- engine-06
  systems: engineScene({
    title: 'Контуры: масло, вода, воздух, выпуск',
    base: { numbers: false, view: 'iso', casing: 0.3 },
    steps: ['oil', 'water', 'air', 'exhaust', 'fuel'].map((k) => ({
      title: ROUTES[k].title,
      text: ROUTES[k].route.join(' → '),
      p: { layer: k, speed: 0.6 },
    })),
  }),
  // ---------------------------------------------------------------- assembly-01
  'assembly-route': engineScene({
    title: 'Маршрут сборки по шагам',
    base: { numbers: false, casing: 0.3, playing: false },
    steps: ASSEMBLY.map((st, i) => {
      const only = new Set()
      ASSEMBLY.slice(0, i + 1).forEach((s) => s.show.forEach((id) => only.add(id)))
      const last = i === ASSEMBLY.length - 1 && !st.show.length
      return {
        title: st.title,
        text: [...(st.do || []).slice(0, 2), st.check?.[0] ? 'Контроль: ' + st.check[0] : ''].filter(Boolean).join('. ') + '.',
        p: last ? { view: 'iso', playing: true, speed: 0.4 } : { only: [...only], fresh: st.show, focus: i === 0 ? null : st.focus, view: i === 0 ? 'iso' : null },
      }
    }),
  }),
}

// подпись: угол вала и состояние клапанов 1-го цилиндра (сцены про такты и фазы)
function valveNote(eng, cycle, theta, h) {
  const psi = ((theta % 720) + 720) % 720
  const dead = Math.round(psi / 180) * 180 // ближайшая мёртвая точка: 0, 360, 720 — ВМТ, 180, 540 — НМТ
  const at = Math.abs(psi - dead) < 6 ? ` · поршень в ${dead % 360 ? 'НМТ' : 'ВМТ'}` : ''
  h.note(`Вал ${Math.round(psi)}° · впускной ${isOpen(psi, IN_WIN) ? 'открыт' : 'закрыт'} · выпускной ${isOpen(psi, EX_WIN) ? 'открыт' : 'закрыт'}${at}`)
}

// подсветить цилиндры по очереди (шаги про нумерацию)
let seqTimer = 0
function litSeq(eng, list) {
  clearInterval(seqTimer)
  let i = 0
  eng.setCylinder(list[0], { focus: false })
  seqTimer = setInterval(() => {
    i = (i + 1) % list.length
    try {
      eng.setCylinder(list[i], { focus: false })
    } catch {
      clearInterval(seqTimer)
    }
  }, 650)
}
function firingHighlight(eng, cycle, theta, h) {
  clearInterval(seqTimer)
  // цилиндр, у которого последним начался рабочий ход
  let best = null, bestD = 1e9
  for (const c of FIRING) {
    const d = (((theta - FIRE_AT[c]) % 720) + 720) % 720
    if (d < bestD) (bestD = d), (best = c)
  }
  eng.setCylinder(best, { focus: false })
  h.note(`Рабочий ход: ${best}`)
}
