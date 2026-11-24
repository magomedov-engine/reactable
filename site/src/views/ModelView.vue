<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createEngine, FIRING } from '../model3d/engineModel.js'
import { PARTS, PART, GROUPS, SYSTEMS, STROKES } from '../model3d/partsInfo.js'
import { DETAILS, QUIZ } from '../model3d/partsDetails.js'
import { ASSEMBLY, TIGHTEN } from '../model3d/assemblySteps.js'
import { ROUTES } from '../model3d/systemRoutes.js'
import { cylState, EPS } from '../model3d/operation.js'
import { getLesson, getTerm } from '../lib/content.js'
import { ui } from '../lib/store.js'

const route = useRoute()
const router = useRouter()
const host = ref(null)
let eng = null

const s = reactive({
  selected: null,
  pickCyl: null,
  pickLabel: '',
  layer: 'all',
  casing: 0.3,
  explode: 0,
  playing: true,
  speed: 1,
  numbers: true,
  cylinder: null,
})
const tab = ref('parts')
const cycle = ref({})
const theta = ref(0)
const label = ref(null)
const hover = reactive({ id: null, x: 0, y: 0, cyl: null })
const sheetOpen = ref(false)
const failed = ref(false)

const info = computed(() => (s.selected ? PART[s.selected] : null))
const det = computed(() => (s.selected ? DETAILS[s.selected] || null : null))
const infoLesson = computed(() => (info.value?.lesson ? getLesson(info.value.lesson) : null))
const infoTerms = computed(() => (info.value?.terms || []).map((t) => getTerm(t)).filter(Boolean))
const groups = GROUPS.map((g) => ({ ...g, parts: PARTS.filter((p) => p.group === g.id) }))
const layers = [{ id: 'all', title: 'Все', color: '' }, ...['oil', 'water', 'air', 'fuel', 'exhaust'].map((id) => ({ id, ...SYSTEMS[id] }))]
const layerRoute = computed(() => ROUTES[s.layer] || null)
const casings = [
  { v: 1, t: 'Сплошной' },
  { v: 0.3, t: 'Прозрачный' },
  { v: 0, t: 'Скрыт' },
]
const views = [
  { id: 'iso', t: '3/4' },
  { id: 'front', t: 'Спереди' },
  { id: 'side', t: 'Сбоку' },
  { id: 'top', t: 'Сверху' },
  { id: 'back', t: 'Сзади' },
]
const tabs = [
  { id: 'parts', t: 'Детали' },
  { id: 'assembly', t: 'Сборка' },
  { id: 'work', t: 'Работа' },
  { id: 'practice', t: 'Тренажёр' },
]

function select(id, focus = false) {
  s.selected = id
  if (!id) s.pickCyl = null
  eng?.select(id, { focus, keepMesh: !focus })
  router.replace({ query: id ? { part: id } : {} })
}
function pickFromList(id) {
  s.pickCyl = null
  s.pickLabel = ''
  select(s.selected === id ? null : id, s.selected !== id)
  if (window.innerWidth < 1024 && s.selected) sheetOpen.value = true
}
function focusChip(id) {
  s.pickCyl = null
  s.pickLabel = ''
  select(id, true)
}

onMounted(async () => {
  try {
    eng = createEngine(host.value, {
      onPick(id, meta) {
        if (tab.value === 'practice' && quiz.running && id) return answerQuiz(id, meta)
        s.pickCyl = meta?.cyl || null
        s.pickLabel = meta?.label || ''
        s.selected = id
        eng.select(id, { keepMesh: true })
        router.replace({ query: id ? { part: id } : {} })
      },
      onHover(id, x, y, cyl) {
        hover.id = quiz.running && tab.value === 'practice' ? null : id
        hover.cyl = cyl || null
        if (id) {
          const r = host.value.getBoundingClientRect()
          hover.x = x - r.left
          hover.y = y - r.top
        }
      },
      onLabel(p) {
        label.value = p
      },
      onCycle(c, t) {
        cycle.value = c
        theta.value = t
      },
    })
  } catch (e) {
    console.error(e)
    failed.value = true
    return
  }
  const q = route.query.part
  if (q && PART[q]) setTimeout(() => select(q, true), 300)
})
onBeforeUnmount(() => eng?.dispose())

// страховка для старых браузеров без overflow: clip — контейнер страницы модели не должен прокручиваться
function unscroll(e) {
  const el = e.currentTarget
  if (el.scrollTop || el.scrollLeft) el.scrollTop = el.scrollLeft = 0
}

// переход по ссылке «Посмотреть в 3D», когда страница модели уже открыта
watch(
  () => route.query.part,
  (q) => {
    if (q && PART[q] && q !== s.selected) {
      s.pickCyl = null
      s.pickLabel = ''
      select(q, true)
    }
  },
)
watch(() => s.layer, (v) => eng?.setLayer(v))
watch(() => s.casing, (v) => eng?.setCasing(v))
watch(() => s.explode, (v) => eng?.setExplode(Number(v)))
watch(() => s.playing, (v) => eng?.setPlaying(v))
watch(() => s.speed, (v) => eng?.setSpeed(v))
watch(() => s.numbers, (v) => eng?.setNumbers(v))

function chooseCylinder(c) {
  s.cylinder = s.cylinder === c ? null : c
  eng?.setCylinder(s.cylinder)
}
const crankAngle = computed(() => Math.round(theta.value % 360))
const cycleAngle = computed(() => Math.round(theta.value))

// ================================================================
// разрез
const sect = reactive({ mode: 'none', pair: 1 })
const sectModes = [
  { id: 'none', t: 'Нет' },
  { id: 'x', t: 'Поперёк' },
  { id: 'bank', t: 'Вдоль ряда' },
]
function setSection(mode, pair = sect.pair) {
  sect.mode = mode
  sect.pair = pair
  eng?.setSection(mode, pair)
}

// ================================================================
// сборка по шагам
const asm = reactive({ i: 0 })
const step = computed(() => ASSEMBLY[asm.i])
const stepParts = computed(() => (step.value?.show || []).filter((id) => PART[id]))
const stepLesson = computed(() => (step.value?.lesson ? getLesson(step.value.lesson) : null))
const stepTighten = computed(() => stepParts.value.map((id) => TIGHTEN?.[id]).filter(Boolean))
function shownUpTo(i) {
  const set = new Set()
  for (const st of ASSEMBLY.slice(0, i + 1)) st.show.forEach((id) => set.add(id))
  return set
}
function applyStep(fly = true) {
  const st = step.value
  if (!st || !eng) return
  const last = asm.i === ASSEMBLY.length - 1 && !st.show.length
  eng.setOnly(last ? null : shownUpTo(asm.i), new Set(st.show))
  if (last) s.playing = true
  if (fly) {
    if (st.focus && PART[st.focus]) eng.focusPart(st.focus)
    else eng.view('iso')
  }
}
function goStep(i) {
  asm.i = Math.max(0, Math.min(ASSEMBLY.length - 1, i))
  select(null)
  applyStep()
}
function enterAssembly() {
  s.playing = false
  s.explode = 0
  s.layer = 'all'
  setSection('none')
  select(null)
  applyStep()
}
function leaveAssembly() {
  eng?.setOnly(null)
}

