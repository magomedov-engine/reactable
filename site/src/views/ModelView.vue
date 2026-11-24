<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createEngine, FIRING } from '../model3d/engineModel.js'
import { PARTS, PART, GROUPS, SYSTEMS, STROKES } from '../model3d/partsInfo.js'
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
const cycle = ref({})
const theta = ref(0)
const label = ref(null)
const hover = reactive({ id: null, x: 0, y: 0, cyl: null })
const sheetOpen = ref(false)
const failed = ref(false)

const info = computed(() => (s.selected ? PART[s.selected] : null))
const infoLesson = computed(() => (info.value?.lesson ? getLesson(info.value.lesson) : null))
const infoTerms = computed(() => (info.value?.terms || []).map((t) => getTerm(t)).filter(Boolean))
const groups = GROUPS.map((g) => ({ ...g, parts: PARTS.filter((p) => p.group === g.id) }))
const layers = [{ id: 'all', title: 'Все', color: '' }, ...['oil', 'water', 'air', 'fuel', 'exhaust'].map((id) => ({ id, ...SYSTEMS[id] }))]
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

onMounted(async () => {
  try {
    eng = createEngine(host.value, {
      onPick(id, meta) {
        s.pickCyl = meta?.cyl || null
        s.pickLabel = meta?.label || ''
        s.selected = id
        eng.select(id, { keepMesh: true })
        router.replace({ query: id ? { part: id } : {} })
      },
      onHover(id, x, y, cyl) {
        hover.id = id
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

function onKey(e) {
  if (/input|textarea/i.test(document.activeElement?.tagName || '') || ui.searchOpen) return
  if (e.key === ' ') {
    e.preventDefault()
    s.playing = !s.playing
  } else if (e.key === 'Escape') select(null)
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
</script>

<template>
  <div class="model-page">
    <div class="stage">
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
          Порядок работы <span class="hud-angle">вал {{ crankAngle }}°</span>
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
      <div class="dock">
        <button class="dock-btn play" type="button" :aria-label="s.playing ? 'Пауза' : 'Запустить'" @click="s.playing = !s.playing">
          <svg v-if="s.playing" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
        </button>
        <template v-if="!s.playing">
          <button class="dock-btn" type="button" title="Повернуть вал назад на 10°" @click="eng?.step(-10)">−10°</button>
          <button class="dock-btn" type="button" title="Повернуть вал вперёд на 10°" @click="eng?.step(10)">+10°</button>
        </template>
        <div v-else class="seg">
          <button v-for="v in [0.25, 0.5, 1, 2]" :key="v" type="button" :class="{ on: s.speed === v }" @click="s.speed = v">{{ v }}×</button>
        </div>
        <label class="dock-range">
          <span>Разборка</span>
          <input v-model.number="s.explode" type="range" min="0" max="1" step="0.01" />
        </label>
      </div>
    </div>

    <!-- боковая панель / нижний лист на телефоне -->
    <aside class="mpanel" :class="{ open: sheetOpen }">
      <button class="sheet-handle" type="button" @click="sheetOpen = !sheetOpen">
        <span class="grip" />
        <span>{{ info ? titleName : 'Детали и настройки' }}</span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6" /></svg>
      </button>
      <div class="mpanel-scroll">
        <div class="mp-head">
          <h1>3D-модель V12</h1>
          <p>Схематичный «типовой» дизель: развал 60°, 12 цилиндров. Нажмите на деталь, чтобы узнать, что это.</p>
        </div>

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
        <p class="mp-foot">Модель упрощённая: формы и размеры условные, у вашего двигателя устройство может отличаться. Трубки высокого давления, ремни и навесное частично не показаны.</p>
      </div>
    </aside>
  </div>
</template>

<style>
.model-page { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 360px; height: calc(100dvh - var(--topbar-h)); overflow: hidden; }
.stage { position: relative; min-width: 0; container-type: size; background: radial-gradient(ellipse at 50% 40%, var(--surface) 0%, var(--bg) 70%); }
.stage-canvas { position: absolute; inset: 0; }
.stage-canvas canvas { display: block; cursor: grab; }
.stage-canvas canvas:active { cursor: grabbing; }
.stage-error { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; text-align: center; color: var(--text-2); }

.m-label {
  position: absolute; transform: translate(-50%, calc(-100% - 14px)); pointer-events: none; white-space: nowrap;
  padding: 6px 12px; border-radius: 10px; background: var(--text); color: var(--bg); font-size: 13.5px; font-weight: 650;
  box-shadow: var(--shadow); display: flex; gap: 8px; align-items: baseline; animation: fadein 0.25s var(--ease);
}
.m-label small { font-weight: 500; opacity: 0.7; }
.m-label::after { content: ''; position: absolute; left: 50%; bottom: -6px; width: 10px; height: 10px; background: var(--text); transform: translateX(-50%) rotate(45deg); border-radius: 2px; }
.m-hover { position: absolute; transform: translate(14px, 14px); pointer-events: none; padding: 4px 9px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); font-size: 12.5px; font-weight: 600; box-shadow: var(--shadow); white-space: nowrap; }

.hud { position: absolute; left: 16px; top: 16px; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(10px); border: 1px solid var(--border); box-shadow: var(--shadow-sm); max-width: calc(100% - 32px); }
.hud-title { font-size: 12px; font-weight: 650; color: var(--text-2); display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.hud-angle { color: var(--text-3); font-weight: 500; font-variant-numeric: tabular-nums; }
.hud-strip { display: flex; gap: 4px; }
.hud-cyl {
  width: 30px; height: 30px; border-radius: 8px; border: 1.5px solid color-mix(in srgb, var(--sc) 55%, transparent);
  background: color-mix(in srgb, var(--sc) 16%, var(--surface)); color: var(--text); font-weight: 700; font-size: 12.5px;
  transition: background 0.2s, transform 0.2s var(--ease), box-shadow 0.2s; font-variant-numeric: tabular-nums;
}
.hud-cyl.power { background: var(--sc); color: #fff; border-color: var(--sc); transform: translateY(-2px); box-shadow: 0 4px 12px color-mix(in srgb, var(--sc) 45%, transparent); }
.hud-cyl.active { outline: 2px solid var(--accent); outline-offset: 2px; }
.hud-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; font-size: 11.5px; color: var(--text-3); }
.hud-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; vertical-align: -0.5px; }

.dock {
  position: absolute; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom)); transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 16px; max-width: calc(100% - 24px);
  background: color-mix(in srgb, var(--surface) 90%, transparent); backdrop-filter: blur(12px); border: 1px solid var(--border); box-shadow: var(--shadow);
}
.dock-btn { height: 38px; min-width: 38px; padding: 0 10px; border: 0; border-radius: 10px; background: var(--surface-2); font-weight: 650; font-size: 13px; display: grid; place-items: center; transition: background 0.15s, transform 0.15s; }
.dock-btn:hover { background: var(--surface-3); }
.dock-btn:active { transform: scale(0.95); }
.dock-btn.play { background: var(--text); color: var(--bg); width: 42px; }
.dock-btn svg { width: 18px; height: 18px; }
.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 10px; background: var(--surface-2); }
.seg button { border: 0; background: none; padding: 6px 9px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--text-2); white-space: nowrap; transition: background 0.15s, color 0.15s; }
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
.part-card, .hint-card { padding: 14px 16px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-sm); }
.part-card { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
.hint-card { display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--text-2); line-height: 1.45; }
.pc-top { display: flex; align-items: center; gap: 8px; }
.pc-top .icon-btn { margin-left: auto; margin-right: -6px; }
.pc-sys { font-size: 11.5px; font-weight: 650; padding: 2px 8px; border-radius: 99px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
.pc-count { font-size: 12px; color: var(--text-3); font-weight: 600; }
.part-card h2 { margin: 6px 0 6px; font-size: 18px; letter-spacing: -0.01em; line-height: 1.3; }
.part-card h2 small { font-size: 13px; color: var(--text-3); font-weight: 500; }
.part-card p { margin: 0 0 10px; font-size: 14px; line-height: 1.55; color: var(--text-2); }
.pc-sub { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-3); font-weight: 650; margin-bottom: 4px; }
.pc-look ul { margin: 0 0 12px; padding-left: 18px; font-size: 13.5px; line-height: 1.5; }
.pc-look li { margin: 2px 0; }
.pc-links { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
.pc-lesson { display: flex; flex-direction: column; padding: 9px 12px; border-radius: 10px; background: var(--accent-soft); font-size: 13.5px; font-weight: 600; line-height: 1.35; transition: transform 0.2s var(--ease); }
.pc-lesson span { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-strong); }
.pc-lesson:hover { transform: translateX(2px); }
.pc-terms { display: flex; flex-wrap: wrap; gap: 6px; }
.mp-block { margin-top: 20px; }
.mp-title { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); font-weight: 650; margin-bottom: 8px; }
.layer-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.layer-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--surface); border-radius: 99px; padding: 5px 11px; font-size: 13px; font-weight: 600; color: var(--text-2); transition: all 0.15s; }
.layer-chip i { width: 9px; height: 9px; border-radius: 50%; background: var(--c); }
.layer-chip.on { border-color: var(--c, var(--text)); color: var(--text); background: color-mix(in srgb, var(--c, var(--text)) 12%, var(--surface)); }
.switch { display: flex; align-items: center; gap: 10px; margin-top: 12px; font-size: 13.5px; cursor: pointer; user-select: none; }
.switch input { position: absolute; opacity: 0; pointer-events: none; }
.switch .track { width: 36px; height: 20px; border-radius: 99px; background: var(--surface-3); position: relative; transition: background 0.2s; }
.switch .thumb { position: absolute; left: 2px; top: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); transition: transform 0.2s var(--ease); }
.switch input:checked + .track { background: var(--accent); }
.switch input:checked + .track .thumb { transform: translateX(16px); }
.switch input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }
.part-list { display: flex; flex-direction: column; gap: 2px; }
.part-row { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border: 0; background: none; border-radius: 9px; text-align: left; font-size: 13.5px; color: var(--text-2); transition: background 0.15s, color 0.15s; }
.part-row i { width: 12px; height: 12px; border-radius: 4px; flex: none; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15); }
.part-row small { margin-left: auto; color: var(--text-3); font-size: 12px; }
.part-row:hover { background: var(--surface-2); color: var(--text); }
.part-row.on { background: var(--accent-soft); color: var(--text); font-weight: 600; }
.mp-foot { margin-top: 22px; font-size: 12px; color: var(--text-3); line-height: 1.5; }

