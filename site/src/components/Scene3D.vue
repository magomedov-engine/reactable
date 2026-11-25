<script setup>
// 3D-блок внутри урока: грузится, когда доходит прокрутка, освобождает WebGL, когда далеко за экраном.
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { sceneById } from '../lessons3d/registry.js'

const props = defineProps({
  id: { type: String, required: true },
  poster: { type: String, default: '' }, // схема, которую заменяет блок
  caption: { type: String, default: '' },
})

const def = sceneById(props.id)
const root = ref(null)
const host = ref(null)
const status = ref('idle') // idle | loading | ready | error
const mod = ref(null)
const step = ref(0)
const playing = ref(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const view = ref('3d') // 3d | scheme
const full = ref(false)
const coarse = window.matchMedia?.('(pointer: coarse)').matches
let ctrl = null
let onScreen = false

const steps = computed(() => mod.value?.steps || [])
const cur = computed(() => steps.value[step.value] || null)
const title = computed(() => mod.value?.title || def?.title || '3D')

async function load() {
  if (ctrl || status.value === 'loading' || !def) return
  status.value = 'loading'
  try {
    const m = (await def.load()).default
    mod.value = m
    await nextTick()
    if (!host.value) return
    ctrl = await m.mount(host.value, { compact: !full.value })
    ctrl.setPlaying?.(playing.value)
    ctrl.setStep?.(step.value, { instant: true })
    ctrl.setInteractive?.(!coarse || full.value)
    ctrl.setZoom?.(full.value)
    ctrl.setActive?.(onScreen && view.value === '3d')
    status.value = 'ready'
  } catch (e) {
    console.error(e)
    status.value = 'error'
    view.value = props.poster ? 'scheme' : '3d'
  }
}
function unload() {
  if (!ctrl) return
  ctrl.dispose?.()
  ctrl = null
  status.value = 'idle'
}

let nearObs, farObs, visObs
onMounted(() => {
  if (!def) {
    status.value = 'error'
    return
  }
  // близко к экрану — грузим
  nearObs = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && load(), { rootMargin: '400px 0px' })
  // далеко ушли — освобождаем видеокарту (в браузере ограничено число 3D-холстов)
  farObs = new IntersectionObserver((es) => es.forEach((e) => !e.isIntersecting && !full.value && unload()), { rootMargin: '1600px 0px' })
  // на экране — рисуем, нет — пауза
  visObs = new IntersectionObserver(
    (es) => {
      onScreen = es.some((e) => e.isIntersecting)
      ctrl?.setActive?.(onScreen && view.value === '3d')
    },
    { rootMargin: '40px 0px' },
  )
  nearObs.observe(root.value)
  farObs.observe(root.value)
  visObs.observe(root.value)
})
onBeforeUnmount(() => {
  nearObs?.disconnect()
  farObs?.disconnect()
  visObs?.disconnect()
  setFull(false)
  unload()
})

function go(i) {
  if (!steps.value.length) return
  step.value = (i + steps.value.length) % steps.value.length
  ctrl?.setStep?.(step.value)
}
function togglePlay() {
  playing.value = !playing.value
  ctrl?.setPlaying?.(playing.value)
}
watch(view, (v) => ctrl?.setActive?.(onScreen && v === '3d'))

function onKey(e) {
  if (e.key === 'Escape') setFull(false)
  else if (e.key === 'ArrowRight') go(step.value + 1)
  else if (e.key === 'ArrowLeft') go(step.value - 1)
}
function setFull(v) {
  if (full.value === v) return
  full.value = v
  document.documentElement.classList.toggle('no-scroll', v)
  if (v) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
  if (v) view.value = '3d'
  ctrl?.setZoom?.(v)
  ctrl?.setInteractive?.(!coarse || v)
  ctrl?.setActive?.(v || onScreen)
}
</script>