// ================================================================
// тренажёр
const quiz = reactive({ running: false, order: [], i: 0, score: 0, tries: 0, state: null, wrong: '', hint: false, done: false })
const question = computed(() => (quiz.running ? QUIZ[quiz.order[quiz.i]] : null))
function shuffle(n) {
  const a = [...Array(n).keys()]
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function startQuiz() {
  Object.assign(quiz, { running: true, order: shuffle(QUIZ.length).slice(0, 10), i: 0, score: 0, tries: 0, state: null, wrong: '', hint: false, done: false })
  select(null)
  s.explode = 0.35
  s.casing = 0.3
  eng?.view('iso')
}
function stopQuiz() {
  quiz.running = false
  quiz.done = false
  select(null)
}
function answerQuiz(id) {
  if (quiz.state === 'ok') return
  const q = question.value
  quiz.tries++
  if (id === q.answer) {
    if (quiz.tries === 1) quiz.score++
    quiz.state = 'ok'
    s.selected = id
    eng.select(id, { keepMesh: true })
  } else {
    quiz.state = 'bad'
    quiz.wrong = PART[id]?.name || ''
  }
}
function nextQuestion() {
  if (quiz.i + 1 >= quiz.order.length) {
    quiz.running = false
    quiz.done = true
    select(null)
    return
  }
  quiz.i++
  Object.assign(quiz, { tries: 0, state: null, wrong: '', hint: false })
  select(null)
}
function revealAnswer() {
  quiz.state = 'shown'
  quiz.tries = 99
  select(question.value.answer, true)
}

// метки ГРМ и регулировка тепловых зазоров
const FIRE_AT = Object.fromEntries(FIRING.map((c, i) => [c, i * 60]))
const IN_WIN = [340, 590]
const EX_WIN = [130, 380]
const MARGIN = 15
const mod = (a, m) => ((a % m) + m) % m
const closed = (psi, [a, b]) => psi > b + MARGIN || psi < a - MARGIN
// какие клапаны сейчас можно проверять щупом (кулачок на «спинке» с запасом)
const freeValves = computed(() => {
  const out = []
  for (const c of FIRING) {
    const psi = mod(theta.value - FIRE_AT[c], 720)
    const i = closed(psi, IN_WIN), e = closed(psi, EX_WIN)
    if (i || e) out.push({ c, i, e })
  }
  return out
})
const freeCount = computed(() => freeValves.value.reduce((n, v) => n + v.i + v.e, 0))
function setTdc(c, { marks = false } = {}) {
  s.playing = false
  setSection('none')
  eng?.setTheta(FIRE_AT[c])
  if (marks) {
    s.cylinder = null
    eng?.setCylinder(null)
    select('gearmark')
    eng?.view('front')
  } else {
    s.cylinder = c
    eng?.setCylinder(c)
  }
}
function turnCrank(deg) {
  s.playing = false
  eng?.setTheta(theta.value + deg)
}

// ================================================================
// работа двигателя
const work = reactive({
  follow: 1,
  allForces: false,
  cut: false,
  fx: { gas: true, air: true, fuel: true, fire: true, exhaust: true, forces: true, glass: true },
})
const FX = [
  { id: 'air', t: 'Воздух: впуск и наддув', c: '#a2c08f' },
  { id: 'fuel', t: 'Топливо: подача и впрыск', c: '#c47a45' },
  { id: 'fire', t: 'Вспышка и сгорание', c: '#e3874a' },
  { id: 'exhaust', t: 'Выхлоп и турбина', c: '#958e84' },
  { id: 'gas', t: 'Газ в цилиндре (цвет — температура)', c: '#86a8c6' },
  { id: 'forces', t: 'Силы: кто толкает поршень', c: '#d0644f' },
  { id: 'glass', t: 'Прозрачные стенки', c: '#8c8880' },
]
const PHASES = {
  intake: { t: 'Впуск', c: '#8aa37b', text: 'Поршень идёт вниз, впускной клапан открыт. Турбокомпрессор нагнетает в цилиндр свежий воздух под давлением. Топлива в нём нет: дизель набирает чистый воздух.' },
  compression: { t: 'Сжатие', c: '#6f8fa8', text: `Оба клапана закрыты. Поршень идёт вверх и сжимает воздух примерно в ${EPS} раз. От сжатия воздух сильно нагревается.` },
  injection: { t: 'Впрыск', c: '#c47a45', text: 'Незадолго до ВМТ форсунка распыляет топливо через несколько отверстий распылителя. Капли попадают в раскалённый воздух и воспламеняются сами: свечи зажигания у дизеля нет.' },
  combustion: { t: 'Сгорание', c: '#b0584a', text: 'Топливо горит, давление газов резко растёт и с огромной силой давит на днище поршня. Это единственный такт, когда поршень толкает вал, а не вал поршень.' },
  expansion: { t: 'Рабочий ход', c: '#b0584a', text: 'Газы расширяются и толкают поршень вниз, через шатун он крутит коленвал. Давление и температура падают.' },
  blowdown: { t: 'Начало выпуска', c: '#d0734f', text: 'Выпускной клапан открылся ещё до НМТ: газы под остаточным давлением вырываются в коллектор и раскручивают турбину.' },
  exhaust: { t: 'Выпуск', c: '#8c8880', text: 'Поршень идёт вверх и выталкивает отработавшие газы через выпускной клапан в коллектор и дальше на турбину.' },
}
const wPsi = computed(() => mod(theta.value - FIRE_AT[work.follow], 720))
const wState = computed(() => cylState(wPsi.value))
const valveOpen = (psi, [a, b]) => psi > a && psi < b
const wValves = computed(() => ({ in: valveOpen(wPsi.value, IN_WIN), ex: valveOpen(wPsi.value, EX_WIN) }))
const wPhase = computed(() => {
  if (wValves.value.in && wValves.value.ex) return { t: 'Перекрытие клапанов', c: '#7fa39a', text: 'Открыты оба клапана: свежий воздух продувает цилиндр и выдувает остатки газов в выпуск.' }
  return PHASES[wState.value.phase]
})
const wPiston = computed(() => {
  const a = wState.value.a
  const down = a > 0 ? a < 180 : a < -180
  const gas = wState.value.phase === 'combustion' || wState.value.phase === 'expansion'
  return { dir: down ? 'вниз' : 'вверх', arrow: down ? '↓' : '↑', who: gas ? 'давление газов' : 'коленвал: его крутят маховик и рабочие ходы других цилиндров' }
})
const powerNow = computed(() => FIRING.filter((c) => cycle.value[c] === 0))

// график давления в цилиндре по углу поворота вала
const CH = { w: 320, h: 150, l: 30, r: 8, t: 10, b: 22, pMax: 170 }
const cx = (a) => CH.l + ((a + 360) / 720) * (CH.w - CH.l - CH.r)
const cy_ = (p) => CH.h - CH.b - (Math.min(p, CH.pMax) / CH.pMax) * (CH.h - CH.t - CH.b)
const chartPath = (() => {
  let d = ''
  for (let a = -360; a <= 360; a += 3) d += (d ? 'L' : 'M') + cx(a).toFixed(1) + ' ' + cy_(cylState(mod(a, 720)).p).toFixed(1)
  return d
})()
const chartBands = [
  { a0: -360, a1: -180, c: '#8aa37b', t: 'Впуск' },
  { a0: -180, a1: 0, c: '#6f8fa8', t: 'Сжатие' },
  { a0: 0, a1: 180, c: '#b0584a', t: 'Рабочий' },
  { a0: 180, a1: 360, c: '#8c8880', t: 'Выпуск' },
]
const chartMark = computed(() => ({ x: cx(wState.value.a), y: cy_(wState.value.p) }))

function workFollow(c) {
  work.follow = c
  s.cylinder = c
  eng?.setCylinder(c, { focus: false })
  eng?.opFollow(c, { fly: !work.cut, all: work.allForces })
  if (work.cut) setSection('x', ((c - 1) % 6) + 1)
}
function workFx(id) {
  work.fx[id] = !work.fx[id]
  eng?.setOpFx(id, work.fx[id])
}
function workCut() {
  work.cut = !work.cut
  if (work.cut) setSection('x', ((work.follow - 1) % 6) + 1)
  else setSection('none')
}
watch(() => work.allForces, (v) => eng?.opFollow(work.follow, { all: v }))
function enterWork() {
  s.explode = 0
  s.layer = 'all'
  setSection('none')
  work.cut = false
  select(null)
  s.speed = 0.25
  s.playing = true
  eng?.setOperation(true)
  workFollow(work.follow)
}
function leaveWork() {
  eng?.setOperation(false)
  if (work.cut) setSection('none')
  work.cut = false
  s.speed = 1
  s.cylinder = null
  eng?.setCylinder(null)
}
const speeds = computed(() => (tab.value === 'work' ? [0.1, 0.25, 0.5, 1] : [0.25, 0.5, 1, 2]))

// переключение вкладок
watch(tab, (t, prev) => {
  if (prev === 'assembly') leaveAssembly()
  if (prev === 'practice' && quiz.running) stopQuiz()
  if (prev === 'work') leaveWork()
  if (t === 'assembly') enterAssembly()
  if (t === 'work') enterWork()
})

function onKey(e) {
  if (/input|textarea/i.test(document.activeElement?.tagName || '') || ui.searchOpen) return
  if (e.key === ' ') {
    e.preventDefault()
    s.playing = !s.playing
  } else if (e.key === 'Escape') select(null)
  else if (tab.value === 'assembly' && e.key === 'ArrowRight') goStep(asm.i + 1)
  else if (tab.value === 'assembly' && e.key === 'ArrowLeft') goStep(asm.i - 1)
  else if (!s.playing && e.key === 'ArrowRight') eng?.step(5)
  else if (!s.playing && e.key === 'ArrowLeft') eng?.step(-5)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const hoverName = computed(() => (hover.id ? PART[hover.id]?.name : ''))
const titleName = computed(() => {
  if (!info.value) return ''
  if (s.pickLabel) return s.pickLabel
  return info.value.name
})
const sheetTitle = computed(() => {
  if (tab.value === 'assembly' && step.value) return `Шаг ${asm.i + 1}: ${step.value.title}`
  if (tab.value === 'practice' && question.value) return 'Найдите деталь'
  if (tab.value === 'work') return `${wPhase.value.t} · цилиндр ${work.follow}`
  return info.value ? titleName.value : 'Детали и настройки'
})
</script>

<template>
  <div class="model-page" @scroll="unscroll">
    <div class="stage" @scroll="unscroll">
      <div ref="host" class="stage-canvas" />

      <div v-if="failed" class="stage-error">
        <p>Не удалось запустить 3D: браузер не поддерживает WebGL или он отключён.</p>
      </div>

      <!-- подпись выбранной детали -->
      <div v-if="info && label" class="m-label" :style="{ left: label.x + 'px', top: label.y + 'px' }">
        <span>{{ titleName }}</span>
        <small v-if="s.pickCyl">цилиндр {{ s.pickCyl }}</small>
      </div>
      <div v-if="hover.id && hover.id !== s.selected" class="m-hover" :style="{ left: hover.x + 'px', top: hover.y + 'px' }">
        {{ hoverName }}<template v-if="hover.cyl"> · {{ hover.cyl }}</template>
      </div>

      <!-- такты по порядку работы -->
      <div class="hud">
        <div class="hud-title">
          Порядок работы <span class="hud-angle">вал {{ crankAngle }}° · цикл {{ cycleAngle }}°</span>
        </div>
        <div class="hud-strip">
          <button
            v-for="c in FIRING"
            :key="c"
            type="button"
            class="hud-cyl"
            :class="{ active: s.cylinder === c, power: cycle[c] === 0 }"
            :style="{ '--sc': STROKES[cycle[c] ?? 0].color }"
            :title="`Цилиндр ${c}: ${STROKES[cycle[c] ?? 0].title}`"
            @click="chooseCylinder(c)"
          >
            {{ c }}
          </button>
        </div>
        <div class="hud-legend">
          <span v-for="st in STROKES" :key="st.id"><i :style="{ background: st.color }" />{{ st.title }}</span>
        </div>
      </div>

      <!-- нижняя панель -->
      <div v-if="tab === 'assembly' && step" class="dock dock-asm">
        <button class="dock-btn" type="button" :disabled="asm.i === 0" aria-label="Предыдущий шаг" @click="goStep(asm.i - 1)">←</button>
        <div class="dock-step">
          <small>Шаг {{ asm.i + 1 }} из {{ ASSEMBLY.length }}</small>
          <b>{{ step.title }}</b>
        </div>
        <button class="dock-btn primary" type="button" :disabled="asm.i === ASSEMBLY.length - 1" aria-label="Следующий шаг" @click="goStep(asm.i + 1)">→</button>
      </div>
      <div v-else class="dock">
        <button class="dock-btn play" type="button" :aria-label="s.playing ? 'Пауза' : 'Запустить'" @click="s.playing = !s.playing">
          <svg v-if="s.playing" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
        </button>
        <template v-if="!s.playing">
          <button class="dock-btn" type="button" title="Повернуть вал назад на 10°" @click="eng?.step(-10)">−10°</button>
          <button class="dock-btn" type="button" title="Повернуть вал вперёд на 10°" @click="eng?.step(10)">+10°</button>
        </template>
        <div v-else class="seg">
          <button v-for="v in speeds" :key="v" type="button" :class="{ on: s.speed === v }" @click="s.speed = v">{{ v }}×</button>
        </div>
        <label v-if="tab !== 'work'" class="dock-range">
          <span>Разборка</span>
          <input v-model.number="s.explode" type="range" min="0" max="1" step="0.01" />
        </label>
      </div>
    </div>

    <!-- боковая панель / нижний лист на телефоне -->
    <aside class="mpanel" :class="{ open: sheetOpen }">
      <button class="sheet-handle" type="button" @click="sheetOpen = !sheetOpen">
        <span class="grip" />
        <span>{{ sheetTitle }}</span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6" /></svg>
      </button>
      <div class="mpanel-scroll">
        <div class="mp-head">
          <h1>3D-модель V12</h1>
          <p>Схематичный «типовой» дизель: развал 60°, 12 цилиндров. Нажмите на деталь, чтобы узнать, что это.</p>
        </div>

        <div class="mp-tabs" role="tablist">
          <button v-for="t in tabs" :key="t.id" type="button" role="tab" :aria-selected="tab === t.id" :class="{ on: tab === t.id }" @click="tab = t.id">{{ t.t }}</button>
        </div>

        <!-- ================= ДЕТАЛИ ================= -->
        <template v-if="tab === 'parts'">
          <Transition name="pop" mode="out-in">
            <section v-if="info" :key="s.selected" class="part-card">
              <div class="pc-top">
                <span class="pc-sys" :style="{ '--c': SYSTEMS[info.system].color }">{{ SYSTEMS[info.system].title }}</span>
                <span v-if="info.count > 1" class="pc-count">× {{ info.count }}</span>
                <button class="icon-btn small" type="button" aria-label="Снять выбор" @click="select(null)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <h2>{{ titleName }}<small v-if="s.pickCyl"> · цилиндр {{ s.pickCyl }}</small></h2>
              <p>{{ info.desc }}</p>
              <div v-if="info.look?.length" class="pc-look">
                <div class="pc-sub">На что смотрит сборщик</div>
                <ul>
                  <li v-for="l in info.look" :key="l">{{ l }}</li>
                </ul>
              </div>

              <template v-if="det">
                <details v-if="det.how" class="pc-more" open>
                  <summary>Как работает</summary>
                  <p>{{ det.how }}</p>
                </details>
                <details v-if="det.steps?.length" class="pc-more">
                  <summary>Как ставят</summary>
                  <ol>
                    <li v-for="x in det.steps" :key="x">{{ x }}</li>
                  </ol>
                </details>
                <details v-if="det.tools?.length || det.measure" class="pc-more">
                  <summary>Инструмент и контроль</summary>
                  <div v-if="det.tools?.length" class="pc-tools">
                    <span v-for="x in det.tools" :key="x" class="tool">{{ x }}</span>
                  </div>
                  <p v-if="det.measure" class="pc-measure"><b>Замер:</b> {{ Array.isArray(det.measure) ? det.measure.join('; ') : det.measure }}</p>
                </details>
                <details v-if="det.mistakes?.length" class="pc-more warn">
                  <summary>Типичные ошибки</summary>
                  <ul>
                    <li v-for="x in det.mistakes" :key="x">{{ x }}</li>
                  </ul>
                </details>
                <details v-if="det.facts?.length" class="pc-more">
                  <summary>Интересно</summary>
                  <ul>
                    <li v-for="x in [].concat(det.facts)" :key="x">{{ x }}</li>
                  </ul>
                </details>
              </template>

              <div class="pc-links">
                <RouterLink v-if="infoLesson" :to="`/lesson/${infoLesson.id}`" class="pc-lesson">
                  <span>Урок</span>{{ infoLesson.title }}
                </RouterLink>
                <div v-if="infoTerms.length" class="pc-terms">
                  <RouterLink v-for="t in infoTerms" :key="t.slug" :to="`/glossary/${t.slug}`" class="chip">{{ t.term }}</RouterLink>
                </div>
              </div>
              <button class="link-btn" type="button" @click="eng?.focusPart(s.selected)">Приблизить к детали →</button>
            </section>
            <section v-else class="hint-card">
              <div><b>Мышь:</b> вращать — левая кнопка, сдвиг — правая, масштаб — колесо. Двойной клик — приблизить деталь.</div>
              <div><b>Телефон:</b> вращать — одним пальцем, масштаб и сдвиг — двумя.</div>
              <div><b>Пробел</b> — пауза; на паузе <b>← →</b> крутят вал по 5°.</div>
            </section>
          </Transition>

          <section class="mp-block">
            <div class="mp-title">Корпус</div>
            <div class="seg wide">
              <button v-for="c in casings" :key="c.v" type="button" :class="{ on: s.casing === c.v }" @click="s.casing = c.v">{{ c.t }}</button>
            </div>
          </section>

          <section class="mp-block">
            <div class="mp-title">Системы</div>
            <div class="layer-chips">
              <button
                v-for="l in layers"
                :key="l.id"
                type="button"
                class="layer-chip"
                :class="{ on: s.layer === l.id }"
                :style="l.color ? { '--c': l.color } : {}"
                @click="s.layer = l.id"
              >
                <i v-if="l.color" />{{ l.title }}
              </button>
            </div>
            <Transition name="pop" mode="out-in">
              <div v-if="layerRoute" :key="s.layer" class="route-card" :style="{ '--c': SYSTEMS[s.layer].color }">
                <div class="pc-sub">{{ layerRoute.title }}</div>
                <ol class="route">
                  <li v-for="r in layerRoute.route" :key="r">{{ r }}</li>
                </ol>
                <p>{{ layerRoute.note }}</p>
              </div>
            </Transition>
          </section>

          <section class="mp-block">
            <div class="mp-title">Разрез</div>
            <div class="seg wide">
              <button v-for="m in sectModes" :key="m.id" type="button" :class="{ on: sect.mode === m.id }" @click="setSection(m.id)">{{ m.t }}</button>
            </div>
            <div v-if="sect.mode === 'x'" class="pair-row">
              <span>Через цилиндры</span>
              <div class="pairs">
                <button v-for="k in 6" :key="k" type="button" :class="{ on: sect.pair === k }" @click="setSection('x', k)">{{ k }}–{{ k + 6 }}</button>
              </div>
            </div>
            <p v-if="sect.mode !== 'none'" class="mp-note">
              <template v-if="sect.mode === 'x'">Поперечный разрез, как на чертеже: видно, как два шатуна разных рядов сидят на одной шейке вала, гильзы в рубашке и клапаны в головках.</template>
              <template v-else>Продольный разрез правого ряда по осям цилиндров: видны все шесть поршней, вал и распредвал.</template>
              Внутренние стенки подкрашены красным.
            </p>
          </section>

          <section class="mp-block">
            <div class="mp-title">Вид</div>
            <div class="seg wide">
              <button v-for="v in views" :key="v.id" type="button" @click="eng?.view(v.id)">{{ v.t }}</button>
            </div>
            <label class="switch">
              <input v-model="s.numbers" type="checkbox" />
              <span class="track"><span class="thumb" /></span>
              Номера цилиндров
            </label>
          </section>

          <section v-for="g in groups" :key="g.id" class="mp-block">
            <div class="mp-title">{{ g.title }}</div>
            <div class="part-list">
              <button
                v-for="p in g.parts"
                :key="p.id"
                type="button"
                class="part-row"
                :class="{ on: s.selected === p.id }"
                @click="pickFromList(p.id)"
              >
                <i :style="{ background: p.color }" />
                <span>{{ p.name }}</span>
                <small v-if="p.count > 1">×{{ p.count }}</small>
              </button>
            </div>
          </section>
        </template>

        <!-- ================= СБОРКА ================= -->
        <template v-else-if="tab === 'assembly' && step">
          <div class="asm-progress">
            <div class="bar"><div class="bar-fill" :style="{ width: ((asm.i + 1) / ASSEMBLY.length) * 100 + '%' }" /></div>
            <span>{{ asm.i + 1 }} / {{ ASSEMBLY.length }}</span>
          </div>
          <Transition name="pop" mode="out-in">
            <section :key="asm.i" class="part-card asm-card">
              <div class="pc-sub">Шаг {{ asm.i + 1 }}</div>
              <h2>{{ step.title }}</h2>
              <div v-if="stepParts.length" class="asm-parts">
                <button v-for="id in stepParts" :key="id" type="button" class="chip new" :class="{ on: s.selected === id }" @click="focusChip(id)">
                  <i :style="{ background: PART[id].color }" />{{ PART[id].name }}
                </button>
              </div>
              <div v-if="step.do?.length" class="asm-sec">
                <div class="pc-sub">Что делаем</div>
                <ol>
                  <li v-for="x in step.do" :key="x">{{ x }}</li>
                </ol>
              </div>
              <div v-if="step.check?.length" class="asm-sec check">
                <div class="pc-sub">Контроль</div>
                <ul>
                  <li v-for="x in step.check" :key="x">{{ x }}</li>
                </ul>
              </div>
              <div v-for="t in stepTighten" :key="t.title" class="asm-sec tighten">
                <div class="pc-sub">{{ t.title }}</div>
                <p>{{ t.note }}</p>
              </div>
              <div v-if="step.doc" class="asm-doc"><b>В карту сборки:</b> {{ step.doc }}</div>
              <div v-if="step.warn" class="asm-warn">{{ step.warn }}</div>
              <RouterLink v-if="stepLesson" :to="`/lesson/${stepLesson.id}`" class="pc-lesson">
                <span>Урок</span>{{ stepLesson.title }}
              </RouterLink>
            </section>
          </Transition>
          <div class="asm-nav">
            <button class="btn-ghost" type="button" :disabled="asm.i === 0" @click="goStep(asm.i - 1)">← Назад</button>
            <button class="btn-primary" type="button" :disabled="asm.i === ASSEMBLY.length - 1" @click="goStep(asm.i + 1)">Далее →</button>
          </div>
          <section v-if="info" class="mini-card">
            <b>{{ info.name }}</b>
            <p>{{ info.desc }}</p>
            <button class="link-btn" type="button" @click="tab = 'parts'">Подробнее о детали →</button>
          </section>
          <section class="mp-block">
            <div class="mp-title">Все шаги</div>
            <ol class="asm-list">
              <li v-for="(st, i) in ASSEMBLY" :key="st.id">
                <button type="button" :class="{ on: i === asm.i, done: i < asm.i }" @click="goStep(i)">
                  <span class="n">{{ i + 1 }}</span>{{ st.title }}
                </button>
              </li>
            </ol>
          </section>
        </template>

        <!-- ================= РАБОТА ================= -->
        <template v-else-if="tab === 'work'">
          <section class="part-card work-live" :style="{ '--c': wPhase.c }">
            <div class="pc-top">
              <span class="pc-sys">{{ wPhase.t }}</span>
              <span class="pc-count">цилиндр {{ work.follow }} · {{ Math.round(wState.a) }}° от ВМТ</span>
            </div>
            <p class="work-text">{{ wPhase.text }}</p>
            <div class="work-stats">
              <div><small>Поршень</small><b>{{ wPiston.arrow }} {{ wPiston.dir }}</b></div>
              <div><small>Давление</small><b>≈ {{ Math.round(wState.p) }} бар</b></div>
              <div><small>Температура</small><b>≈ {{ Math.round(wState.T - 273) }} °C</b></div>
            </div>
            <div class="work-valves">
              <span :class="{ open: wValves.in }" class="vin">Впускной: {{ wValves.in ? 'открыт' : 'закрыт' }}</span>
              <span :class="{ open: wValves.ex }" class="vex">Выпускной: {{ wValves.ex ? 'открыт' : 'закрыт' }}</span>
            </div>
            <p class="mp-note"><b>Поршень двигает:</b> {{ wPiston.who }}.</p>

            <svg class="pchart" :viewBox="`0 0 ${CH.w} ${CH.h}`" role="img" aria-label="Давление в цилиндре по углу поворота вала">
              <g v-for="b in chartBands" :key="b.a0">
                <rect :x="cx(b.a0)" :y="CH.t" :width="cx(b.a1) - cx(b.a0)" :height="CH.h - CH.t - CH.b" :fill="b.c" opacity="0.09" />
                <text :x="(cx(b.a0) + cx(b.a1)) / 2" :y="CH.t + 11" text-anchor="middle" class="pc-band">{{ b.t }}</text>
              </g>
              <g class="pc-axis">
                <line :x1="CH.l" :x2="CH.w - CH.r" :y1="CH.h - CH.b" :y2="CH.h - CH.b" />
                <text v-for="p in [0, 50, 100, 150]" :key="p" :x="CH.l - 4" :y="cy_(p) + 3" text-anchor="end">{{ p }}</text>
                <text v-for="a in [-360, -180, 0, 180, 360]" :key="a" :x="cx(a)" :y="CH.h - 7" text-anchor="middle">{{ Math.abs(a) === 180 ? 'НМТ' : 'ВМТ' }}</text>
              </g>
              <rect :x="cx(-14)" :y="CH.t" :width="cx(0) - cx(-14)" :height="CH.h - CH.t - CH.b" fill="#c47a45" opacity="0.25" />
              <path :d="chartPath" fill="none" stroke="var(--text)" stroke-width="1.6" />
              <line :x1="chartMark.x" :x2="chartMark.x" :y1="CH.t" :y2="CH.h - CH.b" stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 3" />
              <circle :cx="chartMark.x" :cy="chartMark.y" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="1.5" />
            </svg>
            <div class="pchart-cap">Давление в цилиндре, бар (учебная модель). Оранжевая полоса — впрыск.</div>
          </section>

          <section class="mp-block">
            <div class="mp-title">Следить за цилиндром</div>
            <div class="pairs tdc">
              <button v-for="c in FIRING" :key="c" type="button" :class="{ on: work.follow === c }" @click="workFollow(c)">{{ c }}</button>
            </div>
            <div class="quiz-btns">
              <button class="btn-ghost" :class="{ active: work.cut }" type="button" @click="workCut">{{ work.cut ? 'Убрать разрез' : 'Разрез через цилиндр' }}</button>
              <button class="btn-ghost" type="button" @click="workFollow(work.follow)">Камера к цилиндру</button>
            </div>
          </section>

          <section class="mp-block">
            <div class="mp-title">Эффекты</div>
            <div class="fx-list">
              <label v-for="f in FX" :key="f.id" class="switch fx">
                <input type="checkbox" :checked="work.fx[f.id]" @change="workFx(f.id)" />
                <span class="track" :style="{ '--sw': f.c }"><span class="thumb" /></span>
                {{ f.t }}
              </label>
              <label v-if="work.fx.forces" class="switch fx sub">
                <input v-model="work.allForces" type="checkbox" />
                <span class="track"><span class="thumb" /></span>
                Стрелки у всех цилиндров
              </label>
            </div>
          </section>

          <section class="part-card">
            <div class="pc-sub">Почему вал крутится без остановки</div>
            <p class="mp-note">У V12 рабочий ход начинается каждые 60° поворота вала, по порядку работы {{ FIRING.join('–') }}. Поэтому в любой момент 2–3 цилиндра толкают вал, а маховик сглаживает толчки. Поршни остальных цилиндров в это время двигает сам вал: на впуске, сжатии и выпуске.</p>
            <p class="mp-note"><b>Сейчас рабочий ход:</b> {{ powerNow.length ? powerNow.join(', ') : '—' }}</p>
          </section>

          <section class="part-card">
            <div class="pc-sub">Откуда что берётся</div>
            <ul class="work-src">
              <li><i style="background: #8aa37b" /><span><b>Воздух</b> — снаружи через воздушный фильтр (на модели нет) в колёса компрессоров, затем через охладитель во впускной коллектор и к впускным клапанам.</span></li>
              <li><i style="background: #c47a45" /><span><b>Топливо</b> — из бака через фильтр в ТНВД. Насос по очереди посылает порцию по трубке высокого давления к форсунке нужного цилиндра.</span></li>
              <li><i style="background: #958e84" /><span><b>Газы</b> — через выпускные клапаны в коллектор ряда, на турбину и в выпускную трубу. Турбина крутит компрессор: энергия выхлопа идёт на наддув.</span></li>
            </ul>
          </section>
        </template>

        <!-- ================= ТРЕНАЖЁР ================= -->
        <template v-else-if="tab === 'practice'">
          <section class="part-card quiz">
            <div class="pc-sub">Найди деталь</div>
            <template v-if="question">
              <div class="quiz-top"><span>Вопрос {{ quiz.i + 1 }} из {{ quiz.order.length }}</span><span>Верно с первой попытки: {{ quiz.score }}</span></div>
              <h2 class="quiz-q">{{ question.q }}</h2>
              <p v-if="!quiz.state" class="mp-note">Нажмите на эту деталь на модели.</p>
              <p v-if="quiz.state === 'bad'" class="quiz-bad">Это «{{ quiz.wrong }}». Попробуйте ещё.</p>
              <p v-if="quiz.state === 'ok'" class="quiz-ok">Верно: {{ PART[question.answer].name }}.</p>
              <p v-if="quiz.state === 'shown'" class="quiz-bad">Ответ: {{ PART[question.answer].name }}.</p>
              <p v-if="quiz.hint && !quiz.state?.match(/ok|shown/)" class="mp-note">Подсказка: {{ question.hint }}</p>
              <div class="quiz-btns">
                <template v-if="quiz.state === 'ok' || quiz.state === 'shown'">
                  <button class="btn-primary" type="button" @click="nextQuestion">{{ quiz.i + 1 >= quiz.order.length ? 'Итог' : 'Следующий →' }}</button>
                </template>
                <template v-else>
                  <button class="btn-ghost" type="button" :disabled="quiz.hint" @click="quiz.hint = true">Подсказка</button>
                  <button class="btn-ghost" type="button" @click="revealAnswer">Показать</button>
                </template>
                <button class="link-btn" type="button" @click="stopQuiz">Закончить</button>
              </div>
            </template>
            <template v-else>
              <p v-if="quiz.done" class="quiz-ok">Готово: {{ quiz.score }} из {{ quiz.order.length }} с первой попытки.</p>
              <p class="mp-note">10 вопросов по описанию: что делает деталь и где стоит. Отвечаете кликом по модели. Модель немного разобрана, чтобы добраться до внутренних деталей.</p>
              <button class="btn-primary" type="button" @click="startQuiz">{{ quiz.done ? 'Ещё раз' : 'Начать' }}</button>
            </template>
          </section>

          <section class="part-card">
            <div class="pc-sub">Метки ГРМ и ВМТ</div>
            <p class="mp-note">Перед установкой шестерён вал ставят так, чтобы поршень 1-го цилиндра был в ВМТ такта сжатия. Тогда синие метки шестерён совпадают. Красные совпадают каждый оборот, синие — раз в два оборота.</p>
            <div class="quiz-btns">
              <button class="btn-primary" type="button" @click="setTdc(1, { marks: true })">ВМТ 1-го цилиндра</button>
              <button class="btn-ghost" type="button" @click="turnCrank(360)">+360° вала</button>
            </div>
          </section>

          <section class="part-card">
            <div class="pc-sub">Регулировка тепловых зазоров</div>
            <p class="mp-note">Зазор проверяют щупом только у закрытого клапана, когда толкатель стоит на «спинке» кулачка. Поставьте цилиндр в ВМТ сжатия: у него закрыты оба клапана. Ниже список всех клапанов, которые можно проверить в этом положении вала.</p>
            <div class="pairs tdc">
              <button v-for="c in FIRING" :key="c" type="button" :class="{ on: s.cylinder === c && !s.playing }" @click="setTdc(c)">{{ c }}</button>
            </div>
            <div class="free">
              <div class="free-head">Вал {{ cycleAngle }}°: свободно {{ freeCount }} из 24 клапанов</div>
              <div class="free-grid">
                <span v-for="v in freeValves" :key="v.c" :class="{ both: v.i && v.e }">
                  <b>{{ v.c }}</b>
                  <i v-if="v.i" class="vin">вп</i>
                  <i v-if="v.e" class="vex">вып</i>
                </span>
              </div>
              <p class="mp-note">Обычно хватает двух положений вала: ВМТ сжатия 1-го цилиндра и поворот на 360°. Проверьте: нажмите «1», затем «+360°» в блоке выше — вместе они покрывают все 24 клапана. Точный порядок и величины зазоров — по ТК.</p>
            </div>
          </section>
        </template>

        <p class="mp-foot">Модель упрощённая: формы и размеры условные, у вашего двигателя устройство может отличаться. Часть навесного не показана.</p>
      </div>
    </aside>
  </div>
</template>

<style>
.model-page { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 380px; height: calc(100dvh - var(--topbar-h)); overflow: hidden; }
/* clip, а не только hidden: hidden-контейнер браузер сам прокручивает при фокусе на кнопке внутри,
   и вся сцена уезжает вверх. clip такую прокрутку запрещает */
.model-page, .stage { overflow: clip; }
/* страница модели появляется без сдвига: сдвиг на время анимации делал документ выше окна */
.model-page.page-enter-from, .model-page.page-leave-to { transform: none; }
.stage { position: relative; min-width: 0; container-type: size; background: radial-gradient(ellipse at 50% 40%, var(--surface) 0%, var(--bg) 70%); }
.stage-canvas { position: absolute; inset: 0; }
.stage-canvas canvas { display: block; cursor: grab; }
.stage-canvas canvas:active { cursor: grabbing; }
.stage-error { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; text-align: center; color: var(--text-2); }

.m-label {
  position: absolute; transform: translate(-50%, calc(-100% - 14px)); pointer-events: none; white-space: nowrap;
  padding: 6px 12px; border-radius: var(--radius); background: var(--text); color: var(--bg); font-size: 13.5px; font-weight: 650;
  box-shadow: var(--shadow); display: flex; gap: 8px; align-items: baseline; animation: fadein 0.25s var(--ease);
}
.m-label small { font-weight: 500; opacity: 0.7; }
.m-label::after { content: ''; position: absolute; left: 50%; bottom: -6px; width: 10px; height: 10px; background: var(--text); transform: translateX(-50%) rotate(45deg); border-radius: 1px; }
.m-hover { position: absolute; transform: translate(14px, 14px); pointer-events: none; padding: 4px 9px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--border); font-size: 12.5px; font-weight: 600; box-shadow: var(--shadow); white-space: nowrap; }

.hud { position: absolute; left: 16px; top: 16px; padding: 10px 12px; border-radius: var(--radius); background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(10px); border: 1px solid var(--border); box-shadow: var(--shadow-sm); max-width: calc(100% - 32px); }
.hud-title { font-size: 12px; font-weight: 650; color: var(--text-2); display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.hud-angle { color: var(--text-3); font-weight: 500; font-variant-numeric: tabular-nums; }
.hud-strip { display: flex; gap: 4px; }
.hud-cyl {
  width: 30px; height: 30px; border-radius: var(--radius-sm); border: 1.5px solid color-mix(in srgb, var(--sc) 55%, transparent);
  background: color-mix(in srgb, var(--sc) 16%, var(--surface)); color: var(--text); font-weight: 700; font-size: 12.5px;
  transition: background 0.2s, transform 0.2s var(--ease), box-shadow 0.2s; font-variant-numeric: tabular-nums;
}
.hud-cyl.power { background: var(--sc); color: #fff; border-color: var(--sc); transform: translateY(-2px); box-shadow: 0 4px 12px color-mix(in srgb, var(--sc) 45%, transparent); }
.hud-cyl.active { outline: 2px solid var(--accent); outline-offset: 2px; }
.hud-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; font-size: 11.5px; color: var(--text-3); }
.hud-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 1px; margin-right: 5px; vertical-align: -0.5px; }

.dock {
  position: absolute; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom)); transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: var(--radius); max-width: calc(100% - 24px);
  background: color-mix(in srgb, var(--surface) 90%, transparent); backdrop-filter: blur(12px); border: 1px solid var(--border); box-shadow: var(--shadow);
}
.dock-btn { height: 38px; min-width: 38px; padding: 0 10px; border: 0; border-radius: var(--radius); background: var(--surface-2); font-weight: 650; font-size: 13px; display: grid; place-items: center; transition: background 0.15s, transform 0.15s; }
.dock-btn:hover { background: var(--surface-3); }
.dock-btn:active { transform: scale(0.95); }
.dock-btn:disabled { opacity: 0.4; pointer-events: none; }
.dock-btn.play { background: var(--text); color: var(--bg); width: 42px; }
.dock-btn.primary { background: var(--accent); color: var(--accent-ink); font-size: 16px; width: 46px; }
.dock-btn svg { width: 18px; height: 18px; }
.dock-asm { min-width: min(420px, calc(100% - 24px)); }
.dock-step { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 0 6px; line-height: 1.25; }
.dock-step small { font-size: 11.5px; color: var(--text-3); font-weight: 600; }
.dock-step b { font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: var(--radius); background: var(--surface-2); }
.seg button { border: 0; background: none; padding: 6px 9px; border-radius: var(--radius-sm); font-size: 12.5px; font-weight: 600; color: var(--text-2); white-space: nowrap; transition: background 0.15s, color 0.15s; }
.seg button:hover { color: var(--text); }
.seg button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
.seg.wide { display: flex; flex-wrap: wrap; }
.seg.wide button { flex: 1; }
.dock-range { display: flex; align-items: center; gap: 8px; padding: 0 6px; font-size: 12.5px; font-weight: 600; color: var(--text-2); }
.dock-range input { width: 130px; accent-color: var(--accent); }

