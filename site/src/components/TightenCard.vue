<script setup>
// Схема затяжки на 3D-модели: номера над болтами, болт «сейчас» с кольцом, проходы по очереди.
// Данные проходов — TIGHTEN в assemblySteps.js, отрисовка — engine.setTighten.
import { reactive, computed, watch, onBeforeUnmount } from 'vue'
import { TIGHTEN } from '../model3d/assemblySteps.js'

const props = defineProps({
  kind: { type: String, required: true }, // 'headbolt' | 'maincap'
  eng: { type: Object, default: null },
  cyl: { type: Number, default: null }, // головка какого цилиндра (для headbolt)
})

const t = reactive({ on: false, pass: 0, at: -1, cyl: props.cyl || 1, auto: false, done: false })
let timer = 0

const scheme = computed(() => TIGHTEN[props.kind])
const pass = computed(() => scheme.value.passes[t.pass])
const total = computed(() => pass.value.order.length)

const FRONT = ['передний', 'задний', 'задний', 'передний']
function boltName(i) {
  if (props.kind === 'headbolt') {
    const sz = i < 2 ? -1 : 1
    const outer = t.cyl >= 7 ? sz > 0 : sz < 0
    return `${FRONT[i]}, ${outer ? 'снаружи ряда' : 'со стороны развала'}`
  }
  const cap = Math.floor(i / 4) + 1, j = i % 4
  return `крышка № ${cap}, ${j < 2 ? 'вертикальный' : 'горизонтальный стяжной'}, со стороны ряда ${j % 2 ? '7–12' : '1–6'}`
}
const nowText = computed(() => {
  if (t.done) return 'Все проходы выполнены. На двигателе после затяжки — проверка по ТК и отметка в карте сборки.'
  if (t.at < 0) return `Порядок затяжки: номера над болтами. Всего ${total.value}.`
  return `Болт ${t.at + 1} из ${total.value}: ${boltName(pass.value.order[t.at])}`
})

function draw(fly = false) {
  if (!t.on) return
  props.eng?.setTighten(props.kind, { cyl: t.cyl, order: pass.value.order, at: t.done ? total.value : t.at, fly })
}
function start() {
  Object.assign(t, { on: true, pass: 0, at: -1, done: false })
  draw(true)
}
function stop() {
  stopAuto()
  t.on = false
  props.eng?.setTighten(null)
}
function next() {
  if (t.done) return
  if (t.at < total.value - 1) t.at++
  else if (t.pass < scheme.value.passes.length - 1) {
    t.pass++
    t.at = 0
  } else {
    t.done = true
    stopAuto()
  }
  draw()
}
function prev() {
  if (t.done) t.done = false
  else if (t.at > 0) t.at--
  else if (t.pass > 0) {
    t.pass--
    t.at = total.value - 1
  } else t.at = -1
  draw()
}
function goPass(i) {
  Object.assign(t, { pass: i, at: -1, done: false })
  draw()
}
function setCyl(c) {
  t.cyl = c
  draw(true)
}
function toggleAuto() {
  if (t.auto) return stopAuto()
  if (t.done) goPass(0)
  t.auto = true
  timer = setInterval(next, 900)
}
function stopAuto() {
  t.auto = false
  clearInterval(timer)
}

watch(() => props.kind, () => {
  if (t.on) stop()
})
watch(() => props.cyl, (c) => {
  if (c && props.kind === 'headbolt' && c !== t.cyl) setCyl(c)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  if (t.on) props.eng?.setTighten(null)
})
</script>

<template>
  <div class="asm-sec tighten tcard">
    <div class="pc-sub">{{ scheme.title }}</div>
    <p>{{ scheme.note }}</p>
    <button v-if="!t.on" class="btn-ghost tc-show" type="button" @click="start">Показать на модели</button>
    <template v-else>
      <div v-if="kind === 'headbolt'" class="tc-row">
        <span>Головка цилиндра</span>
        <div class="pairs tdc">
          <button v-for="c in 12" :key="c" type="button" :class="{ on: t.cyl === c }" @click="setCyl(c)">{{ c }}</button>
        </div>
      </div>
      <div class="seg wide tc-passes">
        <button v-for="(p, i) in scheme.passes" :key="p.t" type="button" :class="{ on: t.pass === i }" @click="goPass(i)">{{ p.t }}</button>
      </div>
      <p class="tc-pass">{{ pass.note }}</p>
      <p class="tc-now" :class="{ done: t.done }">{{ nowText }}</p>
      <div class="quiz-btns">
        <button class="btn-ghost" type="button" aria-label="Предыдущий болт" @click="prev">←</button>
        <button class="btn-ghost" type="button" :disabled="t.done" @click="next">{{ t.at < 0 ? 'Начать' : 'Следующий болт →' }}</button>
        <button class="btn-ghost" :class="{ active: t.auto }" type="button" @click="toggleAuto">{{ t.auto ? 'Стоп' : 'Авто' }}</button>
        <button class="link-btn" type="button" @click="stop">Убрать с модели</button>
      </div>
      <p class="tc-warn">Порядок на модели типовой и упрощённый. На двигателе — только схема, проходы и моменты из ТК.</p>
    </template>
  </div>
</template>

<style scoped>
.tcard { margin-top: 10px; }
.tc-show { margin-top: 8px; }
.tc-row { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; font-size: 12.5px; color: var(--text-2); }
.tc-passes { margin-top: 10px; }
.tc-pass { margin-top: 8px !important; }
.tc-now { margin-top: 6px !important; font-weight: 650; color: var(--text); }
.tc-now.done { color: var(--ok); }
.tc-warn { margin-top: 8px !important; font-size: 12px !important; color: var(--text-3, var(--text-2)); }
</style>
