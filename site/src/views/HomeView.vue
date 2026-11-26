<script setup>
import { computed } from 'vue'
import { sections, lessons, lessonLabel, glossary, schemeCount, planDays, REVIEW_DAY } from '../lib/content.js'
import { isDone, doneCount, donePercent, nextLesson, progress, resetProgress, quizResults, exam } from '../lib/store.js'

// дни и уроки берутся из поля «день» в заметках; здесь только подсказки к дням
const DAY_NOTES = {
  1: 'Профессия и единицы измерения',
  2: 'Самый важный урок: читать внимательно',
  5: 'Если есть штангенциркуль, потренируйтесь мерить',
  10: 'Слесарная база заканчивается, начинается двигатель',
  [REVIEW_DAY]: 'Сдайте экзамен (от 80 %), повторите карточки, выпишите вопросы наставнику. Карточки — по 5–10 минут каждый день с первого дня',
}
const plan = planDays.map((p) => ({ ...p, note: DAY_NOTES[p.day] }))
const dayDone = (p) => (p.day === REVIEW_DAY ? exam.passed : p.lessons.length > 0 && p.lessons.every((l) => isDone(l.id)))
const started = computed(() => doneCount.value > 0 || !!progress.last)
const resumeTo = computed(() => {
  const l = nextLesson.value
  if (!l) return null
  const resume = progress.last?.id === l.id && progress.last.y > 200
  return { path: `/lesson/${l.id}`, query: resume ? { resume: 1 } : {} }
})
function reset() {
  if (confirm('Сбросить отметки о пройденных уроках, результаты тестов и экзамена, историю карточек?')) resetProgress()
}
</script>

<template>
  <div class="page home">
    <section class="hero">
      <div class="hero-kicker">Курс для старта с нуля</div>
      <h1 class="hero-title">Слесарь механосборочных работ<span class="hero-accent">: сборка V12-дизеля</span></h1>
      <p class="hero-sub">
        «Карта местности» перед заводским обучением: из чего состоит большой дизель, как его собирают и как не навредить себе и изделию.
        Объяснения простыми словами, схемы можно приближать.
      </p>
      <div class="hero-actions">
        <RouterLink v-if="resumeTo" :to="resumeTo" class="btn btn-primary">
          {{ started ? 'Продолжить' : 'Начать с первого урока' }}
          <span class="btn-sub">{{ nextLesson.title }}</span>
        </RouterLink>
        <RouterLink v-else to="/glossary" class="btn btn-primary">Все уроки пройдены · повторить глоссарий</RouterLink>
        <RouterLink to="/glossary" class="btn btn-ghost">Глоссарий</RouterLink>
      </div>
      <div class="stats">
        <div class="stat"><strong>{{ lessons.length }}</strong><span>уроков</span></div>
        <div class="stat"><strong>{{ schemeCount }}</strong><span>схем</span></div>
        <div class="stat"><strong>{{ glossary.length }}</strong><span>терминов</span></div>
        <div class="stat progress-stat">
          <strong>{{ donePercent }}%</strong><span>пройдено</span>
          <div class="bar"><div class="bar-fill" :style="{ width: donePercent + '%' }" /></div>
        </div>
      </div>
    </section>

    <RouterLink to="/model" class="promo-3d">
      <div class="promo-cube" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="m3 7 9 5 9-5M12 12v10" /></svg>
      </div>
      <div class="promo-text">
        <strong>3D-модель V12 (ЯМЗ-240М2)</strong>
        <span>Покрутите двигатель, нажмите на любую деталь, разберите его ползунком и посмотрите, как по порядку работают все 12 цилиндров.</span>
      </div>
      <span class="promo-go">Открыть →</span>
    </RouterLink>

    <RouterLink to="/guides" class="promo-3d">
      <div class="promo-cube" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="17" r="4" /><path d="M12 17 9 6h6l-3 11" /><rect x="8" y="2" width="8" height="5" rx="1" /></svg>
      </div>
      <div class="promo-text">
        <strong>Разбор узлов: КШМ, ГРМ, системы, инструменты</strong>
        <span>Подробно с нуля: что это, зачем, как работает, где стоит и как собирается — с 3D-анимацией сборки по шагам.</span>
      </div>
      <span class="promo-go">Открыть →</span>
    </RouterLink>

    <div class="note-card">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17v.5" /></svg>
      <p>
        Курс универсальный: описан «типовой» V12-дизель. Числа с пометкой <span class="badge badge-example">пример</span> — ориентиры.
        На заводе всегда главнее <strong>технологическая карта</strong> и слова наставника.
      </p>
    </div>

    <section class="block">
      <div class="block-head">
        <h2>План на 2 недели</h2>
        <p>Примерно 1,5–2 часа в день: чтение, схемы, самопроверка.</p>
      </div>
      <ol class="plan">
        <li v-for="p in plan" :key="p.day" class="plan-day" :class="{ done: dayDone(p) }">
          <div class="plan-num">
            <span v-if="!dayDone(p)">{{ p.day }}</span>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10" /></svg>
          </div>
          <div class="plan-body">
            <RouterLink v-for="l in p.lessons" :key="l.id" :to="`/lesson/${l.id}`" class="plan-link" :class="{ done: isDone(l.id) }">
              {{ l.title }}
            </RouterLink>
            <template v-if="p.day === REVIEW_DAY">
              <RouterLink to="/exam" class="plan-link" :class="{ done: exam.passed }">Итоговый экзамен</RouterLink>
              <RouterLink to="/cards" class="plan-link">Карточки: термины, числа, правила</RouterLink>
              <RouterLink to="/mentor" class="plan-link">Чек-лист первой смены и вопросы наставнику</RouterLink>
            </template>
            <div v-if="p.note" class="plan-note">{{ p.note }}</div>
          </div>
        </li>
      </ol>
    </section>

    <section v-for="s in sections" :key="s.id" class="block">
      <div class="block-head">
        <h2>{{ s.title }}</h2>
      </div>
      <div class="cards">
        <RouterLink v-for="(l, i) in s.lessons" :key="l.id" :to="`/lesson/${l.id}`" class="card" :class="{ done: isDone(l.id) }" :style="{ '--i': i }">
          <div class="card-top">
            <span class="card-label">{{ lessonLabel(l) || 'Урок' }}</span>
            <span v-if="isDone(l.id)" class="card-done">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10" /></svg>
            </span>
            <span v-else-if="l.time" class="card-time">{{ l.time }}</span>
          </div>
          <h3 class="card-title">{{ l.title }}</h3>
          <p class="card-text">{{ l.summary }}</p>
          <span v-if="quizResults[l.id]" class="card-quiz" :class="{ ok: quizResults[l.id].passed }">
            Тест {{ quizResults[l.id].best }}/{{ quizResults[l.id].total }}
          </span>
        </RouterLink>
      </div>
    </section>

    <footer class="home-foot">
      <span>Прогресс хранится только в этом браузере.</span>
      <button v-if="doneCount" type="button" class="link-btn" @click="reset">Сбросить прогресс</button>
    </footer>
  </div>
</template>