.mpanel { position: relative; display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--border); background: var(--bg); }
.sheet-handle { display: none; }
.mpanel-scroll { flex: 1; overflow-y: auto; padding: 18px 18px 28px; overscroll-behavior: contain; scrollbar-width: thin; }
.mp-head h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: -0.02em; }
.mp-head p { margin: 0 0 14px; font-size: 13.5px; color: var(--text-2); line-height: 1.5; }
.mp-tabs { display: flex; gap: 2px; padding: 3px; margin-bottom: 14px; border-radius: var(--radius); background: var(--surface-2); position: sticky; top: -18px; z-index: 2; box-shadow: 0 6px 10px -8px rgba(0, 0, 0, 0.2); }
.mp-tabs button { flex: 1; border: 0; background: none; padding: 8px 6px; border-radius: var(--radius); font-size: 13.5px; font-weight: 650; color: var(--text-2); transition: background 0.15s, color 0.15s; }
.mp-tabs button:hover { color: var(--text); }
.mp-tabs button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
.part-card, .hint-card, .mini-card { padding: 14px 16px; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-sm); }
.part-card + .part-card { margin-top: 12px; }
.part-card { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
.hint-card { display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--text-2); line-height: 1.45; }
.pc-top { display: flex; align-items: center; gap: 8px; }
.pc-top .icon-btn { margin-left: auto; margin-right: -6px; }
.pc-sys { font-size: 11.5px; font-weight: 650; padding: 2px 8px; border-radius: 2px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
.pc-count { font-size: 12px; color: var(--text-3); font-weight: 600; }
.part-card h2 { margin: 6px 0 6px; font-size: 18px; letter-spacing: -0.01em; line-height: 1.3; }
.part-card h2 small { font-size: 13px; color: var(--text-3); font-weight: 500; }
.part-card p { margin: 0 0 10px; font-size: 14px; line-height: 1.55; color: var(--text-2); }
.pc-sub { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-3); font-weight: 650; margin-bottom: 4px; }
.pc-look ul { margin: 0 0 12px; padding-left: 18px; font-size: 13.5px; line-height: 1.5; }
.pc-look li { margin: 2px 0; }
.pc-more { border-top: 1px solid var(--border); padding: 8px 0 2px; }
.pc-more summary { cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; font-size: 13.5px; font-weight: 650; padding: 2px 0 6px; }
.pc-more summary::-webkit-details-marker { display: none; }
.pc-more summary::after { content: '+'; color: var(--text-3); font-weight: 500; font-size: 17px; line-height: 1; transition: transform 0.2s var(--ease); }
.pc-more[open] summary::after { transform: rotate(45deg); }
.pc-more ul, .pc-more ol { margin: 0 0 10px; padding-left: 20px; font-size: 13.5px; line-height: 1.5; color: var(--text-2); }
.pc-more li { margin: 3px 0; }
.pc-more p { font-size: 13.5px; }
.pc-more.warn summary { color: var(--c-danger); }
.pc-tools { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
.tool { font-size: 12.5px; padding: 3px 9px; border-radius: var(--radius-sm); background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); }
.pc-measure { font-size: 13.5px !important; }
.pc-links { display: flex; flex-direction: column; gap: 8px; margin: 6px 0 10px; }
.pc-lesson { display: flex; flex-direction: column; padding: 9px 12px; border-radius: var(--radius); background: var(--accent-soft); font-size: 13.5px; font-weight: 600; line-height: 1.35; transition: transform 0.2s var(--ease); }
.pc-lesson span { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-strong); }
.pc-lesson:hover { transform: translateX(2px); }
.pc-terms { display: flex; flex-wrap: wrap; gap: 6px; }
.mp-block { margin-top: 20px; }
.mp-title { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); font-weight: 650; margin-bottom: 8px; }
.mp-note { font-size: 13px !important; color: var(--text-2); line-height: 1.5; margin: 8px 0; }
.layer-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.layer-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--surface); border-radius: 2px; padding: 5px 11px; font-size: 13px; font-weight: 600; color: var(--text-2); transition: all 0.15s; }
.layer-chip i { width: 9px; height: 9px; border-radius: 2px; background: var(--c); }
.layer-chip.on { border-color: var(--c, var(--text)); color: var(--text); background: color-mix(in srgb, var(--c, var(--text)) 12%, var(--surface)); }
.route-card { margin-top: 10px; padding: 12px 14px; border-radius: var(--radius); border: 1px solid color-mix(in srgb, var(--c) 40%, var(--border)); background: color-mix(in srgb, var(--c) 6%, var(--surface)); }
.route-card p { margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: var(--text-2); }
.route { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 2px; font-size: 12.5px; font-weight: 600; }
.route li { display: inline-flex; align-items: center; }
.route li:not(:last-child)::after { content: '→'; margin: 0 4px; color: var(--c); }
.pair-row { margin-top: 10px; font-size: 12.5px; color: var(--text-2); font-weight: 600; }
.pairs { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.pairs button { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-sm); padding: 5px 9px; font-size: 12.5px; font-weight: 650; color: var(--text-2); font-variant-numeric: tabular-nums; transition: all 0.15s; }
.pairs button:hover { border-color: var(--accent); color: var(--text); }
.pairs button.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.pairs.tdc button { min-width: 34px; }
.switch { display: flex; align-items: center; gap: 10px; margin-top: 12px; font-size: 13.5px; cursor: pointer; user-select: none; }
.switch input { position: absolute; opacity: 0; pointer-events: none; }
.switch .track { width: 36px; height: 20px; border-radius: 2px; background: var(--surface-3); position: relative; transition: background 0.2s; }
.switch .thumb { position: absolute; left: 2px; top: 2px; width: 16px; height: 16px; border-radius: 2px; background: var(--text-2); box-shadow: none; transition: transform 0.2s var(--ease); }
.switch input:checked + .track { background: var(--accent); }
.switch input:checked + .track .thumb { transform: translateX(16px); background: var(--bg); box-shadow: none; }
.switch input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }
.part-list { display: flex; flex-direction: column; gap: 2px; }
.part-row { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border: 0; background: none; border-radius: var(--radius); text-align: left; font-size: 13.5px; color: var(--text-2); transition: background 0.15s, color 0.15s; }
.part-row i { width: 12px; height: 12px; border-radius: 1px; flex: none; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15); }
.part-row small { margin-left: auto; color: var(--text-3); font-size: 12px; }
.part-row:hover { background: var(--surface-2); color: var(--text); }
.part-row.on { background: var(--accent-soft); color: var(--text); font-weight: 600; }
.mp-foot { margin-top: 22px; font-size: 12px; color: var(--text-3); line-height: 1.5; }

