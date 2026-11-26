// Общая логика тренажёров «прочитай показание / переведи единицы»:
// задание → ввод числа → проверка с допуском → разбор → следующее задание. Счёт — trainerStats в store.js.
import { reactive } from 'vue'
import { recordTrainer } from './store.js'

export const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1)) // целое от a до b включительно
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
// «24,6» и «24.6» — одно и то же; пробелы внутри числа не мешают
export function parseNum(s) {
  const t = String(s).trim().replace(/\s+/g, '').replace(',', '.')
  if (!/^[-+]?\d*\.?\d+$/.test(t)) return NaN
  return Number(t)
}
// число по-русски: запятая, без лишних нулей, но с нужным числом знаков
export const fmt = (x, digits = 2) => {
  const s = (Math.round(x * 10 ** digits) / 10 ** digits).toFixed(digits)
  return s.replace(/\.?0+$/, '').replace('.', ',') || '0'
}
export const fmtFixed = (x, digits) => x.toFixed(digits).replace('.', ',')

// gen() → { value, tol, ...что нужно для рисунка и разбора }
export function useTask(id, gen) {
  const s = reactive({ task: gen(), input: '', state: 'ask', error: '' }) // state: ask | ok | bad
  function check() {
    const v = parseNum(s.input)
    if (Number.isNaN(v)) {
      s.error = 'Введите число, например 24,6'
      return
    }
    s.error = ''
    const ok = Math.abs(v - s.task.value) <= s.task.tol + 1e-9
    s.state = ok ? 'ok' : 'bad'
    recordTrainer(id, ok)
  }
  function next() {
    s.task = gen()
    s.input = ''
    s.state = 'ask'
    s.error = ''
  }
  return { s, check, next }
}
