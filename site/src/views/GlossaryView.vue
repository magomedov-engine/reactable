<script setup>
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { glossary } from '../lib/content.js'
import { renderMarkdown } from '../lib/markdown.js'
import { contentClick } from '../lib/interactive.js'

const route = useRoute()
const router = useRouter()
const q = ref('')
const openSlug = ref(route.params.slug || '')

const norm = (s) => s.toLowerCase().replace(/ё/g, 'е')
const items = computed(() => {
  const s = norm(q.value.trim())
  if (!s) return glossary
  return glossary.filter((g) => norm(g.term).includes(s) || norm(g.body).includes(s))
})
const letters = computed(() => {
  const m = new Map()
  for (const g of items.value) {
    const L = g.term[0].toUpperCase()
    if (!m.has(L)) m.set(L, [])
    m.get(L).push(g)
  }
  return [...m.entries()]
})
const htmlCache = new Map()
function html(g) {
  if (!htmlCache.has(g.slug)) htmlCache.set(g.slug, renderMarkdown(g.body).html)
  return htmlCache.get(g.slug)
}

function toggle(slug) {
  openSlug.value = openSlug.value === slug ? '' : slug
  router.replace(openSlug.value ? `/glossary/${openSlug.value}` : '/glossary')
}
async function focusSlug(slug, smooth) {
  if (!slug) return
  openSlug.value = slug
  await nextTick()
  const el = document.getElementById(`t-${slug}`)
  if (el) {
    const y = el.getBoundingClientRect().top + window.scrollY - 170
    window.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' })
    el.classList.add('flash')
    setTimeout(() => el.classList.remove('flash'), 1400)
  }
}
watch(
  () => route.params.slug,
  (s) => {
    if (s && s !== openSlug.value) focusSlug(s, true)
  },
)
onMounted(() => focusSlug(route.params.slug, false))

function jump(L) {
  const el = document.getElementById(`L-${L}`)
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 160, behavior: 'smooth' })
}
function onClick(e) {
  contentClick(e, router, [])
}
</script>

<template>
  <div class="page glossary-page">
    <header class="gl-head">
      <h1>Глоссарий</h1>
      <p>{{ glossary.length }} терминов простыми словами. Нажмите на термин, чтобы раскрыть. В уроках термины подчёркнуты пунктиром: нажмите на них, и откроется подсказка.</p>
    </header>
    <div class="gl-tools">
        <div class="gl-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input v-model="q" type="search" placeholder="Найти термин…" />
        </div>
        <div class="letters">
          <button v-for="[L] in letters" :key="L" type="button" class="letter" @click="jump(L)">{{ L }}</button>
        </div>
    </div>

    <p v-if="!items.length" class="empty">Ничего не нашлось.</p>

    <section v-for="[L, list] in letters" :id="`L-${L}`" :key="L" class="gl-group">
      <div class="gl-letter">{{ L }}</div>
      <div class="gl-list">
        <div v-for="g in list" :id="`t-${g.slug}`" :key="g.slug" class="gl-item" :class="{ open: openSlug === g.slug }">
          <button class="gl-row" type="button" :aria-expanded="openSlug === g.slug" @click="toggle(g.slug)">
            <span class="gl-term">{{ g.term }}</span>
            <span class="gl-short">{{ g.short }}</span>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <div class="gl-body-wrap">
            <div class="gl-body prose" @click="onClick" v-html="html(g)" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
