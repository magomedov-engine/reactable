<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ui } from '../lib/store.js'
import { search, highlight } from '../lib/search.js'
import { getLesson, lessonLabel } from '../lib/content.js'

const router = useRouter()
const q = ref('')
const input = ref(null)
const active = ref(0)
const list = ref(null)

const results = computed(() => search(q.value))
watch(q, () => (active.value = 0))
watch(
  () => ui.searchOpen,
  async (open) => {
    if (open) {
      await nextTick()
      input.value?.focus()
      input.value?.select()
    }
  },
)

function go(r) {
  ui.searchOpen = false
  if (r.kind === 'term') router.push(`/glossary/${r.slug}`)
  else router.push({ path: `/lesson/${r.lessonId}`, query: r.sec ? { s: r.sec } : {} })
}
function onKey(e) {
  const n = results.value.length
  if (e.key === 'Escape') ui.searchOpen = false
  else if (e.key === 'ArrowDown' && n) {
    e.preventDefault()
    active.value = (active.value + 1) % n
    scrollActive()
  } else if (e.key === 'ArrowUp' && n) {
    e.preventDefault()
    active.value = (active.value - 1 + n) % n
    scrollActive()
  } else if (e.key === 'Enter' && n) go(results.value[active.value])
}
function scrollActive() {
  nextTick(() => list.value?.querySelector('.res.active')?.scrollIntoView({ block: 'nearest' }))
}
const SUGGEST = ['момент затяжки', 'микрометр', 'выступание гильзы', 'метки ГРМ', 'стропы', 'сотка', 'метчик', 'манжета']
</script>

<template>
  <Transition name="modal">
    <div v-if="ui.searchOpen" class="modal-layer" @mousedown.self="ui.searchOpen = false">
      <div class="search-box" role="dialog" aria-modal="true" aria-label="Поиск" @keydown="onKey">
        <div class="search-input-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input ref="input" v-model="q" type="search" placeholder="Что найти? Например: «зазор клапана»" autocomplete="off" spellcheck="false" />
          <button class="esc-btn" type="button" @click="ui.searchOpen = false">Esc</button>
        </div>
        <div ref="list" class="search-results">
          <div v-if="q.trim().length < 2" class="search-empty">
            <p>Ищите по урокам и глоссарию. Попробуйте:</p>
            <div class="chips">
              <button v-for="s in SUGGEST" :key="s" type="button" class="chip" @click="q = s">{{ s }}</button>
            </div>
          </div>
          <div v-else-if="!results.length" class="search-empty"><p>Ничего не нашлось. Попробуйте другое слово.</p></div>
          <button
            v-for="(r, i) in results"
            :key="r.id"
            type="button"
            class="res"
            :class="{ active: i === active }"
            @mouseenter="active = i"
            @click="go(r)"
          >
            <span class="res-kind" :class="r.kind">{{ r.kind === 'term' ? 'Термин' : lessonLabel(getLesson(r.lessonId)) || 'Урок' }}</span>
            <span class="res-main">
              <span class="res-title">
                <span v-html="highlight(r.title, r.terms)" />
                <span v-if="r.heading && r.kind === 'lesson'" class="res-heading"> › <span v-html="highlight(r.heading, r.terms)" /></span>
              </span>
              <span class="res-snippet" v-html="highlight(r.snippet, r.terms)" />
            </span>
          </button>
        </div>
        <div class="search-foot">
          <span><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> выбрать</span>
          <span><kbd class="kbd">Enter</kbd> открыть</span>
        </div>
      </div>
    </div>
  </Transition>
</template>