/* сборка */
.asm-progress { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 12.5px; font-weight: 650; color: var(--text-3); font-variant-numeric: tabular-nums; }
.asm-progress .bar { flex: 1; height: 6px; border-radius: var(--radius-sm); background: var(--surface-3); overflow: hidden; }
.asm-parts { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px; }
.asm-parts .chip { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 12.5px; padding: 4px 10px; }
.asm-parts .chip i { width: 9px; height: 9px; border-radius: 1px; }
.asm-parts .chip.on { border-color: var(--accent); color: var(--text); background: var(--accent-soft); }
.asm-sec { margin-top: 8px; }
.asm-sec ol, .asm-sec ul { margin: 0 0 6px; padding-left: 20px; font-size: 13.5px; line-height: 1.5; color: var(--text-2); }
.asm-sec li { margin: 3px 0; }
.asm-sec.check li::marker { color: var(--ok); }
.asm-sec.tighten { padding: 10px 12px; border-radius: var(--radius); background: var(--surface-2); }
.asm-sec.tighten p { margin: 0; font-size: 13px; }
.asm-doc { margin-top: 10px; font-size: 13px; line-height: 1.45; color: var(--text-2); padding: 8px 10px; border-radius: var(--radius); border: 1px dashed var(--border-strong); }
.asm-warn { margin: 10px 0; font-size: 13px; line-height: 1.45; padding: 9px 12px; border-radius: var(--radius); background: var(--c-danger-bg); border-left: 2px solid var(--c-danger); color: var(--text); }
.asm-card .pc-lesson { margin-top: 10px; }
.asm-nav { display: flex; justify-content: space-between; gap: 8px; margin-top: 12px; }
.asm-nav button { flex: 1; }
.btn-ghost, .quiz .btn-primary, .asm-nav .btn-primary, .part-card .btn-primary { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius); padding: 8px 14px; font-weight: 650; font-size: 13.5px; transition: background 0.15s, transform 0.15s; }
.asm-nav .btn-primary, .part-card .btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); box-shadow: none; }
.btn-ghost:hover { background: var(--surface-2); }
.btn-ghost:disabled, .btn-primary:disabled { opacity: 0.4; pointer-events: none; }
.mini-card { margin-top: 12px; }
.mini-card b { font-size: 14px; }
.mini-card p { margin: 4px 0 6px; font-size: 13px; color: var(--text-2); line-height: 1.5; }
.asm-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.asm-list button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 6px 8px; border: 0; background: none; border-radius: var(--radius); text-align: left; font-size: 13px; color: var(--text-2); transition: background 0.15s; }
.asm-list button:hover { background: var(--surface-2); color: var(--text); }
.asm-list .n { flex: none; width: 22px; height: 22px; border-radius: 2px; display: grid; place-items: center; font-size: 11.5px; font-weight: 700; background: var(--surface-2); border: 1px solid var(--border); font-variant-numeric: tabular-nums; }
.asm-list button.done .n { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.asm-list button.on { background: var(--accent-soft); color: var(--text); font-weight: 650; }
.asm-list button.on .n { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }

/* тренажёр */
.quiz-top { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-3); font-weight: 600; }
.quiz-q { font-size: 16px !important; }
.quiz-ok { color: var(--ok) !important; font-weight: 650; }
.quiz-bad { color: var(--c-danger) !important; font-weight: 600; }
.quiz-btns { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 6px; }
.free { margin-top: 10px; }
.free-head { font-size: 12.5px; font-weight: 650; margin-bottom: 6px; font-variant-numeric: tabular-nums; }
.free-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 4px; }
.free-grid span { display: flex; align-items: center; gap: 4px; padding: 4px 7px; border-radius: var(--radius-sm); background: var(--surface-2); font-size: 12px; }
.free-grid span.both { background: var(--ok-soft); }
.free-grid b { min-width: 16px; font-variant-numeric: tabular-nums; }
.free-grid i { font-style: normal; font-size: 11px; font-weight: 650; padding: 0 5px; border-radius: var(--radius-sm); }
.free-grid .vin { background: color-mix(in srgb, var(--c-tip) 22%, transparent); }
.free-grid .vex { background: color-mix(in srgb, var(--c-danger) 22%, transparent); }