<template>
  <figure ref="root" class="l3d" :class="{ full, scheme: view === 'scheme' }">
    <div class="l3d-head">
      <span class="l3d-badge">3D</span>
      <span class="l3d-title">{{ title }}</span>
      <div class="l3d-tools">
        <div v-if="poster && status !== 'error'" class="l3d-seg" role="tablist">
          <button type="button" :class="{ on: view === '3d' }" @click="view = '3d'">3D</button>
          <button type="button" :class="{ on: view === 'scheme' }" @click="view = 'scheme'">Схема</button>
        </div>
        <button v-if="status === 'ready' && view === '3d'" class="l3d-icon" type="button" title="Вернуть вид" aria-label="Вернуть вид" @click="ctrl?.resetView?.()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v5h5" /></svg>
        </button>
        <button v-if="view === '3d'" class="l3d-icon" type="button" :title="full ? 'Свернуть' : 'На весь экран'" :aria-label="full ? 'Свернуть' : 'На весь экран'" @click="setFull(!full)">
          <svg v-if="!full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
        </button>
      </div>
    </div>

    <div class="l3d-body">
      <div v-show="view === '3d'" ref="host" class="l3d-stage">
        <div v-if="status !== 'ready'" class="l3d-wait">
          <img v-if="poster" :src="poster" alt="" />
          <span v-if="status === 'error'">3D не запустилось в этом браузере — показываем схему.</span>
          <span v-else-if="status === 'loading'" class="l3d-loading">Загрузка 3D…</span>
        </div>
        <div v-if="status === 'ready'" class="l3d-hint">{{ coarse && !full ? 'Разверните, чтобы вращать' : full ? 'Вращать — мышью или пальцем · масштаб — колесо или щипок' : 'Потяните мышью, чтобы повернуть' }}</div>
      </div>
      <div v-if="view === 'scheme' && poster" class="l3d-scheme">
        <img :src="poster" :alt="caption" loading="lazy" />
      </div>
    </div>

    <div v-if="view === '3d' && (steps.length || mod?.animated)" class="l3d-steps">
      <button v-if="mod?.animated" class="l3d-play" type="button" :aria-label="playing ? 'Пауза' : 'Запустить'" @click="togglePlay">
        <svg v-if="playing" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
      </button>
      <template v-if="steps.length">
        <button class="l3d-nav" type="button" aria-label="Предыдущий шаг" :disabled="steps.length < 2" @click="go(step - 1)">←</button>
        <div class="l3d-step">
          <div class="l3d-step-top">
            <span class="l3d-n">{{ step + 1 }}/{{ steps.length }}</span>
            <b>{{ cur?.title }}</b>
          </div>
          <p v-if="cur?.text">{{ cur.text }}</p>
        </div>
        <button class="l3d-nav" type="button" aria-label="Следующий шаг" :disabled="steps.length < 2" @click="go(step + 1)">→</button>
      </template>
    </div>
    <div v-if="steps.length > 1 && view === '3d'" class="l3d-dots">
      <button v-for="(s, i) in steps" :key="i" type="button" :class="{ on: i === step }" :aria-label="s.title" @click="go(i)" />
    </div>
    <figcaption v-if="caption && !full">{{ caption }}</figcaption>
  </figure>
</template>

