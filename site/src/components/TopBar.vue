<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { ui, settings, isDark, cycleTheme } from '../lib/store.js'

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
        <svg viewBox="0 0 64 64"><polygon points="32,12 49,22 49,42 32,52 15,42 15,22" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round" /><circle cx="32" cy="32" r="8" fill="none" stroke="currentColor" stroke-width="6" /></svg>
      </span>
      <span class="brand-text">Слесарь<span class="brand-dim"> · V12</span></span>
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
      <button class="icon-btn" type="button" :aria-label="isDark ? 'Светлая тема' : 'Тёмная тема'" @click="cycleTheme">
        <Transition name="spin" mode="out-in">
          <svg v-if="isDark" key="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          <svg v-else key="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
        </Transition>
      </button>
    </div>
    <div v-if="showProgress" class="read-progress" :style="{ transform: `scaleX(${readPct / 100})` }" />
  </header>
</template>
