<script setup>
// Тест по уроку: вопросы из раздела «Самопроверка» с вариантами ответа (их разбирает markdown.js).
// Порядок вопросов перемешан; от 80 % урок отмечается пройденным.
// Монтируется вручную из LessonView (текст урока вставлен через v-html).
import { reactive, computed, ref, nextTick } from 'vue'
import QuizRun from './QuizRun.vue'
import { quizResults, recordQuiz, QUIZ_PASS } from '../lib/store.js'
import { shuffle, plural } from '../lib/quizbank.js'

const props = defineProps({
  lessonId: { type: String, required: true },
  questions: { type: Array, required: true }, // [{ q, options: [{ html, correct }], explain }]
})

const root = ref(null)
const s = reactive({ mode: 'intro', run: [], runKey: 0, answers: [], passed: false, review: false })
const total = props.questions.length
const need = Math.ceil(total * QUIZ_PASS)
const result = computed(() => quizResults[props.lessonId] || null)
const score = computed(() => s.answers.filter((a) => a.ok).length)
const mistakes = computed(() => s.answers.filter((a) => !a.ok))

function start() {
  s.run = shuffle(props.questions)
  s.runKey++
  s.mode = 'run'
  s.review = false
}
function finish(answers) {
  s.answers = answers
  s.passed = recordQuiz(props.lessonId, score.value, total)
  s.mode = 'result'
  nextTick(() => root.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}
</script>

<template>
  <section ref="root" class="quiz" aria-label="Тест по уроку">
    <template v-if="s.mode === 'intro'">
      <div class="quiz-head">
        <span class="quiz-kicker">Тест по уроку</span>
        <span v-if="result" class="quiz-best" :class="{ ok: result.passed }">
          Лучший результат: {{ result.best }} из {{ result.total }}{{ result.passed ? ' · сдан' : '' }}
        </span>
      </div>
      <p class="quiz-lead">
        {{ total }} {{ plural(total, 'вопрос', 'вопроса', 'вопросов') }}, порядок и варианты перемешиваются при каждой попытке.
        Чтобы сдать, нужно {{ need }} {{ plural(need, 'правильный ответ', 'правильных ответа', 'правильных ответов') }} из {{ total }} (80 %), тогда урок отметится пройденным.
      </p>
      <div class="quiz-actions">
        <button type="button" class="btn btn-primary" @click="start">{{ result ? 'Пройти ещё раз' : 'Начать тест' }}</button>
        <button type="button" class="btn btn-ghost" @click="s.review = !s.review">{{ s.review ? 'Скрыть ответы' : 'Вопросы с ответами' }}</button>
      </div>
      <ol v-if="s.review" class="quiz-review">
        <li v-for="(q, qi) in questions" :key="qi">
          <div class="qr-q" v-html="q.q" />
          <div class="qr-a" v-html="q.options.find((o) => o.correct).html" />
          <div v-if="q.explain" class="qr-ex" v-html="q.explain" />
        </li>
      </ol>
    </template>

    <QuizRun v-else-if="s.mode === 'run'" :key="s.runKey" :questions="s.run" @finish="finish" @quit="s.mode = 'intro'" />

    <template v-else>
      <div class="quiz-head">
        <span class="quiz-kicker">Результат</span>
      </div>
      <div class="quiz-score" :class="{ ok: s.passed }">
        <strong>{{ score }} из {{ total }}</strong>
        <span>{{ Math.round((score / total) * 100) }} %</span>
      </div>
      <p class="quiz-lead">
        <template v-if="s.passed">Тест сдан, урок отмечен пройденным.{{ mistakes.length ? ' Посмотрите ошибки ниже, чтобы закрыть пробелы.' : ' Без единой ошибки!' }}</template>
        <template v-else>Нужно {{ need }} из {{ total }}. Перечитайте разделы по ошибкам ниже и попробуйте ещё раз: вопросы и варианты перемешаются.</template>
      </p>
      <ol v-if="mistakes.length" class="quiz-review">
        <li v-for="(m, mi) in mistakes" :key="mi">
          <div class="qr-q" v-html="m.q" />
          <div class="qr-wrong"><span>Ваш ответ:</span> <span v-html="m.chosen" /></div>
          <div class="qr-a"><span>Правильно:</span> <span v-html="m.right" /></div>
          <div v-if="m.explain" class="qr-ex" v-html="m.explain" />
        </li>
      </ol>
      <div class="quiz-actions">
        <button type="button" class="btn btn-primary" @click="start">Пройти ещё раз</button>
      </div>
    </template>
  </section>
</template>
