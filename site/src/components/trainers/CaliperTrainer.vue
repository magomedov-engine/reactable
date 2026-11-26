<script setup>
// Тренажёр «Прочитай штангенциркуль»: случайное показание на шкалах штанги и нониуса.
// Нониус 0,1 мм — 10 делений на 9 мм (как в 3D-сцене урока), 0,05 мм — 20 делений на 39 мм.
import { computed, ref } from 'vue'
import { useTask, rnd, fmtFixed } from '../../lib/trainers.js'
import TrainerAnswer from './TrainerAnswer.vue'

const KINDS = {
  '0.1': { step: 0.1, div: 10, len: 9, k: 22, digits: 1, label: '0,1' },
  '0.05': { step: 0.05, div: 20, len: 39, k: 13, digits: 2, label: '0,05' },
}
const kind = ref('0.1')
const K = computed(() => KINDS[kind.value])

function gen() {
  const c = KINDS[kind.value]
  const n = rnd(Math.round(10 / c.step), Math.round(140 / c.step)) // от 10 до 140 мм
  const whole = Math.floor((n * c.step) + 1e-9)
  const i = Math.round((n * c.step - whole) / c.step) // какая черта нониуса совпала
  return { value: n * c.step, tol: c.step / 2, whole, i, kind: kind.value }
}
const { s, check, next } = useTask('caliper', gen)
function setKind(k) {
  kind.value = k
  next()
}

// ---------- рисунок
const PAD = 16
const geo = computed(() => {
  const c = KINDS[s.task.kind]
  const v = s.task.value
  const L = Math.floor(v) - 6 // левый край окна, мм
  const R = Math.ceil(v + c.len) + 4
  const x = (mm) => PAD + (mm - L) * c.k
  const main = []
  for (let mm = L; mm <= R; mm++) {
    if (mm < 0) continue
    const big = mm % 10 === 0
    const mid = mm % 5 === 0
    main.push({ mm, x: x(mm), h: big ? 28 : mid ? 20 : 13, label: big ? String(mm / 10) : '' })
  }
  const vern = []
  for (let i = 0; i <= c.div; i++) {
    const long = c.div === 10 ? i % 5 === 0 : i % 2 === 0
    const label = c.div === 10 ? (i % 5 === 0 ? String(i) : '') : i % 2 === 0 ? String(i / 2) : ''
    vern.push({ i, x: x(v + (i * c.len) / c.div), h: long ? 20 : 13, label })
  }
  return { W: PAD * 2 + (R - L) * c.k, x, main, vern, frame: [x(v) - 34, x(v + c.len) + 30], c }
})
const answered = computed(() => s.state !== 'ask')
const answerText = computed(() => fmtFixed(s.task.value, K.value.digits))
</script>

<template>
  <div class="trainer">
    <div class="tr-top">
      <p class="tr-task">Сколько показывает штангенциркуль? Цена деления нониуса — <b>{{ K.label }} мм</b>.</p>
      <div class="seg" role="group" aria-label="Цена деления нониуса">
        <button v-for="(c, key) in KINDS" :key="key" type="button" :class="{ on: kind === key }" @click="setKind(key)">{{ c.label }} мм</button>
      </div>
    </div>

    <div class="tr-figure">
      <svg :viewBox="`0 0 ${geo.W} 200`" role="img" :aria-label="answered ? `Штангенциркуль: ${answerText} мм` : 'Шкалы штангенциркуля'">
        <!-- штанга -->
        <rect :x="0" y="22" :width="geo.W" height="78" class="steel" />
        <text :x="geo.W - 10" y="40" class="tag" text-anchor="end">мм ×10</text>
        <g v-for="t in geo.main" :key="'m' + t.mm">
          <line
            :x1="t.x" :x2="t.x" y1="100" :y2="100 - t.h"
            class="tick"
            :class="{
              hl: answered && t.mm === s.task.whole,
              match: answered && Math.abs(t.mm - (s.task.value + (s.task.i * geo.c.len) / geo.c.div)) < 1e-6,
            }"
          />
          <text v-if="t.label" :x="t.x" y="62" class="num" text-anchor="middle">{{ t.label }}</text>
        </g>
        <!-- рамка с нониусом -->
        <rect :x="geo.frame[0]" y="100" :width="geo.frame[1] - geo.frame[0]" height="74" class="frame" />
        <text :x="geo.frame[1] - 8" y="166" class="tag" text-anchor="end">{{ geo.c.label }}</text>
        <g v-for="t in geo.vern" :key="'v' + t.i">
          <line :x1="t.x" :x2="t.x" y1="100" :y2="100 + t.h" class="tick" :class="{ zero: answered && t.i === 0, match: answered && t.i === s.task.i }" />
          <text v-if="t.label" :x="t.x" y="138" class="num small" text-anchor="middle">{{ t.label }}</text>
        </g>
      </svg>
    </div>

    <TrainerAnswer :s="s" unit="мм" :answer="answerText" @check="check" @next="next">
      Ноль нониуса прошёл черту <b>{{ s.task.whole }} мм</b> на штанге <span class="sw hl" /> — это целые миллиметры.
      С чертой штанги совпала <b>{{ s.task.i }}-я</b> черта нониуса <span class="sw match" /> →
      {{ s.task.i }} × {{ geo.c.label }} = <b>{{ fmtFixed(s.task.i * geo.c.step, geo.c.digits) }} мм</b>.
      Итого {{ s.task.whole }} + {{ fmtFixed(s.task.i * geo.c.step, geo.c.digits) }} = <b>{{ answerText }} мм</b>.
      <template v-if="geo.c.div === 20"> На нониусе 0,05 цифры стоят через деление: цифра 3 — это 0,3 мм (6-я черта).</template>
    </TrainerAnswer>
  </div>
</template>

<style scoped>
.tr-figure { margin-top: 12px; padding: 10px; background: var(--figure-bg); border-radius: var(--radius); }
svg { display: block; width: 100%; height: auto; }
.steel { fill: #d9d6cf; stroke: #9d9a93; }
.frame { fill: #c7c3bb; stroke: #8f8b84; }
.tick { stroke: #1d1d1f; stroke-width: 1.4; }
.tick.hl { stroke: #2f6fb5; stroke-width: 3; }
.tick.zero { stroke: #2f6fb5; stroke-width: 3; }
.tick.match { stroke: #2e8b3a; stroke-width: 3.2; }
.num { font-family: var(--font-mono); font-size: 15px; fill: #1d1d1f; }
.num.small { font-size: 12px; }
.tag { font-family: var(--font-mono); font-size: 11px; fill: #55524c; }
.sw { display: inline-block; width: 14px; height: 3px; vertical-align: middle; border-radius: 2px; }
.sw.hl { background: #2f6fb5; }
.sw.match { background: #2e8b3a; }
</style>