/* работа двигателя */
.work-live { border-color: color-mix(in srgb, var(--c) 55%, var(--border)) !important; }
.work-live .pc-sys { color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); font-size: 13px; padding: 3px 10px; }
.work-live .pc-count { margin-left: auto; font-variant-numeric: tabular-nums; white-space: nowrap; text-transform: none; letter-spacing: 0.02em; }
.work-live .pc-sys { white-space: nowrap; }
.work-text { margin: 8px 0 10px !important; min-height: 4.6em; }
.work-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.work-stats div { display: flex; flex-direction: column; padding: 6px 8px; border-radius: var(--radius); background: var(--surface-2); min-width: 0; }
.work-stats small { font-size: 11px; color: var(--text-3); font-weight: 600; }
.work-stats b { font-size: 14px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.work-valves { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.work-valves span { font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-3); }
.work-valves .vin.open { background: color-mix(in srgb, var(--c-tip) 22%, transparent); color: var(--text); }
.work-valves .vex.open { background: color-mix(in srgb, var(--c-danger) 22%, transparent); color: var(--text); }
.pchart { width: 100%; height: auto; display: block; margin-top: 6px; }
.pchart text { font-size: 9px; fill: var(--text-3); font-family: inherit; }
.pchart .pc-band { font-size: 9px; font-weight: 600; }
.pc-axis line { stroke: var(--border-strong); }
.pchart-cap { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }
.fx-list { display: flex; flex-direction: column; }
.switch.fx { margin-top: 9px; font-size: 13px; }
.switch.fx .track { flex: none; }
.switch.fx input:checked + .track { background: var(--sw, var(--accent)); }
.switch.fx.sub { margin-left: 46px; font-size: 12.5px; color: var(--text-2); }
.btn-ghost.active { background: var(--accent-soft); border-color: var(--accent); }
.work-src { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 13px; line-height: 1.5; color: var(--text-2); }
.work-src li { display: flex; gap: 8px; }
.work-src i { flex: none; width: 10px; height: 10px; border-radius: 2px; margin-top: 5px; }

/* reactable: строгая типографика панели модели */
.mp-head h1 { font-family: var(--font-head); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 22px; }
.part-card h2, .asm-card h2, .quiz-q { font-family: var(--font-head); font-weight: 500; letter-spacing: 0.015em; }
.mp-title, .pc-sub, .hud-title, .quiz-top, .free-head, .pchart-cap, .dock-step small, .asm-progress, .pc-count, .work-stats small {
  font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.07em; font-weight: 500;
}
.hud-title { font-size: 10.5px; }
.mp-tabs button { font-family: var(--font-head); font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; font-size: 13px; }
.mp-tabs button.on { background: var(--text); color: var(--bg); }
.seg button.on { background: var(--text); color: var(--bg); }
.dock-btn.primary { background: var(--text); color: var(--bg); }
.pc-sys { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 500 !important; }
.hud-cyl, .pairs button, .work-stats b, .hud-angle { font-family: var(--font-mono); }
.part-card { border-color: var(--border-strong); }
.m-label { font-family: var(--font-head); font-weight: 500; letter-spacing: 0.03em; }

/* адаптация к ширине самой сцены */
@container (max-width: 640px) {
  .hud { left: 8px; right: 8px; top: 8px; max-width: none; padding: 8px; }
  .hud-strip { justify-content: space-between; gap: 2px; }
  .hud-cyl { width: auto; flex: 1; height: 28px; font-size: 11.5px; border-radius: var(--radius-sm); }
  .hud-legend { display: none; }
  .dock { left: 8px; right: 8px; transform: none; max-width: none; min-width: 0; overflow-x: auto; scrollbar-width: none; justify-content: space-between; }
  .dock::-webkit-scrollbar { display: none; }
  .dock-range { flex: 1; min-width: 90px; }
  .dock-range input { width: 100%; }
  .dock-range span { display: none; }
}
@media (max-width: 1279px) {
  .model-page { grid-template-columns: minmax(0, 1fr) 340px; }
  .hud-legend { display: none; }
}
@media (max-width: 1023px) {
  .model-page { display: block; }
  .stage { position: absolute; inset: 0; }
  .mpanel {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; height: min(72vh, 620px); border: 0;
    border-radius: var(--radius) var(--radius) 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.18);
    transform: translateY(calc(100% - 56px - env(safe-area-inset-bottom))); transition: transform 0.35s var(--ease);
  }
  .mpanel.open { transform: none; }
  .sheet-handle { position: relative; display: flex; align-items: center; gap: 10px; height: 56px; padding: 12px 18px 0; border: 0; background: none; font-weight: 650; font-size: 14.5px; text-align: left; }
  .sheet-handle > span:not(.grip) { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .grip { position: absolute; left: 50%; top: 7px; width: 38px; height: 4px; border-radius: 1px; background: var(--border-strong); transform: translateX(-50%); }
  .sheet-handle .chev { width: 18px; height: 18px; color: var(--text-3); transition: transform 0.3s var(--ease); }
  .mpanel.open .sheet-handle .chev { transform: rotate(180deg); }
  .mpanel-scroll { padding-top: 6px; }
  .mp-tabs { top: -6px; }
  .mp-head { display: none; }
  .dock { bottom: calc(68px + env(safe-area-inset-bottom)); }
}
@media (max-width: 720px) {
  .hud { left: 8px; right: 8px; top: 8px; max-width: none; padding: 8px; }
  .hud-strip { justify-content: space-between; gap: 2px; }
  .hud-cyl { width: auto; flex: 1; height: 28px; font-size: 11.5px; border-radius: var(--radius-sm); }
  .dock { left: 8px; right: 8px; transform: none; max-width: none; min-width: 0; overflow-x: auto; scrollbar-width: none; justify-content: space-between; }
  .dock::-webkit-scrollbar { display: none; }
  .dock-range input { width: 90px; }
  .dock-range span { display: none; }
}
</style>
