<script setup>
// Тренажёр «Переведи единицы»: задания по уроку «Единицы измерения».
// Точные переводы проверяются строго, «примерные» (через g = 9,81) — с допуском 2 %.
import { useTask, rnd, pick, fmt } from '../../lib/trainers.js'
import TrainerAnswer from './TrainerAnswer.vue'

const G = 9.81
// каждый тип: вопрос, ответ, допуск, единица ответа и разбор
const TYPES = [
  () => {
    const n = rnd(1, 40)
    return { q: `Зазор ${n} ${n % 10 === 1 && n !== 11 ? 'сотка' : n % 10 >= 2 && n % 10 <= 4 && (n < 10 || n > 20) ? 'сотки' : 'соток'}. Сколько это миллиметров?`, value: n / 100, tol: 1e-6, unit: 'мм', why: `1 сотка = 0,01 мм → ${n} × 0,01 = ${fmt(n / 100, 3)} мм.` }
  },
  () => {
    const v = rnd(2, 60) * 5
    return { q: `${v} мкм — сколько это миллиметров?`, value: v / 1000, tol: 1e-6, unit: 'мм', why: `1 мкм = 0,001 мм → ${v} × 0,001 = ${fmt(v / 1000, 3)} мм.` }
  },
  () => {
    const mm = rnd(2, 80) / 100
    return { q: `${fmt(mm, 2)} мм — это сколько соток?`, value: Math.round(mm * 100), tol: 1e-6, unit: 'соток', why: `В 1 мм 100 соток → ${fmt(mm, 2)} × 100 = ${Math.round(mm * 100)}.` }
  },
  () => {
    const v = pick([2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 25, 30])
    return { q: `В старой ТК момент ${v} кгс·м. Сколько это Н·м?`, value: v * G, tol: v * G * 0.02, unit: 'Н·м', why: `1 кгс·м ≈ 9,81 Н·м → ${v} × 9,81 ≈ ${fmt(v * G, 1)} Н·м. В уме: умножить на 10 и чуть убавить (≈ ${v * 10 - Math.round(v * 0.2)}).` }
  },
  () => {
    const v = pick([50, 80, 100, 120, 150, 200, 250, 300])
    return { q: `Момент ${v} Н·м. Сколько это кгс·м?`, value: v / G, tol: (v / G) * 0.02, unit: 'кгс·м', why: `Делим на 9,81: ${v} / 9,81 ≈ ${fmt(v / G, 1)} кгс·м. В уме: разделить на 10 и чуть прибавить.` }
  },
  () => {
    const v = pick([0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 1.5, 2.5, 20, 25])
    return { q: `Манометр показывает ${fmt(v, 2)} МПа. Сколько это бар?`, value: v * 10, tol: 1e-6, unit: 'бар', why: `1 МПа = 10 бар → ${fmt(v, 2)} × 10 = ${fmt(v * 10, 2)} бар.` }
  },
  () => {
    const v = pick([2, 3, 4, 5, 6, 8, 120, 180, 250])
    return { q: `Давление ${v} бар. Сколько это МПа?`, value: v / 10, tol: 1e-6, unit: 'МПа', why: `Делим на 10: ${v} / 10 = ${fmt(v / 10, 2)} МПа.` }
  },
  () => {
    const v = pick([2, 3, 4, 5, 6])
    return { q: `Давление ${v} кгс/см² («атмосферы»). Сколько это примерно бар?`, value: v * 0.981, tol: Math.max(0.1, v * 0.03), unit: 'бар', why: `1 кгс/см² ≈ 0,98 бар — почти одно и то же: ${v} кгс/см² ≈ ${fmt(v * 0.981, 2)} бар. В цеху их часто считают равными.` }
  },
  () => {
    const deg = pick([45, 90, 120, 180, 270, 360, 450, 540, 720])
    return { q: `Доворот на ${deg}°. На сколько оборотов повернуть болт?`, value: deg / 360, tol: 0.01, unit: 'об.', why: `Полный оборот = 360° → ${deg} / 360 = ${fmt(deg / 360, 3)} оборота.` }
  },
  () => {
    const kn = pick([5, 10, 20, 30, 50, 100])
    return { q: `Пресс развивает ${kn} кН. Примерно сколько это тонн «веса»?`, value: (kn * 1000) / G / 1000, tol: ((kn * 1000) / G / 1000) * 0.05, unit: 'т', why: `1 кН ≈ 102 кгс ≈ 0,1 т → ${kn} кН ≈ ${fmt((kn * 1000) / G / 1000, 2)} т. В уме: разделить на 10.` }
  },
]
const gen = () => pick(TYPES)()
const { s, check, next } = useTask('units', gen)
</script>

<template>
  <div class="trainer">
    <div class="tr-top">
      <p class="tr-task tr-q">{{ s.task.q }}</p>
    </div>
    <TrainerAnswer :s="s" :unit="s.task.unit" label="Ответ" :answer="fmt(s.task.value, s.task.value < 1 ? 3 : 2)" @check="check" @next="next">
      {{ s.task.why }}
    </TrainerAnswer>
  </div>
</template>

<style scoped>
.tr-q { font-size: 1.12em; font-weight: 600; color: var(--text); }
</style>
