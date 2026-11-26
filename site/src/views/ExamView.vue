<script setup>
// Итоговый экзамен (день 14): билет из 30 вопросов всех уроков, от 80 % — сдан.
// В конце — разбор по урокам: какие темы слабые и куда вернуться.
import { reactive, computed, nextTick } from 'vue'
import QuizRun from '../components/QuizRun.vue'
import { lessons, getLesson, lessonLabel } from '../lib/content.js'
import { allQuestions, examTicket, EXAM_SIZE, plural } from '../lib/quizbank.js'
import { exam, recordExam, quizResults, QUIZ_PASS } from '../lib/store.js'

const bankSize = allQuestions().length
const size = Math.min(EXAM_SIZE, bankSize)
const need = Math.ceil(size * QUIZ_PASS)
const s = reactive({ mode: 'intro', ticket: [], runKey: 0, answers: [], passed: false })

const lessonsPassed = computed(() => lessons.filter((l) => quizResults[l.id]?.passed).length)
const notPassed = computed(() => lessons.filter((l) => !quizResults[l.id]?.passed))
const score = computed(() => s.answers.filter((a) => a.ok).length)
const mistakes = computed(() => s.answers.filter((a) => !a.ok))
// разбор по урокам: самые слабые сверху
const byLesson = computed(() => {
  const m = new Map()
  for (const a of s.answers) {
    const r = m.get(a.lessonId) || m.set(a.lessonId, { lesson: getLesson(a.lessonId), ok: 0, n: 0 }).get(a.lessonId)
    r.n++
    if (a.ok) r.ok++
  }
  return [...m.values()].sort((a, b) => a.ok / a.n - b.ok / b.n || b.n - a.n)
})
const weakLessons = computed(() => byLesson.value.filter((r) => r.ok < r.n))
const fmtDate = (t) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

function start() {
  s.ticket = examTicket(size, exam.wrong)
  s.runKey++
  s.mode = 'run'
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}
function finish(answers) {
  s.answers = answers
  s.passed = recordExam(answers)
  s.mode = 'result'
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}
</script>

<template>
  <div class="page exam-page">
    <header class="exam-head">
      <div class="hero-kicker">День 14 · итог курса</div>
      <h1 class="exam-title">Итоговый экзамен</h1>
    </header>

    <section v-if="s.mode === 'intro'" class="quiz">
      <div class="quiz-head">
        <span class="quiz-kicker">Билет из {{ size }} вопросов</span>
        <span v-if="exam.attempts.length" class="quiz-best" :class="{ ok: exam.passed }">
          Лучший результат: {{ exam.best }} из {{ exam.total }}{{ exam.passed ? ' · сдан' : '' }}
        </span>
      </div>
      <p class="quiz-lead">
        Вопросы из всех {{ lessons.length }} уроков, из каждого хотя бы один; всего в банке {{ bankSize }}.
        Сдан — от {{ need }} правильных ответов ({{ Math.round(QUIZ_PASS * 100) }} %). В конце будет разбор по урокам: куда вернуться и что повторить.
      </p>
      <p v-if="exam.wrong.length" class="quiz-lead">
        {{ exam.wrong.length }} {{ plural(exam.wrong.length, 'вопрос', 'вопроса', 'вопросов') }} с прошлых попыток ещё не отвечены верно: они попадут в билет первыми.
      </p>
      <div v-if="notPassed.length" class="exam-warn">
        Тесты уроков сданы: {{ lessonsPassed }} из {{ lessons.length }}. Лучше сначала сдать их, начиная с
        <RouterLink :to="`/lesson/${notPassed[0].id}`">{{ lessonLabel(notPassed[0]) }} · {{ notPassed[0].title }}</RouterLink>.
        Но начать экзамен можно в любой момент.
      </div>
      <div class="quiz-actions">
        <button type="button" class="btn btn-primary" @click="start">{{ exam.attempts.length ? 'Новый билет' : 'Начать экзамен' }}</button>
      </div>
      <div v-if="exam.attempts.length" class="exam-history">
        <div class="exam-history-title">Последние попытки</div>
        <div class="exam-bars">
          <div v-for="(a, i) in exam.attempts" :key="i" class="exam-bar" :class="{ ok: a.score / a.total >= QUIZ_PASS }" :title="`${fmtDate(a.at)}: ${a.score} из ${a.total}`">
            <div class="exam-bar-fill" :style="{ height: (a.score / a.total) * 100 + '%' }" />
            <span>{{ a.score }}</span>
          </div>
          <div class="exam-pass-line" :style="{ bottom: `calc(18px + ${QUIZ_PASS} * (100% - 18px))` }" title="Порог сдачи — 80 %" />
        </div>
      </div>
    </section>

    <section v-else-if="s.mode === 'run'" class="quiz">
      <QuizRun :key="s.runKey" :questions="s.ticket" @finish="finish" @quit="s.mode = 'intro'">
        <template #feedback="{ question }">
          <div class="qr-src">
            Тема: <RouterLink :to="`/lesson/${question.lessonId}`" target="_blank">{{ lessonLabel(getLesson(question.lessonId)) }} · {{ getLesson(question.lessonId).title }}</RouterLink>
          </div>
        </template>
      </QuizRun>
    </section>

    <template v-else>
      <section class="quiz">
        <div class="quiz-head"><span class="quiz-kicker">Результат экзамена</span></div>
        <div class="quiz-score" :class="{ ok: s.passed }">
          <strong>{{ score }} из {{ s.answers.length }}</strong>
          <span>{{ Math.round((score / s.answers.length) * 100) }} %</span>
        </div>
        <p class="quiz-lead">
          <template v-if="s.passed">Экзамен сдан. {{ mistakes.length ? 'Ошибки ниже — их стоит закрыть до выхода в цех.' : 'Без единой ошибки: вы готовы слушать наставника на одном языке.' }}</template>
          <template v-else>Нужно {{ need }} из {{ s.answers.length }}. Вернитесь к слабым темам ниже, пройдите тесты этих уроков и возьмите новый билет.</template>
        </p>
        <div class="quiz-actions">
          <button type="button" class="btn btn-primary" @click="start">Новый билет</button>
          <RouterLink to="/cards" class="btn btn-ghost">Повторить карточки</RouterLink>
        </div>
      </section>

      <section v-if="weakLessons.length" class="block">
        <div class="block-head"><h2>Что повторить</h2><p>Уроки, где были ошибки. Самые слабые сверху.</p></div>
        <div class="exam-topics">
          <RouterLink v-for="r in weakLessons" :key="r.lesson.id" :to="`/lesson/${r.lesson.id}`" class="exam-topic">
            <span class="et-label">{{ lessonLabel(r.lesson) }}</span>
            <span class="et-title">{{ r.lesson.title }}</span>
            <span class="et-score">{{ r.ok }} / {{ r.n }}</span>
            <span class="et-bar"><span :style="{ width: (r.ok / r.n) * 100 + '%' }" /></span>
          </RouterLink>
        </div>
      </section>

      <section v-if="mistakes.length" class="block">
        <div class="block-head"><h2>Разбор ошибок</h2></div>
        <ol class="quiz-review">
          <li v-for="(m, mi) in mistakes" :key="mi">
            <div class="qr-q" v-html="m.q" />
            <div class="qr-wrong"><span>Ваш ответ:</span> <span v-html="m.chosen" /></div>
            <div class="qr-a"><span>Правильно:</span> <span v-html="m.right" /></div>
            <div v-if="m.explain" class="qr-ex" v-html="m.explain" />
            <div class="qr-src"><RouterLink :to="`/lesson/${m.lessonId}`">{{ lessonLabel(getLesson(m.lessonId)) }} · {{ getLesson(m.lessonId).title }}</RouterLink></div>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<style scoped>
