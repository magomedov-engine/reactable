import { reactive, computed, watch } from 'vue'
import { lessons } from './content.js'

const KEY = 'slesar:'
const load = (k, d) => {
  try {
    const v = localStorage.getItem(KEY + k)
    return v == null ? d : JSON.parse(v)
  } catch {
    return d
  }
}
const save = (k, v) => {
  try {
    localStorage.setItem(KEY + k, JSON.stringify(v))
  } catch {}
}

// ---------- прогресс
export const progress = reactive({
  done: load('done', []),
  last: load('last', null), // { id, y }
})
watch(() => [...progress.done], (v) => save('done', v))
watch(() => progress.last, (v) => save('last', v), { deep: true })

export const isDone = (id) => progress.done.includes(id)
export function toggleDone(id) {
  const i = progress.done.indexOf(id)
  if (i >= 0) progress.done.splice(i, 1)
  else progress.done.push(id)
}
export const doneCount = computed(() => lessons.filter((l) => progress.done.includes(l.id)).length)
export const donePercent = computed(() => Math.round((doneCount.value / lessons.length) * 100))
export const nextLesson = computed(() => {
  if (progress.last && !isDone(progress.last.id)) return lessons.find((l) => l.id === progress.last.id)
  return lessons.find((l) => !progress.done.includes(l.id)) || null
})
export function resetProgress() {
  progress.done.splice(0)
  progress.last = null
  for (const k of Object.keys(quizResults)) delete quizResults[k]
  Object.assign(exam, { best: 0, total: 0, passed: false, attempts: [], wrong: [] })
  for (const k of Object.keys(cardState)) delete cardState[k]
  Object.assign(cardsDay, { date: '', fresh: 0 })
  for (const k of Object.keys(trainerStats)) delete trainerStats[k]
}

// ---------- тренажёры: { [id]: { ok, n, streak, best } } — верных ответов, всего, серия подряд, лучшая серия
export const trainerStats = reactive(load('trainers', {}))
watch(trainerStats, (v) => save('trainers', v), { deep: true })
export function recordTrainer(id, ok) {
  const t = (trainerStats[id] ||= { ok: 0, n: 0, streak: 0, best: 0 })
  t.n++
  if (ok) {
    t.ok++
    t.streak++
    t.best = Math.max(t.best, t.streak)
  } else t.streak = 0
}

// ---------- первая смена и наставник: отметки чек-листа, «спросил», записанные ответы, свои вопросы
// (не сбрасывается вместе с прогрессом курса: это личные записи)
export const mentor = reactive(Object.assign({ checked: {}, asked: {}, answers: {}, own: [] }, load('mentor', {})))
watch(mentor, (v) => save('mentor', v), { deep: true })

// ---------- карточки: { [id]: { box, due: 'ГГГГ-ММ-ДД', reps, lapses } }; расписание — lib/cards.js
export const cardState = reactive(load('cards', {}))
watch(cardState, (v) => save('cards', v), { deep: true })
// сколько новых карточек взято сегодня (дневной лимит новых)
export const cardsDay = reactive(load('cardsDay', { date: '', fresh: 0 }))
watch(cardsDay, (v) => save('cardsDay', v), { deep: true })

// ---------- тесты по урокам: { [id урока]: { best, last, total, passed, at } }
export const QUIZ_PASS = 0.8
export const quizResults = reactive(load('quiz', {}))
watch(quizResults, (v) => save('quiz', v), { deep: true })

// записать попытку; при результате от 80 % урок отмечается пройденным
export function recordQuiz(id, score, total) {
  const prev = quizResults[id]
  const passed = score / total >= QUIZ_PASS
  quizResults[id] = {
    best: Math.max(score, prev?.best ?? 0),
    last: score,
    total,
    passed: passed || !!prev?.passed,
    at: Date.now(),
  }
  if (passed && !isDone(id)) progress.done.push(id)
  return passed
}

// ---------- итоговый экзамен: { best, total, passed, attempts: [{ at, score, total }], wrong: [ключи вопросов] }
export const exam = reactive(load('exam', { best: 0, total: 0, passed: false, attempts: [], wrong: [] }))
watch(exam, (v) => save('exam', v), { deep: true })

export function recordExam(answers) {
  const score = answers.filter((a) => a.ok).length
  const total = answers.length
  const passed = score / total >= QUIZ_PASS
  exam.best = Math.max(exam.best, score)
  exam.total = total
  exam.passed = exam.passed || passed
  exam.attempts = [...exam.attempts, { at: Date.now(), score, total }].slice(-10)
  // ошибки копятся, пока на вопрос не ответят верно: такие вопросы попадут в следующий билет первыми
  const wrong = new Set(exam.wrong)
  for (const a of answers) a.ok ? wrong.delete(a.key) : wrong.add(a.key)
  exam.wrong = [...wrong]
  return passed
}

// ---------- оформление
// у reactable одна тема — тёмная (графит и молочный); светлой нет
let fontRaw = '1'
try {
  fontRaw = localStorage.getItem(KEY + 'font') || '1'
} catch {}

export const settings = reactive({
  font: Number(fontRaw), // множитель размера текста урока
})
export const isDark = computed(() => true)
if (typeof document !== 'undefined') document.documentElement.dataset.theme = 'dark'

watch(
  () => settings.font,
  (f) => {
    document.documentElement.style.setProperty('--reader-scale', String(f))
    try {
      localStorage.setItem(KEY + 'font', String(f))
    } catch {}
  },
  { immediate: true },
)

// ---------- глобальный UI
export const ui = reactive({
  sidebarOpen: false,
  searchOpen: false,
  viewer: null, // { items, index }
  term: null, // { slug, rect }
})

export function openViewer(items, index = 0) {
  ui.viewer = { items, index }
}
