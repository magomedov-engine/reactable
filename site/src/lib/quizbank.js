// Банк вопросов курса: тесты всех уроков (раздел «Самопроверка» с вариантами ответа).
// Нужен итоговому экзамену: билет собирается из вопросов разных уроков.
import { lessons } from './content.js'
import { lessonSource } from './content.js'
import { extractQuiz } from './markdown.js'

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const plural = (n, one, few, many) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many

let bank = null
// все вопросы курса: { lessonId, q, options, explain, key }
export function allQuestions() {
  if (!bank) {
    bank = lessons.flatMap((l) =>
      extractQuiz(lessonSource(l.id)).quiz.map((q, i) => ({ ...q, lessonId: l.id, key: `${l.id}#${i}` })),
    )
  }
  return bank
}

export const EXAM_SIZE = 30

// Билет: из каждого урока хотя бы один вопрос, остальные места — случайно из всего банка.
// prefer — ключи вопросов, на которых ошибались раньше: они попадают в билет в первую очередь.
export function examTicket(size = EXAM_SIZE, prefer = []) {
  const all = allQuestions()
  const byLesson = new Map()
  for (const q of all) (byLesson.get(q.lessonId) || byLesson.set(q.lessonId, []).get(q.lessonId)).push(q)
  const picked = new Set()
  const weak = new Set(prefer)
  for (const list of byLesson.values()) {
    const fromWeak = shuffle(list.filter((q) => weak.has(q.key)))
    picked.add((fromWeak[0] || shuffle(list)[0]).key)
  }
  for (const q of shuffle(all.filter((q) => weak.has(q.key)))) {
    if (picked.size >= size) break
    picked.add(q.key)
  }
  for (const q of shuffle(all)) {
    if (picked.size >= size) break
    picked.add(q.key)
  }
  return shuffle(all.filter((q) => picked.has(q.key)))
}
