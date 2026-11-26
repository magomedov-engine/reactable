<script setup>
// Тренажёр «Порядок затяжки»: нажимайте болты в том порядке, в каком их тянут.
// Неверный болт подсвечивается и объясняется, какое правило нарушено. Упражнения — lib/tightening.js.
import { reactive, computed } from 'vue'
import { EXERCISES } from '../../lib/tightening.js'
import { recordTrainer } from '../../lib/store.js'

const s = reactive({ ex: 0, pass: 0, orders: [], cur: [], mistakes: 0, bad: -1, why: '', done: false })
const ex = computed(() => EXERCISES[s.ex])
const pass = computed(() => ex.value.passes[s.pass])

function reset(i = s.ex) {
  Object.assign(s, { ex: i, pass: 0, orders: [], cur: [], mistakes: 0, bad: -1, why: '', done: false })
}

function allowed(prefix) {
  const p = pass.value
  if (p.sameAs !== undefined) {
    const o = s.orders[p.sameAs]
    return prefix.length < o.length ? [o[prefix.length]] : []
  }
  return p.allowed(prefix)
}

let badTimer = 0
function click(b) {
  if (s.done || s.cur.includes(b)) return
  const ok = allowed(s.cur).includes(b)
  if (!ok) {
    s.mistakes++
    s.bad = b
    const p = pass.value
    s.why = p.sameAs !== undefined ? 'В том же порядке, что и в первом проходе: номера подсказывают, какой болт следующий.' : p.why(s.cur, b)
    clearTimeout(badTimer)
    badTimer = setTimeout(() => (s.bad = -1), 700)
    return
  }
  s.why = ''
  s.cur.push(b)
  if (allowed(s.cur).length === 0) {
    s.orders.push([...s.cur])
    if (s.pass + 1 < ex.value.passes.length) {
      s.pass++
      s.cur = []
    } else {
      s.done = true
      recordTrainer('torque', s.mistakes === 0)
    }
  }
}

// номер болта: в текущем проходе — порядковый номер; в повторных проходах бледно видна подсказка с первого прохода
const label = (b) => {
  const i = s.cur.indexOf(b)
  if (i >= 0) return String(i + 1)
  if (s.done) return String(s.orders[0].indexOf(b) + 1)
  return ''
}
const hint = (b) => {
  const p = pass.value
  if (s.done || p.sameAs === undefined || s.cur.includes(b)) return ''
  return String(s.orders[p.sameAs].indexOf(b) + 1)
}
const boltCount = computed(() => {
  const p = pass.value
  if (p.sameAs !== undefined) return s.orders[p.sameAs].length
  return ex.value.id === 'maincap' ? 14 : ex.value.bolts.length
})
const isActiveKind = (b) => ex.value.id !== 'maincap' || s.done || (s.pass === 0 ? b % 4 < 2 : b % 4 >= 2)
</script>