.exam-page { max-width: 820px; }
.exam-head { margin-bottom: 8px; }
.exam-title { margin: 6px 0 0; font-family: var(--font-head); font-weight: 600; font-size: clamp(30px, 5vw, 44px); line-height: 1.05; text-transform: uppercase; letter-spacing: 0.01em; }
.exam-warn { margin-top: 12px; padding: 10px 14px; font-size: 14px; color: var(--text-2); background: var(--c-warning-bg); border-left: 3px solid var(--c-warning); border-radius: var(--radius-sm); }
.exam-warn a { color: var(--text); border-bottom: 1px dashed var(--border-strong); }

.exam-history { margin-top: 20px; }
.exam-history-title { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-3); margin-bottom: 8px; }
.exam-bars { position: relative; display: flex; align-items: flex-end; gap: 6px; height: 90px; padding-bottom: 18px; }
.exam-bar { position: relative; flex: 0 0 28px; height: 100%; display: flex; align-items: flex-end; background: var(--surface-2); border-radius: var(--radius-sm); }
.exam-bar-fill { width: 100%; background: var(--c-danger); opacity: 0.8; border-radius: var(--radius-sm); }
.exam-bar.ok .exam-bar-fill { background: var(--ok); }
.exam-bar span { position: absolute; bottom: -18px; left: 0; right: 0; text-align: center; font-family: var(--font-mono); font-size: 11px; color: var(--text-3); }
.exam-pass-line { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed var(--text-3); pointer-events: none; }

.exam-topics { display: grid; gap: 8px; }
.exam-topic {
  display: grid; grid-template-columns: auto 1fr auto; gap: 4px 12px; align-items: center;
  padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  transition: border-color 0.2s var(--ease);
}
.exam-topic:hover { border-color: var(--text-3); }
.et-label { font-size: 12px; font-weight: 650; color: var(--accent-strong); background: var(--accent-soft); padding: 2px 8px; border-radius: 2px; }
.et-title { font-weight: 600; }
.et-score { font-family: var(--font-mono); font-size: 13px; color: var(--text-2); }
.et-bar { grid-column: 1 / -1; height: 3px; background: color-mix(in srgb, var(--c-danger) 35%, transparent); border-radius: 2px; overflow: hidden; }
.et-bar > span { display: block; height: 100%; background: var(--ok); }
@media (max-width: 600px) {
  .exam-topic { grid-template-columns: 1fr auto; }
  .et-label { display: none; }
}
</style>
