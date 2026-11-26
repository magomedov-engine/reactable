<script setup>
// Тренажёры: чтение штангенциркуля и микрометра, перевод единиц, порядок затяжки.
// Вкладка — в адресе (?t=…), чтобы на тренажёр можно было сослаться из урока.
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CaliperTrainer from '../components/trainers/CaliperTrainer.vue'
import MicrometerTrainer from '../components/trainers/MicrometerTrainer.vue'
import UnitsTrainer from '../components/trainers/UnitsTrainer.vue'
import TorqueTrainer from '../components/trainers/TorqueTrainer.vue'
import { trainerStats } from '../lib/store.js'

const TABS = [
  { id: 'caliper', t: 'Штангенциркуль', c: CaliperTrainer, lesson: 'basics-05', what: 'Целые миллиметры — по штанге, доли — по совпавшей черте нониуса.' },
  { id: 'micrometer', t: 'Микрометр', c: MicrometerTrainer, lesson: 'basics-05', what: 'Стебель (целые и половинки) плюс барабан. Главная ловушка — пропущенная половинка.' },
  { id: 'units', t: 'Единицы', c: UnitsTrainer, lesson: 'extra-04', what: 'Сотки, микроны, Н·м и кгс·м, бары и МПа, градусы доворота.' },
  { id: 'torque', t: 'Порядок затяжки', c: TorqueTrainer, lesson: 'basics-07', what: 'Нажимайте болты по порядку: от центра к краям, крест-накрест, в несколько проходов.' },
]
const route = useRoute()
const router = useRouter()
const tab = computed(() => TABS.find((t) => t.id === route.query.t) || TABS[0])
const go = (id) => router.replace({ query: { t: id } })
const st = computed(() => trainerStats[tab.value.id])
</script>

<template>
  <div class="page trainers-page">
    <header>
      <div class="hero-kicker">Практика без цеха</div>
      <h1 class="trainers-title">Тренажёры</h1>
      <p class="hero-sub">Случайные задания: решайте, пока не станет получаться без ошибок 10 раз подряд. Разбор показывает, где смотреть и как считать.</p>
    </header>

    <div class="mp-tabs tr-tabs" role="tablist">
      <button v-for="t in TABS" :key="t.id" type="button" role="tab" :aria-selected="tab.id === t.id" :class="{ on: tab.id === t.id }" @click="go(t.id)">{{ t.t }}</button>
    </div>

    <section class="quiz tr-card">
      <div class="quiz-head">
        <span class="quiz-kicker">{{ tab.t }}</span>
        <span v-if="st" class="quiz-best" :class="{ ok: st.best >= 10 }">
          верно {{ st.ok }} из {{ st.n }} · серия {{ st.streak }} · лучшая {{ st.best }}
        </span>
      </div>
      <p class="quiz-lead">{{ tab.what }} <RouterLink :to="`/lesson/${tab.lesson}`" class="tr-lesson">Урок →</RouterLink></p>
      <component :is="tab.c" :key="tab.id" />
    </section>
  </div>
</template>

<style scoped>
.trainers-page { max-width: 860px; }
.trainers-title { margin: 6px 0 0; font-family: var(--font-head); font-weight: 600; font-size: clamp(30px, 5vw, 44px); line-height: 1.05; text-transform: uppercase; letter-spacing: 0.01em; }
.trainers-page .hero-sub { margin-top: 12px; }
.tr-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 22px 0 0; }
.tr-tabs button {
  padding: 8px 14px; font-size: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  transition: border-color 0.2s var(--ease);
}
.tr-tabs button:hover { border-color: var(--text-3); }
.tr-tabs button.on { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.tr-card { margin-top: 14px; }
.tr-lesson { color: var(--text); border-bottom: 1px dashed var(--border-strong); }
</style>