<style>
.l3d { margin: 1.8em 0; border: 1px solid var(--border-strong); background: var(--surface); border-radius: var(--radius); font-size: 15px; line-height: 1.5; }
.l3d-head { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 12px; border-bottom: 1px solid var(--border); }
.l3d-badge { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.1em; padding: 2px 6px; background: var(--text); color: var(--bg); border-radius: 1px; }
.l3d-title { flex: 1; min-width: 0; font-family: var(--font-head); font-weight: 500; letter-spacing: 0.03em; text-transform: uppercase; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.l3d-tools { display: flex; align-items: center; gap: 4px; }
.l3d-seg { display: inline-flex; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); }
.l3d-seg button { border: 0; background: none; padding: 4px 9px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); }
.l3d-seg button.on { background: var(--text); color: var(--bg); }
.l3d-icon { width: 32px; height: 30px; display: grid; place-items: center; border: 1px solid transparent; background: none; color: var(--text-2); border-radius: var(--radius-sm); }
.l3d-icon:hover { border-color: var(--border-strong); color: var(--text); }
.l3d-icon svg { width: 17px; height: 17px; }
.l3d-body { position: relative; }
.l3d-stage { position: relative; height: clamp(300px, 56vw, 460px); overflow: hidden; background: radial-gradient(ellipse at 50% 42%, #1f2023 0%, #151618 75%); cursor: grab; }
.l3d-stage:active { cursor: grabbing; }
.l3d-canvas { position: absolute; inset: 0; display: block; }
.l3d-wait { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; text-align: center; color: var(--text-3); font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
.l3d-wait img { position: absolute; inset: 12px; width: calc(100% - 24px); height: calc(100% - 24px); object-fit: contain; opacity: 0.12; filter: grayscale(1) invert(1); }
.l3d-loading { position: relative; animation: l3dpulse 1.2s ease-in-out infinite; }
@keyframes l3dpulse { 50% { opacity: 0.4; } }
.l3d-hint { position: absolute; right: 10px; bottom: 8px; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); pointer-events: none; }
.l3d-scheme { background: var(--figure-bg); padding: 10px; }
.l3d-scheme img { width: 100%; height: auto; display: block; }

/* подписи-выноски в сцене */
.l3d-labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.l3d-tag {
  position: absolute; left: 0; top: 0; white-space: nowrap; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em;
  color: var(--text); background: rgba(20, 21, 23, 0.86); border: 1px solid var(--border-strong); padding: 2px 6px; border-radius: 1px;
  transition: opacity 0.2s; will-change: transform;
}
.l3d-tag.top { margin-top: -10px; translate: -50% -100%; }
.l3d-tag.bottom { margin-top: 10px; translate: -50% 0; }
.l3d-tag.left { margin-left: -10px; translate: -100% -50%; }
.l3d-tag.right { margin-left: 10px; translate: 0 -50%; }
.l3d-tag.center { translate: -50% -50%; }
.l3d-tag.accent { background: var(--text); color: var(--bg); border-color: var(--text); }
.l3d-tag.warn { border-color: var(--c-danger); color: var(--c-danger); }
.l3d-tag.ok { border-color: var(--ok); color: var(--ok); }
.l3d-tag.big { font-size: 14px; padding: 4px 9px; }

.l3d-steps { display: flex; align-items: stretch; gap: 8px; padding: 10px; border-top: 1px solid var(--border); }
.l3d-play, .l3d-nav { flex: none; width: 38px; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text); border-radius: var(--radius-sm); display: grid; place-items: center; font-size: 16px; }
.l3d-play { background: var(--text); color: var(--bg); border-color: var(--text); }
.l3d-play svg { width: 16px; height: 16px; }
.l3d-nav:hover { border-color: var(--text-3); }
.l3d-nav:disabled { opacity: 0.35; }
.l3d-step { flex: 1; min-width: 0; padding: 0 4px; }
.l3d-step-top { display: flex; align-items: baseline; gap: 8px; }
.l3d-step-top b { font-family: var(--font-head); font-weight: 500; letter-spacing: 0.02em; font-size: 16px; }
.l3d-n { font-family: var(--font-mono); font-size: 11px; color: var(--text-3); }
.l3d-step p { margin: 3px 0 0; font-size: 14px; color: var(--text-2); line-height: 1.5; }
.l3d-dots { display: flex; gap: 4px; padding: 0 10px 10px; }
.l3d-dots button { flex: 1; height: 3px; border: 0; padding: 0; background: var(--surface-3); border-radius: 0; }
.l3d-dots button.on { background: var(--text); }
.l3d > figcaption { padding: 8px 12px; font-size: 12.5px; color: var(--text-3); border-top: 1px solid var(--border); text-align: left; margin: 0; }

.l3d.full { position: fixed; inset: 0; z-index: 70; margin: 0; border: 0; border-radius: 0; display: flex; flex-direction: column; background: var(--bg); }
.l3d.full .l3d-body { flex: 1; min-height: 0; }
.l3d.full .l3d-stage { height: 100%; }
.l3d.full .l3d-steps { padding-bottom: calc(10px + env(safe-area-inset-bottom)); }

@media (max-width: 720px) {
  .l3d { margin-left: -6px; margin-right: -6px; }
  .l3d-stage { height: 300px; }
  .l3d-title { font-size: 14px; }
  .l3d-step p { font-size: 13.5px; }
}
</style>