/* адаптация к ширине самой сцены */
@container (max-width: 640px) {
  .hud { left: 8px; right: 8px; top: 8px; max-width: none; padding: 8px; }
  .hud-strip { justify-content: space-between; gap: 2px; }
  .hud-cyl { width: auto; flex: 1; height: 28px; font-size: 11.5px; border-radius: 7px; }
  .hud-legend { display: none; }
  .dock { left: 8px; right: 8px; transform: none; max-width: none; overflow-x: auto; scrollbar-width: none; justify-content: space-between; }
  .dock::-webkit-scrollbar { display: none; }
  .dock-range { flex: 1; min-width: 90px; }
  .dock-range input { width: 100%; }
  .dock-range span { display: none; }
}
@media (max-width: 1279px) {
  .model-page { grid-template-columns: minmax(0, 1fr) 320px; }
  .hud-legend { display: none; }
}
@media (max-width: 1023px) {
  .model-page { display: block; }
  .stage { position: absolute; inset: 0; }
  .mpanel {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; height: min(72vh, 620px); border: 0;
    border-radius: 18px 18px 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.18);
    transform: translateY(calc(100% - 56px - env(safe-area-inset-bottom))); transition: transform 0.35s var(--ease);
  }
  .mpanel.open { transform: none; }
  .sheet-handle { position: relative; display: flex; align-items: center; gap: 10px; height: 56px; padding: 12px 18px 0; border: 0; background: none; font-weight: 650; font-size: 14.5px; text-align: left; }
  .sheet-handle > span:not(.grip) { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .grip { position: absolute; left: 50%; top: 7px; width: 38px; height: 4px; border-radius: 4px; background: var(--border-strong); transform: translateX(-50%); }
  .sheet-handle .chev { width: 18px; height: 18px; color: var(--text-3); transition: transform 0.3s var(--ease); }
  .mpanel.open .sheet-handle .chev { transform: rotate(180deg); }
  .mpanel-scroll { padding-top: 6px; }
  .mp-head { display: none; }
  .dock { bottom: calc(68px + env(safe-area-inset-bottom)); }
}
@media (max-width: 720px) {
  .hud { left: 8px; right: 8px; top: 8px; max-width: none; padding: 8px; }
  .hud-strip { justify-content: space-between; gap: 2px; }
  .hud-cyl { width: auto; flex: 1; height: 28px; font-size: 11.5px; border-radius: 7px; }
  .dock { left: 8px; right: 8px; transform: none; max-width: none; overflow-x: auto; scrollbar-width: none; justify-content: space-between; }
  .dock::-webkit-scrollbar { display: none; }
  .dock-range input { width: 90px; }
  .dock-range span { display: none; }
}
</style>
