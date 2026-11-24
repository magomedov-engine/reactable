<script setup>
import { computed, watch, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ui } from '../lib/store.js'
import { getTermBySlug } from '../lib/content.js'
import { renderMarkdown } from '../lib/markdown.js'
import { contentClick } from '../lib/interactive.js'

const router = useRouter()
const card = ref(null)
const narrow = ref(typeof window !== 'undefined' && window.innerWidth < 720)

const term = computed(() => (ui.term ? getTermBySlug(ui.term.slug) : null))
const html = computed(() => (term.value ? renderMarkdown(term.value.body).html : ''))

const style = computed(() => {
  if (!ui.term || narrow.value) return {}
  const r = ui.term.rect
  const w = 360
  const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12)
  const below = r.bottom + 10
  const fitsBelow = below + 260 < window.innerHeight
  return fitsBelow ? { left: left + 'px', top: below + 'px', width: w + 'px' } : { left: left + 'px', bottom: window.innerHeight - r.top + 10 + 'px', width: w + 'px' }
})

function close() {
  ui.term = null
}
function openFull() {
  const slug = ui.term.slug
  close()
  router.push(`/glossary/${slug}`)
}
function onDoc(e) {
  if (!ui.term) return
  if (card.value?.contains(e.target) || e.target.closest?.('a.gl')) return
  close()
}
function onKey(e) {
  if (e.key === 'Escape') close()
}
function onScroll() {
  if (!narrow.value) close()
}
function onResize() {
  narrow.value = window.innerWidth < 720
}
watch(
  () => !!ui.term,
  (open) => {
    const fn = open ? 'addEventListener' : 'removeEventListener'
    document[fn]('pointerdown', onDoc)
    window[fn]('keydown', onKey)
    window[fn]('scroll', onScroll, { passive: true })
    window[fn]('resize', onResize)
    if (open) onResize()
  },
)
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDoc)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <Transition name="fade">
    <div v-if="term && narrow" class="backdrop sheet-backdrop" @click="close" />
  </Transition>
  <Transition :name="narrow ? 'sheet' : 'pop'">
    <div v-if="term" ref="card" class="term-card" :class="{ sheet: narrow }" :style="style" role="dialog" :aria-label="term.term">
      <div class="term-head">
        <span class="term-kicker">Термин</span>
        <button class="icon-btn small" type="button" aria-label="Закрыть" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <h3 class="term-title">{{ term.term }}</h3>
      <div class="term-body prose" @click="contentClick($event, router, [])" v-html="html" />
      <button class="link-btn" type="button" @click="openFull">Открыть в глоссарии →</button>
    </div>
  </Transition>
</template>
