<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { ui, settings } from '../lib/store.js'

const route = useRoute()
const readPct = ref(0)
const fontOpen = ref(false)
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

function onScroll() {
  const h = document.documentElement
  const max = h.scrollHeight - h.clientHeight
  readPct.value = max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

const FONTS = [
  { v: 0.9, label: 'Мельче' },
  { v: 1, label: 'Обычный' },
  { v: 1.12, label: 'Крупнее' },
  { v: 1.25, label: 'Крупный' },
]
const showProgress = computed(() => route.name === 'lesson')
function setFont(v) {
  settings.font = v
  fontOpen.value = false
}
</script>

<template>
  <header class="topbar">
    <button class="icon-btn menu-btn" type="button" aria-label="Открыть меню" @click="ui.sidebarOpen = true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
    </button>
    <RouterLink to="/" class="brand" aria-label="На главную">
      <span class="brand-mark">
        <svg viewBox="0 0 64 64"><polygon points="32,10 51,21 51,43 32,54 13,43 13,21" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="miter" /><rect x="25" y="25" width="14" height="14" fill="currentColor" /></svg>
      </span>
      <span class="brand-text">reactable</span>
    </RouterLink>

    <button class="search-trigger" type="button" @click="ui.searchOpen = true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <span class="search-placeholder">Поиск по курсу</span>
      <kbd class="kbd">{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
    </button>

    <div class="topbar-actions">
      <div class="font-menu">
        <button class="icon-btn" type="button" aria-label="Размер текста" :aria-expanded="fontOpen" @click="fontOpen = !fontOpen">
          <span class="aa">Aa</span>
        </button>
        <Transition name="pop">
          <div v-if="fontOpen" class="popover-menu" @mouseleave="fontOpen = false">
            <div class="popover-title">Размер текста</div>
            <button v-for="f in FONTS" :key="f.v" type="button" class="menu-item" :class="{ active: settings.font === f.v }" @click="setFont(f.v)">
              <span :style="{ fontSize: 14 * f.v + 'px' }">{{ f.label }}</span>
            </button>
          </div>
        </Transition>
      </div>
    </div>
    <div v-if="showProgress" class="read-progress" :style="{ transform: `scaleX(${readPct / 100})` }" />
  </header>
</template>
