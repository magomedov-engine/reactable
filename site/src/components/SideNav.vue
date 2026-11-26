<script setup>
import { useRoute } from 'vue-router'
import { sections, lessonLabel, glossary } from '../lib/content.js'
import { ui, isDone, doneCount, donePercent, exam } from '../lib/store.js'
import { lessons } from '../lib/content.js'

import { deckStats } from '../lib/cards.js'
import { computed } from 'vue'

const route = useRoute()
const cardsToday = computed(() => { const st = deckStats(''); return st.due + st.fresh })
const total = lessons.length
</script>

<template>
  <Transition name="fade">
    <div v-if="ui.sidebarOpen" class="backdrop" @click="ui.sidebarOpen = false" />
  </Transition>
  <aside class="sidenav" :class="{ open: ui.sidebarOpen }" aria-label="Содержание курса">
    <div class="sidenav-head">
      <div class="progress-card">
        <div class="progress-row">
          <span>Пройдено</span>
          <strong>{{ doneCount }} из {{ total }}</strong>
        </div>
        <div class="bar"><div class="bar-fill" :style="{ width: donePercent + '%' }" /></div>
      </div>
      <button class="icon-btn close-btn" type="button" aria-label="Закрыть меню" @click="ui.sidebarOpen = false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>

    <nav class="sidenav-scroll">
      <RouterLink to="/" class="nav-top" :class="{ active: route.name === 'home' }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></svg>
        Главная и план на 2 недели
      </RouterLink>
      <RouterLink to="/model" class="nav-top" :class="{ active: route.name === 'model' }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="m3 7 9 5 9-5M12 12v10" /></svg>
        3D-модель двигателя <span class="count new">3D</span>
      </RouterLink>
      <RouterLink to="/glossary" class="nav-top" :class="{ active: route.name === 'glossary' }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M9 7h6" /></svg>
        Глоссарий <span class="count">{{ glossary.length }}</span>
      </RouterLink>
      <RouterLink to="/cards" class="nav-top" :class="{ active: route.name === 'cards' }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="14" height="14" rx="1.5" /><path d="M7 3h13a1 1 0 0 1 1 1v13" /></svg>
        Карточки <span v-if="cardsToday" class="count new" title="Карточек на сегодня">{{ cardsToday }}</span>
      </RouterLink>
      <RouterLink to="/exam" class="nav-top" :class="{ active: route.name === 'exam' }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6v3H9z" /><path d="M15 5h3v16H6V5h3" /><path d="m9 13 2 2 4-4" /></svg>
        Итоговый экзамен <span v-if="exam.passed" class="count">сдан</span>
      </RouterLink>

      <div v-for="s in sections" :key="s.id" class="nav-section">
        <div class="nav-section-title">{{ s.title }}</div>
        <RouterLink
          v-for="l in s.lessons"
          :key="l.id"
          :to="`/lesson/${l.id}`"
          class="nav-lesson"
          :class="{ active: route.params.id === l.id, done: isDone(l.id) }"
        >
          <span class="nav-dot">
            <svg v-if="isDone(l.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10" /></svg>
          </span>
          <span class="nav-lesson-text">
            <span class="nav-label">{{ lessonLabel(l) }}</span>
            <span class="nav-title">{{ l.title }}</span>
          </span>
        </RouterLink>
      </div>
      <p class="nav-foot">Материалы учебные. Цифры с пометкой «пример» — ориентиры: работаем всегда по технологической карте завода.</p>
    </nav>
  </aside>
</template>
