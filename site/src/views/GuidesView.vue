<script setup>
// Раздел «Разбор узлов»: список подробных разборов (КШМ, ГРМ, системы, инструменты)
import { guides } from '../lib/content.js'
import { quizResults } from '../lib/store.js'

const ICONS = {
  kshm: '<circle cx="12" cy="17" r="4"/><path d="M12 17 9 6h6l-3 11"/><rect x="8" y="2" width="8" height="5" rx="1"/>',
  grm: '<circle cx="8" cy="15" r="5"/><circle cx="17" cy="7" r="3"/><path d="M8 10V3M17 10v11"/>',
  systems: '<path d="M4 6h10a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h12"/><circle cx="20" cy="22" r="0.5"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
}
</script>

<template>
  <div class="page guides-page">
    <section class="hero">
      <div class="hero-kicker">Разбор узлов</div>
      <h1 class="hero-title">Как устроено <span class="hero-accent">и как собирается</span></h1>
      <p class="hero-sub">
        Четыре подробных разбора с нуля: что это за узел, зачем он нужен, как работает, где стоит в двигателе ЯМЗ-240М2 и как его собирают — по шагам,
        с 3D-анимацией сборки. Читать можно в любом порядке, но лучше — после уроков недели 2.
      </p>
    </section>

    <div class="cards">
      <RouterLink v-for="(g, i) in guides" :key="g.id" :to="`/guide/${g.id}`" class="card guide-card" :style="{ '--i': i }">
        <div class="card-top">
          <span class="guide-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" v-html="ICONS[g.id] || ICONS.tools" />
          </span>
          <span v-if="g.time" class="card-time">{{ g.time }}</span>
        </div>
        <h3 class="card-title">{{ g.title }}</h3>
        <p class="card-text">{{ g.summary }}</p>
        <span v-if="quizResults[`guide-${g.id}`]" class="card-quiz" :class="{ ok: quizResults[`guide-${g.id}`].passed }">
          Тест {{ quizResults[`guide-${g.id}`].best }}/{{ quizResults[`guide-${g.id}`].total }}
        </span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.guides-page .cards { margin-top: 24px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.guide-ico { display: grid; place-items: center; width: 40px; height: 40px; border: 1px solid var(--border-strong); border-radius: var(--radius); color: var(--accent-strong); }
.guide-ico svg { width: 22px; height: 22px; }
.guide-card .card-title { font-size: 1.15em; }
</style>
