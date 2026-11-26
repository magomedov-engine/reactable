<script setup>
// Тренажёр «Прочитай микрометр»: МК 0–25, шаг винта 0,5 мм, барабан на 50 делений (как в уроке и 3D-сцене).
// Над линией стебля — целые миллиметры, под ней — половинки. Кромка барабана стоит ровно на показании.
import { computed } from 'vue'
import { useTask, rnd, fmtFixed } from '../../lib/trainers.js'
import TrainerAnswer from './TrainerAnswer.vue'

function gen() {
  // сотки: 1,00…24,99 мм; деления барабана 0–2 и 48–49 не берём — черта у самой кромки барабана читается спорно
  let n
  do {
    n = rnd(100, 2499)
  } while (n % 50 < 3 || n % 50 > 47)
  const whole = Math.floor(n / 100)
  const half = n % 100 >= 50
  const drum = n % 50 // деление барабана
  return { value: n / 100, tol: 0.005, whole, half, drum }
}
const { s, check, next } = useTask('micrometer', gen)

const K = 30 // px на мм стебля
const LINE = 100 // ось стебля
const SP = 11 // px между делениями барабана
const geo = computed(() => {
  const v = s.task.value
  // окно постоянной ширины: кромка барабана всегда на одном месте, левее — 7,5 мм стебля
  const L = v - 7.5
  const x = (mm) => 20 + (mm - L) * K
  const edge = x(v)
  const top = []
  const bottom = []
  for (let mm = Math.max(0, Math.ceil(L)); mm <= v + 1e-9; mm++) top.push({ mm, x: x(mm), h: mm % 5 === 0 ? 20 : 14, label: mm % 5 === 0 ? String(mm) : '' })
  for (let h = Math.max(0, Math.floor(L)) + 0.5; h <= v + 1e-9; h += 1) if (h >= L) bottom.push({ x: x(h) })
  const drum = []
  for (let d = -6; d <= 6; d++) {
    const val = (((s.task.drum + d) % 50) + 50) % 50
    drum.push({ d, y: LINE - d * SP, long: val % 5 === 0, label: val % 5 === 0 ? String(val) : '', val })
  }
  return { x, edge, top, bottom, drum, W: edge + 190, L }
})
const answered = computed(() => s.state !== 'ask')
const answerText = computed(() => fmtFixed(s.task.value, 2))
</script>

<template>
  <div class="trainer">
    <div class="tr-top">
      <p class="tr-task">Сколько показывает микрометр? Цена деления барабана — <b>0,01 мм</b>, за оборот винт проходит 0,5 мм.</p>
    </div>

    <div class="tr-figure">
      <svg :viewBox="`0 0 ${geo.W} 200`" role="img" :aria-label="answered ? `Микрометр: ${answerText} мм` : 'Шкалы микрометра'">
        <defs>
          <linearGradient id="mk-drum" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#9c988f" />
            <stop offset="0.45" stop-color="#e2ded6" />
            <stop offset="1" stop-color="#8d8981" />
          </linearGradient>
        </defs>
        <!-- стебель -->
        <rect :x="Math.max(0, geo.x(0) - 10)" :y="LINE - 34" :width="geo.edge + 4 - Math.max(0, geo.x(0) - 10)" height="68" class="sleeve" />
        <line :x1="Math.max(0, geo.x(0) - 10)" :x2="geo.edge" :y1="LINE" :y2="LINE" class="tick" />
        <g v-for="t in geo.top" :key="'t' + t.mm">
          <line :x1="t.x" :x2="t.x" :y1="LINE" :y2="LINE - t.h" class="tick" :class="{ hl: answered && t.mm === s.task.whole }" />
          <text v-if="t.label" :x="t.x" :y="LINE - 24" class="num" text-anchor="middle">{{ t.label }}</text>
        </g>
        <line
          v-for="(b, i) in geo.bottom" :key="'b' + i"
          :x1="b.x" :x2="b.x" :y1="LINE" :y2="LINE + 13"
          class="tick" :class="{ half: answered && s.task.half && i === geo.bottom.length - 1 }"
        />
        <!-- барабан -->
        <rect :x="geo.edge" y="22" width="150" height="156" fill="url(#mk-drum)" class="drum" />
        <path :d="`M${geo.edge} 22 l14 0 l0 156 l-14 0 z`" class="bevel" />
        <g v-for="t in geo.drum" :key="'d' + t.d">
          <line
            :x1="geo.edge" :x2="geo.edge + (t.long ? 22 : 14)" :y1="t.y" :y2="t.y"
            class="tick" :class="{ match: answered && t.d === 0 }"
          />
          <text v-if="t.label" :x="geo.edge + 28" :y="t.y + 4.5" class="num small">{{ t.label }}</text>
        </g>
        <rect :x="geo.edge + 72" y="22" width="78" height="156" class="ratchet" />
      </svg>
    </div>

    <TrainerAnswer :s="s" unit="мм" :answer="answerText" @check="check" @next="next">
      Над линией стебля последняя видимая черта — <b>{{ s.task.whole }} мм</b> <span class="sw hl" />.
      <template v-if="s.task.half">Под линией после неё видна риска половинки <span class="sw half" /> → <b>+ 0,5 мм</b>.</template>
      <template v-else>Под линией после неё риски ещё нет → половинку не добавляем.</template>
      С продольной линией совпало деление барабана <b>{{ s.task.drum }}</b> <span class="sw match" /> → {{ fmtFixed(s.task.drum / 100, 2) }} мм.
      Итого {{ s.task.whole }}{{ s.task.half ? ' + 0,5' : '' }} + {{ fmtFixed(s.task.drum / 100, 2) }} = <b>{{ answerText }} мм</b>.
    </TrainerAnswer>
  </div>
</template>

<style scoped>
.tr-figure { margin-top: 12px; padding: 10px; background: var(--figure-bg); border-radius: var(--radius); }
svg { display: block; width: 100%; max-width: 640px; height: auto; margin: 0 auto; }
.sleeve { fill: #d9d6cf; stroke: #9d9a93; }
.drum { stroke: #6f6c66; }
.bevel { fill: rgba(255, 255, 255, 0.25); stroke: #6f6c66; }
.ratchet { fill: rgba(0, 0, 0, 0.12); }
.tick { stroke: #1d1d1f; stroke-width: 1.5; }
.tick.hl { stroke: #2f6fb5; stroke-width: 3.2; }
.tick.half { stroke: #c0661e; stroke-width: 3.2; }
.tick.match { stroke: #2e8b3a; stroke-width: 3.2; }
.num { font-family: var(--font-mono); font-size: 15px; fill: #1d1d1f; }
.num.small { font-size: 12px; }
.sw { display: inline-block; width: 14px; height: 3px; vertical-align: middle; border-radius: 2px; }
.sw.hl { background: #2f6fb5; }
.sw.half { background: #c0661e; }
.sw.match { background: #2e8b3a; }
</style>
