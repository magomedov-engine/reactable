// Карточки с интервальным повторением (упрощённая система Лейтнера).
// Колоды: факты курса из 04_Практика/Карточки.md и термины глоссария.
// «Помню» — карточка переходит в следующую коробку и вернётся позже (1, 3, 7, 14, 30, 60 дней),
// «Трудно» — остаётся в своей коробке, «Не помню» — возвращается в начало и повторяется ещё раз сегодня.
import factCards from '../content/cards.json'
import { glossary } from './content.js'
import { cardState, cardsDay } from './store.js'

export const INTERVALS = [0, 1, 3, 7, 14, 30, 60] // дней до следующего показа для коробки 0…6
export const NEW_PER_DAY = 10
export const LEARNED_BOX = 3 // с этой коробки (интервал от недели) карточка считается выученной
export const GLOSSARY_DECK = 'Термины глоссария'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
export const cards = [
  ...factCards,
  ...glossary.map((g) => ({
    id: `g-${g.slug}`,
    deck: GLOSSARY_DECK,
    front: `Что такое «${g.term}»?`,
    back: cap(g.short),
    term: g.slug,
  })),
]
export const decks = [...new Set(cards.map((c) => c.deck))]

const pad = (n) => String(n).padStart(2, '0')
const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => dayStr(new Date())
export function addDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return dayStr(d)
}

function freshLeft() {
  if (cardsDay.date !== today()) Object.assign(cardsDay, { date: today(), fresh: 0 })
  return Math.max(0, NEW_PER_DAY - cardsDay.fresh)
}

const inDeck = (deck) => (c) => !deck || c.deck === deck
export const isDue = (c) => cardState[c.id] && cardState[c.id].due <= today()
export const isNew = (c) => !cardState[c.id]

// очередь на сегодня: сначала карточки к повторению (самые просроченные первыми), потом новые в пределах лимита
export function todayQueue(deck = '') {
  const list = cards.filter(inDeck(deck))
  const due = list.filter(isDue).sort((a, b) => cardState[a.id].due.localeCompare(cardState[b.id].due))
  const fresh = list.filter(isNew).slice(0, freshLeft())
  return [...due, ...fresh]
}

export function deckStats(deck = '') {
  const list = cards.filter(inDeck(deck))
  return {
    total: list.length,
    due: list.filter(isDue).length,
    fresh: Math.min(list.filter(isNew).length, freshLeft()),
    unseen: list.filter(isNew).length,
    learned: list.filter((c) => (cardState[c.id]?.box ?? 0) >= LEARNED_BOX).length,
  }
}

// через сколько дней карточка вернётся при такой оценке (для подписи на кнопке)
export function nextInterval(id, grade) {
  return INTERVALS[nextBox(id, grade)]
}

// новая карточка, которую сразу помнят, перескакивает через коробку: и так знакомое не показываем завтра
function nextBox(id, grade) {
  const prev = cardState[id]
  const box = prev?.box ?? 0
  if (grade === 0) return 0
  if (grade === 1) return Math.max(1, box)
  return Math.min(prev ? box + 1 : 2, INTERVALS.length - 1)
}

// grade: 0 — не помню, 1 — трудно, 2 — помню
export function gradeCard(id, grade) {
  const prev = cardState[id]
  if (!prev) {
    freshLeft() // сбросить счётчик, если наступил новый день
    cardsDay.fresh++
  }
  const box = nextBox(id, grade)
  cardState[id] = {
    box,
    due: addDays(INTERVALS[box]),
    reps: (prev?.reps ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (grade === 0 && prev ? 1 : 0),
  }
}

export const intervalLabel = (d) => (d === 0 ? 'сегодня' : d === 1 ? 'завтра' : `через ${d} дн.`)