<template>
  <div class="trainer">
    <div class="tr-top">
      <div class="seg wrap" role="group" aria-label="Деталь">
        <button v-for="(e, i) in EXERCISES" :key="e.id" type="button" :class="{ on: s.ex === i }" @click="reset(i)">{{ e.title }}</button>
      </div>
      <p class="tr-task">{{ ex.intro }}</p>
    </div>

    <div class="tq-status">
      <span class="tq-pass">{{ s.done ? 'Готово' : pass.t }}</span>
      <span v-if="!s.done" class="tq-count">{{ s.cur.length }} из {{ boltCount }}</span>
      <span class="tq-err" :class="{ zero: !s.mistakes }">ошибок: {{ s.mistakes }}</span>
    </div>

    <div class="tr-figure">
      <svg :viewBox="`0 0 ${ex.w} ${ex.h}`" role="img" :aria-label="`${ex.title}: нажимайте болты по порядку затяжки`">
        <!-- деталь -->
        <template v-if="ex.shape.kind === 'rect'">
          <rect :x="ex.shape.x" :y="ex.shape.y" :width="ex.shape.w" :height="ex.shape.h" rx="10" class="part" />
          <template v-if="ex.shape.chambers">
            <circle v-for="c in 4" :key="c" :cx="95 + (c - 1) * 70" cy="170" r="27" class="chamber" />
          </template>
        </template>
        <template v-else-if="ex.shape.kind === 'circle'">
          <circle :cx="ex.shape.cx" :cy="ex.shape.cy" :r="ex.shape.r" class="part" />
          <circle :cx="ex.shape.cx" :cy="ex.shape.cy" :r="ex.shape.hole" class="chamber" />
        </template>
        <template v-else>
          <rect x="8" y="40" width="404" height="70" rx="6" class="part" />
          <text x="210" y="80" class="tag" text-anchor="middle">блок (вид снизу, коленвал снят)</text>
          <g v-for="c in 7" :key="c">
            <rect :x="40 + (c - 1) * 55 - 26" y="128" width="52" height="96" rx="6" class="part cap" :class="{ mid: c === 4 }" />
            <text :x="40 + (c - 1) * 55" y="248" class="tag" text-anchor="middle">{{ c }}</text>
          </g>
          <text x="210" y="280" class="tag" text-anchor="middle">крышки 1–7 · сверху вертикальные, снизу стяжные</text>
        </template>

        <!-- болты -->
        <g
          v-for="(b, i) in ex.bolts" :key="i"
          class="bolt"
          :class="{ on: s.cur.includes(i) || s.done, bad: s.bad === i, dim: !isActiveKind(i), h: b.h }"
          role="button"
          :aria-label="`Болт ${i + 1}`"
          tabindex="0"
          @click="click(i)"
          @keydown.enter.prevent="click(i)"
        >
          <circle :cx="b.x" :cy="b.y" :r="ex.id === 'maincap' ? 12 : 22" class="hit" />
          <circle :cx="b.x" :cy="b.y" :r="ex.id === 'maincap' ? 10 : 16" class="head" />
          <text v-if="label(i)" :x="b.x" :y="b.y + (ex.id === 'maincap' ? 3.5 : 5)" class="n" :class="{ small: ex.id === 'maincap' }" text-anchor="middle">{{ label(i) }}</text>
          <text v-else-if="hint(i)" :x="b.x" :y="b.y + (ex.id === 'maincap' ? 3.5 : 5)" class="n hint" :class="{ small: ex.id === 'maincap' }" text-anchor="middle">{{ hint(i) }}</text>
        </g>
      </svg>
    </div>

    <p v-if="s.why" class="tq-why" aria-live="polite">{{ s.why }}</p>

    <div v-if="s.done" class="tr-feedback" :class="s.mistakes ? 'bad' : 'ok'">
      <strong>{{ s.mistakes ? `Готово, но с ошибками: ${s.mistakes}` : 'Без единой ошибки' }}</strong>
      <div class="tr-explain">
        Цифры на болтах — ваш порядок. Ступенчато и по схеме тянут, чтобы деталь и прокладка садились ровно, без перекоса.
        На заводе порядок, число проходов, моменты и углы берут только из ТК; после затяжки болты отмечают маркером.
      </div>
      <div class="quiz-actions">
        <button type="button" class="btn btn-primary" @click="reset()">Ещё раз</button>
        <button v-if="s.ex + 1 < EXERCISES.length" type="button" class="btn btn-ghost" @click="reset(s.ex + 1)">Следующая деталь</button>
      </div>
    </div>
    <div v-else class="quiz-actions">
      <button type="button" class="link-btn tq-reset" @click="reset()">Начать заново</button>
    </div>
  </div>
</template>

<style scoped>
.tr-figure { margin-top: 12px; padding: 10px; background: var(--figure-bg); border-radius: var(--radius); }
svg { display: block; width: 100%; max-width: 520px; height: auto; margin: 0 auto; user-select: none; }
.part { fill: #c9c5bd; stroke: #8b877f; stroke-width: 2; }
.part.cap.mid { fill: #bdb7ad; }
.chamber { fill: #a8a39a; stroke: #8b877f; }
.tag { font-family: var(--font-mono); font-size: 11px; fill: #55524c; }
.bolt { cursor: pointer; outline: none; }
.bolt .hit { fill: transparent; }
.bolt .head { fill: #6d6a64; stroke: #3e3c39; stroke-width: 2; transition: fill 0.15s; }
.bolt:hover .head, .bolt:focus-visible .head { fill: #8b8780; }
.bolt.on .head { fill: #2e8b3a; stroke: #1f5f27; }
.bolt.bad .head { fill: #c0392b; stroke: #7d241b; animation: shake 0.35s; }
.bolt.dim { opacity: 0.35; }
.n { font-family: var(--font-mono); font-size: 15px; font-weight: 600; fill: #fff; pointer-events: none; }
.n.small { font-size: 10px; }
.n.hint { fill: rgba(255, 255, 255, 0.55); }
@keyframes shake { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
.bolt.bad { transform-box: fill-box; }

.tq-status { display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap; margin-top: 14px; font-family: var(--font-mono); font-size: 13px; }
.tq-pass { color: var(--text); font-family: var(--font); font-weight: 600; font-size: 15px; }
.tq-count { color: var(--text-3); }
.tq-err { margin-left: auto; color: var(--c-danger); }
.tq-err.zero { color: var(--text-3); }
.tq-why { margin: 10px 0 0; padding: 10px 14px; font-size: 14px; color: var(--text); background: var(--c-danger-bg); border-left: 3px solid var(--c-danger); border-radius: var(--radius-sm); }
.tq-reset { font-size: 13px; color: var(--text-3); }
.tr-feedback { margin-top: 14px; padding: 12px 14px; border-radius: var(--radius); background: var(--surface); border-left: 3px solid var(--ok); }
.tr-feedback.bad { border-left-color: var(--c-warning); }
.tr-feedback > strong { display: block; color: var(--ok); }
.tr-feedback.bad > strong { color: var(--c-warning); }
.tr-explain { margin-top: 4px; color: var(--text-2); }
</style>
