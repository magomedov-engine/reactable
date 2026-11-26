<script setup>
// Первая смена и наставник: чек-лист первой смены (04_Практика/Чек-лист_первой_смены.md)
// и вопросы наставнику из всех уроков. Отметки и ответы хранятся в браузере, страницу можно распечатать.
import { computed, reactive } from 'vue'
import data from '../content/mentor.json'
import { getLesson, lessonLabel } from '../lib/content.js'
import { mentor } from '../lib/store.js'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

const ui = reactive({ open: {}, hideAsked: false, draft: '' })

const checkTotal = data.checklist.reduce((n, s) => n + s.items.length, 0)
const checkDone = computed(() => data.checklist.reduce((n, s) => n + s.items.filter((i) => mentor.checked[i.id]).length, 0))

// вопросы по урокам в порядке курса (порядок уроков в mentor.json уже по дням)
const groups = computed(() => {
  const m = new Map()
  for (const q of data.questions) {
    if (ui.hideAsked && mentor.asked[q.id]) continue
    ;(m.get(q.lessonId) || m.set(q.lessonId, []).get(q.lessonId)).push(q)
  }
  return [...m.entries()].map(([id, qs]) => ({ lesson: getLesson(id), qs }))
})
const own = computed(() => mentor.own.filter((q) => !(ui.hideAsked && mentor.asked[q.id])))
const qTotal = computed(() => data.questions.length + mentor.own.length)
const qAsked = computed(() => [...data.questions, ...mentor.own].filter((q) => mentor.asked[q.id]).length)

function toggle(map, id) {
  if (mentor[map][id]) delete mentor[map][id]
  else mentor[map][id] = true
}
function addOwn() {
  const t = ui.draft.trim()
  if (!t) return
  mentor.own.push({ id: `own-${Date.now()}`, text: t })
  ui.draft = ''
}
function removeOwn(id) {
  mentor.own = mentor.own.filter((q) => q.id !== id)
  delete mentor.asked[id]
  delete mentor.answers[id]
}
const showAnswer = (id) => ui.open[id] || !!mentor.answers[id]
const print = () => window.print()
</script>

<template>
  <div class="page mentor-page">
    <header class="mentor-head">
      <div class="hero-kicker">Практика</div>
      <h1 class="mentor-title">Первая смена и наставник</h1>
      <p class="hero-sub">
        Чек-лист первой смены и вопросы наставнику из всех уроков. Отмечайте, что сделано и о чём уже спросили,
        записывайте ответы — они пригодятся, когда понадобится вспомнить «как у нас принято». Всё хранится в этом браузере.
      </p>
      <div class="quiz-actions no-print">
        <button type="button" class="btn btn-primary" @click="print">Распечатать</button>
        <label class="switch-line"><input v-model="ui.hideAsked" type="checkbox" /> Скрыть вопросы, о которых уже спросил</label>
      </div>
    </header>

    <section class="block">
      <div class="block-head">
        <h2>Чек-лист первой смены</h2>
        <p>Отмечено {{ checkDone }} из {{ checkTotal }}</p>
      </div>
      <div class="bar no-print"><div class="bar-fill" :style="{ width: (checkDone / checkTotal) * 100 + '%' }" /></div>
      <div class="check-groups">
        <div v-for="s in data.checklist" :key="s.title" class="check-group">
          <h3>{{ s.title }}</h3>
          <label v-for="i in s.items" :key="i.id" class="check-item" :class="{ on: mentor.checked[i.id] }">
            <input type="checkbox" :checked="!!mentor.checked[i.id]" @change="toggle('checked', i.id)" />
            <span class="box" aria-hidden="true" />
            <span v-html="inline(i.text)" />
          </label>
        </div>
      </div>
    </section>

    <section class="block mentor-qs">
      <div class="block-head">
        <h2>Вопросы наставнику</h2>
        <p>Спросил {{ qAsked }} из {{ qTotal }}. По три из каждого урока — задавайте по ходу дела, не все сразу.</p>
      </div>

      <div v-for="g in groups" :key="g.lesson.id" class="q-group">
        <RouterLink :to="`/lesson/${g.lesson.id}`" class="q-lesson">
          <span class="et-label">{{ lessonLabel(g.lesson) }}</span> {{ g.lesson.title }}
        </RouterLink>
        <div v-for="q in g.qs" :key="q.id" class="q-item" :class="{ on: mentor.asked[q.id] }">
          <label class="check-item">
            <input type="checkbox" :checked="!!mentor.asked[q.id]" @change="toggle('asked', q.id)" />
            <span class="box" aria-hidden="true" />
            <span v-html="inline(q.text)" />
          </label>
          <button v-if="!showAnswer(q.id)" type="button" class="link-btn q-note-btn no-print" @click="ui.open[q.id] = true">Записать ответ</button>
          <textarea v-if="showAnswer(q.id)" v-model="mentor.answers[q.id]" class="q-answer" rows="2" placeholder="Что ответил наставник…" />
          <div v-else class="print-lines" aria-hidden="true" />
        </div>
      </div>

      <div class="q-group">
        <div class="q-lesson"><span class="et-label">Свои</span> Мои вопросы</div>
        <div v-for="q in own" :key="q.id" class="q-item" :class="{ on: mentor.asked[q.id] }">
          <label class="check-item">
            <input type="checkbox" :checked="!!mentor.asked[q.id]" @change="toggle('asked', q.id)" />
            <span class="box" aria-hidden="true" />
            <span>{{ q.text }}</span>
          </label>
          <div class="q-own-actions no-print">
            <button v-if="!showAnswer(q.id)" type="button" class="link-btn q-note-btn" @click="ui.open[q.id] = true">Записать ответ</button>
            <button type="button" class="link-btn q-note-btn" @click="removeOwn(q.id)">Удалить</button>
          </div>
          <textarea v-if="showAnswer(q.id)" v-model="mentor.answers[q.id]" class="q-answer" rows="2" placeholder="Что ответил наставник…" />
          <div v-else class="print-lines" aria-hidden="true" />
        </div>
        <form class="q-add no-print" @submit.prevent="addOwn">
          <input v-model="ui.draft" type="text" placeholder="Свой вопрос: что непонятно после смены…" maxlength="300" />
          <button type="submit" class="btn btn-ghost" :disabled="!ui.draft.trim()">Добавить</button>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.mentor-page { max-width: 820px; }
