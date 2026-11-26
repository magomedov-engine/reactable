<script setup>
// Разбор узла (раздел «Разбор узлов»): длинный текст с 3D-блоками ```3d id``` и тестом в конце.
// Не входит в план по дням; устроен как урок: оглавление с подсветкой, 3D монтируется вручную (текст через v-html).
import { computed, ref, onMounted, onBeforeUnmount, nextTick, createApp } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Scene3D from '../components/Scene3D.vue'
import LessonQuiz from '../components/LessonQuiz.vue'
import { guides, getGuide, guideSource } from '../lib/content.js'
import { renderMarkdown } from '../lib/markdown.js'
import { contentClick, renderMermaid } from '../lib/interactive.js'
import { isDark, quizResults } from '../lib/store.js'

const route = useRoute()
const router = useRouter()
const body = ref(null)
const activeId = ref('')
const tocOpen = ref(false)

const guide = computed(() => getGuide(route.params.id))
const rendered = computed(() => renderMarkdown(guideSource(guide.value.id), `guide-${guide.value.id}`))
const idx = computed(() => guides.findIndex((g) => g.id === guide.value.id))
const prev = computed(() => guides[idx.value - 1] || null)
const next = computed(() => guides[idx.value + 1] || null)
const scenes = computed(() => (rendered.value.html.match(/l3d-mount/g) || []).length)
const quizKey = computed(() => `guide-${guide.value.id}`)
const quizResult = computed(() => quizResults[quizKey.value] || null)

function onClick(e) {
  contentClick(e, router, rendered.value.figures)
}

let observer = null
function setupSpy() {
  observer?.disconnect()
  const hs = body.value ? [...body.value.querySelectorAll('h2')] : []
  if (!hs.length) return
  observer = new IntersectionObserver(
    (entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis.length) activeId.value = vis[0].target.id
    },
    { rootMargin: '-72px 0px -65% 0px' },
  )
  hs.forEach((h) => observer.observe(h))
}
function scrollToId(id, smooth = true) {
  const el = document.getElementById(id)
  if (!el) return
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: smooth ? 'smooth' : 'auto' })
  activeId.value = id
  tocOpen.value = false
}

const apps = []
function mountWidgets() {
  if (!body.value) return
  for (const el of body.value.querySelectorAll('.l3d-mount')) {
    const app = createApp(Scene3D, { id: el.dataset.scene, poster: el.dataset.poster || '', caption: el.dataset.caption || '' })
    app.mount(el)
    apps.push(app)
  }
  const q = body.value.querySelector('.quiz-mount')
  if (q && rendered.value.quiz.length) {
    const app = createApp(LessonQuiz, { lessonId: quizKey.value, questions: rendered.value.quiz })
    app.mount(q)
    apps.push(app)
  }
}

onMounted(async () => {
  await nextTick()
  setupSpy()
  const s = Number(route.query.s)
  if (s) {
    const h = body.value?.querySelectorAll('h2')[s - 1]
    if (h) scrollToId(h.id, false)
  }
  renderMermaid(body.value, isDark.value)
  mountWidgets()
})
onBeforeUnmount(() => {
  apps.splice(0).forEach((a) => a.unmount())
  observer?.disconnect()
})
</script>

<template>
  <div class="page lesson-page guide-page">
    <div class="lesson-grid">
      <article class="lesson">
        <header class="lesson-head">
          <div class="crumbs">
            <RouterLink to="/guides">Разбор узлов</RouterLink>
            <span class="dot">•</span>
            <span>{{ idx + 1 }} из {{ guides.length }}</span>
          </div>
          <h1 class="lesson-title">{{ guide.title }}</h1>
          <div class="lesson-meta">
            <span v-if="guide.time" class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {{ guide.time }}
            </span>
            <span v-if="scenes" class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="m3 7 9 5 9-5M12 12v10" /></svg>
              {{ scenes }} 3D-{{ scenes === 1 ? 'блок' : scenes < 5 ? 'блока' : 'блоков' }}
            </span>
            <span v-if="rendered.quiz.length" class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17v.5" /></svg>
              <template v-if="quizResult">Тест: {{ quizResult.best }} из {{ quizResult.total }}{{ quizResult.passed ? ' · сдан' : '' }}</template>
              <template v-else>Тест: {{ rendered.quiz.length }} вопросов</template>
            </span>
          </div>
        </header>

        <details v-if="rendered.toc.length" class="toc-mobile" :open="tocOpen" @toggle="tocOpen = $event.target.open">
          <summary>
            <span>Содержание</span>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <nav>
            <a v-for="h in rendered.toc" :key="h.id" :href="`#${h.id}`" :class="{ active: activeId === h.id }" @click.prevent="scrollToId(h.id)">{{ h.text }}</a>
          </nav>
        </details>

        <div ref="body" class="prose lesson-body" @click="onClick" v-html="rendered.html" />

        <section class="lesson-end">
          <div class="pager">
            <RouterLink v-if="prev" :to="`/guide/${prev.id}`" class="pager-card prev">
              <span class="pager-dir">← Назад</span>
              <span class="pager-title">{{ prev.title }}</span>
            </RouterLink>
            <RouterLink v-else to="/guides" class="pager-card prev">
              <span class="pager-dir">← Все разборы</span>
              <span class="pager-title">Разбор узлов</span>
            </RouterLink>
            <RouterLink v-if="next" :to="`/guide/${next.id}`" class="pager-card next primary">
              <span class="pager-dir">Дальше →</span>
              <span class="pager-title">{{ next.title }}</span>
            </RouterLink>
            <RouterLink v-else to="/model" class="pager-card next primary">
              <span class="pager-dir">Дальше →</span>
              <span class="pager-title">3D-модель двигателя целиком</span>
            </RouterLink>
          </div>
        </section>
      </article>

      <aside v-if="rendered.toc.length" class="toc" aria-label="Содержание">
        <div class="toc-inner">
          <div class="toc-title">На этой странице</div>
          <a v-for="h in rendered.toc" :key="h.id" :href="`#${h.id}`" :class="{ active: activeId === h.id }" @click.prevent="scrollToId(h.id)">{{ h.text }}</a>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.crumbs a { color: inherit; border-bottom: 1px dashed var(--border-strong); }
.crumbs a:hover { color: var(--text); }
</style>
