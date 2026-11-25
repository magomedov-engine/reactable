<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick, watch, createApp } from 'vue'
import Scene3D from '../components/Scene3D.vue'
import { useRoute, useRouter } from 'vue-router'
import { getLesson, lessonSource, lessonNeighbours, lessonLabel, sectionTitle, lessons } from '../lib/content.js'
import { renderMarkdown } from '../lib/markdown.js'
import { contentClick, renderMermaid } from '../lib/interactive.js'
import { progress, isDone, toggleDone, isDark } from '../lib/store.js'

const route = useRoute()
const router = useRouter()
const body = ref(null)
const activeId = ref('')
const tocOpen = ref(false)

const lesson = computed(() => getLesson(route.params.id))
const nav = computed(() => lessonNeighbours(lesson.value.id))
const rendered = computed(() => {
  // раздел «Дальше» заменён собственной навигацией внизу страницы
  const src = lessonSource(lesson.value.id).replace(/\n##\s*➡[^\n]*\n[\s\S]*$/, '\n')
  return renderMarkdown(src, lesson.value.id)
})
const done = computed(() => isDone(lesson.value.id))
// уроки про двигатель → какую деталь показать в 3D
const MODEL_PART = { 'engine-01': '', 'engine-02': 'liner', 'engine-03': 'crank', 'engine-04': 'camshaft', 'engine-05': 'injector', 'engine-06': 'turbine', 'assembly-01': '' }
const modelLink = computed(() => {
  const p = MODEL_PART[lesson.value.id]
  if (p === undefined) return null
  return p ? { path: '/model', query: { part: p } } : { path: '/model' }
})
const figCount = computed(() => rendered.value.figures.length)
const questionCount = computed(() => (lessonSource(lesson.value.id).match(/\[!question\]-/g) || []).length)

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
  const y = el.getBoundingClientRect().top + window.scrollY - 76
  window.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' })
  activeId.value = id
  tocOpen.value = false
}

function scrollToQuerySection() {
  const s = Number(route.query.s)
  if (!s || !body.value) return
  const h = body.value.querySelectorAll('h2')[s - 1]
  if (h) {
    h.classList.add('flash')
    setTimeout(() => h.classList.remove('flash'), 1600)
    scrollToId(h.id, false)
  }
}

let saveTimer = null
function onScroll() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    progress.last = { id: lesson.value.id, y: Math.round(window.scrollY) }
  }, 300)
}

onMounted(async () => {
  progress.last = { id: lesson.value.id, y: progress.last?.id === lesson.value.id ? progress.last.y : 0 }
  await nextTick()
  setupSpy()
  if (route.query.s) scrollToQuerySection()
  else if (route.query.resume && progress.last?.y) window.scrollTo({ top: progress.last.y })
  window.addEventListener('scroll', onScroll, { passive: true })
  renderMermaid(body.value, isDark.value)
  mount3d()
})

// 3D-блоки внутри текста урока (текст вставлен через v-html, поэтому монтируем вручную)
const apps3d = []
function mount3d() {
  if (!body.value) return
  for (const el of body.value.querySelectorAll('.l3d-mount')) {
    const app = createApp(Scene3D, { id: el.dataset.scene, poster: el.dataset.poster || '', caption: el.dataset.caption || '' })
    app.mount(el)
    apps3d.push(app)
  }
}
function unmount3d() {
  apps3d.splice(0).forEach((a) => a.unmount())
}
watch(isDark, async (d) => {
  if (!body.value) return
  body.value.querySelectorAll('.mermaid-wrap').forEach((b) => b.classList.remove('ready'))
  // перерисовать с новой темой: вернуть исходные блоки
  const fresh = document.createElement('div')
  fresh.innerHTML = rendered.value.html
  const olds = body.value.querySelectorAll('.mermaid-wrap')
  const news = fresh.querySelectorAll('.mermaid-wrap')
  olds.forEach((o, i) => news[i] && o.replaceWith(news[i]))
  await nextTick()
  renderMermaid(body.value, d)
})
onBeforeUnmount(() => {
  unmount3d()
  observer?.disconnect()
  window.removeEventListener('scroll', onScroll)
})