.mentor-title { margin: 6px 0 0; font-family: var(--font-head); font-weight: 600; font-size: clamp(30px, 5vw, 44px); line-height: 1.05; text-transform: uppercase; letter-spacing: 0.01em; }
.mentor-head .hero-sub { margin-top: 12px; }
.switch-line { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-2); cursor: pointer; }
.bar { margin: -6px 0 18px; }

.check-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
.check-group { padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.check-group h3 { margin: 0 0 8px; font-family: var(--font-mono); font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); }

.check-item { position: relative; display: flex; gap: 10px; align-items: flex-start; padding: 5px 0; line-height: 1.45; cursor: pointer; }
.check-item input { position: absolute; opacity: 0; pointer-events: none; }
.check-item .box {
  flex: none; width: 18px; height: 18px; margin-top: 2px; border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm);
  display: grid; place-items: center; transition: background 0.15s, border-color 0.15s;
}
.check-item input:checked + .box { background: var(--ok); border-color: var(--ok); }
.check-item input:checked + .box::after { content: ''; width: 9px; height: 5px; margin-top: -2px; border: 2px solid var(--bg); border-top: 0; border-right: 0; transform: rotate(-45deg); }
.check-item input:focus-visible + .box { outline: 2px solid var(--accent); outline-offset: 2px; }
.check-item.on > span:last-child, .q-item.on .check-item > span:last-child { color: var(--text-3); text-decoration: line-through; text-decoration-color: var(--border-strong); }

.q-group { margin-top: 18px; }
.q-lesson { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-weight: 600; }
.q-lesson:hover { text-decoration: underline; text-decoration-color: var(--border-strong); }
.et-label { flex: none; font-size: 12px; font-weight: 650; color: var(--accent-strong); background: var(--accent-soft); padding: 2px 8px; border-radius: 2px; }
.q-item { padding: 6px 0 8px 2px; border-bottom: 1px solid var(--border); }
.q-note-btn { margin-left: 28px; font-size: 12.5px; font-weight: 500; color: var(--text-3); }
.q-own-actions { display: flex; gap: 4px; }
.q-answer {
  display: block; width: calc(100% - 28px); margin: 6px 0 0 28px; padding: 8px 10px; resize: vertical;
  font: inherit; font-size: 14px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
}
.q-answer:focus { outline: none; border-color: var(--border-strong); }
.q-add { display: flex; gap: 8px; margin-top: 12px; }
.q-add input {
  flex: 1; min-width: 0; padding: 10px 12px; font: inherit; font-size: 14px; color: var(--text);
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
}
.q-add input:focus { outline: none; border-color: var(--border-strong); }
.q-add .btn { padding: 9px 16px; align-items: center; }
.print-lines { display: none; }

@media (max-width: 600px) {
  .check-groups { grid-template-columns: 1fr; }
  .switch-line { width: 100%; }
}
@media print {
  .no-print { display: none !important; }
  .mentor-page { max-width: none; color: #000; }
  .mentor-title, .q-lesson, .check-group h3 { color: #000; }
  .check-group { border: 1px solid #999; break-inside: avoid; background: none; }
  .check-item .box { border-color: #000; }
  .check-item.on > span:last-child, .q-item.on .check-item > span:last-child { color: #555; }
  .q-item { break-inside: avoid; border-bottom-color: #ccc; }
  .q-answer { border: 0; padding: 2px 0 0 28px; margin-left: 0; width: 100%; color: #000; background: none; resize: none; }
  .print-lines { display: block; height: 34px; margin-left: 28px; background: repeating-linear-gradient(transparent 0 16px, #bbb 16px 17px); }
  .et-label { color: #000; background: none; border: 1px solid #999; }
}
</style>