function markAndNext() {
  if (!done.value) toggleDone(lesson.value.id)
  if (nav.value.next) router.push(`/lesson/${nav.value.next.id}`)
  else router.push('/')
}
const position = computed(() => `${nav.value.index + 1} из ${lessons.length}`)
</script>

<template>
  <div class="page lesson-page">
    <div class="lesson-grid">
      <article class="lesson">
        <header class="lesson-head">
          <div class="crumbs">
            <span>{{ sectionTitle(lesson.section) }}</span>
            <span class="dot">•</span>
            <span>урок {{ position }}</span>
          </div>
          <h1 class="lesson-title">
            <span v-if="lessonLabel(lesson)" class="day-badge">{{ lessonLabel(lesson) }}</span>
            {{ lesson.title }}
          </h1>
          <div class="lesson-meta">
            <span v-if="lesson.time" class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {{ lesson.time }}
            </span>
            <span v-if="figCount" class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /></svg>
              {{ figCount }} {{ figCount === 1 ? 'схема' : figCount < 5 ? 'схемы' : 'схем' }}
            </span>
            <span v-if="questionCount" class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17v.5" /></svg>
              {{ questionCount }} вопросов для самопроверки
            </span>
            <span v-if="done" class="meta-item done-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10" /></svg>
              Пройден
            </span>
          </div>
        </header>

        <details v-if="rendered.toc.length" class="toc-mobile" :open="tocOpen" @toggle="tocOpen = $event.target.open">
          <summary>
            <span>Содержание урока</span>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <nav>
            <a v-for="h in rendered.toc" :key="h.id" :href="`#${h.id}`" :class="{ active: activeId === h.id }" @click.prevent="scrollToId(h.id)">{{ h.text }}</a>
          </nav>
        </details>

        <div ref="body" class="prose lesson-body" @click="onClick" v-html="rendered.html" />

        <RouterLink v-if="modelLink" :to="modelLink" class="promo-3d in-lesson">
          <div class="promo-cube" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="m3 7 9 5 9-5M12 12v10" /></svg>
          </div>
          <div class="promo-text">
            <strong>Посмотреть в 3D</strong>
            <span>Найдите детали из этого урока на модели двигателя и посмотрите, как они двигаются.</span>
          </div>
          <span class="promo-go">Открыть →</span>
        </RouterLink>

        <section class="lesson-end">
          <button class="done-toggle" :class="{ on: done }" type="button" @click="toggleDone(lesson.id)">
            <span class="done-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10" /></svg>
            </span>
            <span>
              <strong>{{ done ? 'Урок пройден' : 'Отметить урок пройденным' }}</strong>
              <small>{{ done ? 'Нажмите ещё раз, чтобы снять отметку' : 'Прогресс сохраняется в этом браузере' }}</small>
            </span>
          </button>

          <div class="pager">
            <RouterLink v-if="nav.prev" :to="`/lesson/${nav.prev.id}`" class="pager-card prev">
              <span class="pager-dir">← Назад</span>
              <span class="pager-title">{{ nav.prev.title }}</span>
            </RouterLink>
            <span v-else />
            <button v-if="nav.next" type="button" class="pager-card next primary" @click="markAndNext">
              <span class="pager-dir">{{ done ? 'Дальше →' : 'Пройден, дальше →' }}</span>
              <span class="pager-title">{{ nav.next.title }}</span>
            </button>
            <RouterLink v-else to="/" class="pager-card next primary">
              <span class="pager-dir">Курс пройден 🎉</span>
              <span class="pager-title">Вернуться на главную</span>
            </RouterLink>
          </div>
        </section>
      </article>

      <aside v-if="rendered.toc.length" class="toc" aria-label="Содержание урока">
        <div class="toc-inner">
          <div class="toc-title">На этой странице</div>
          <a v-for="h in rendered.toc" :key="h.id" :href="`#${h.id}`" :class="{ active: activeId === h.id }" @click.prevent="scrollToId(h.id)">{{ h.text }}</a>
        </div>
      </aside>
    </div>
  </div>
</template>
