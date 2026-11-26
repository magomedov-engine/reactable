<script setup>
import { onMounted, onBeforeUnmount, watch } from 'vue'
import TopBar from './components/TopBar.vue'
import SideNav from './components/SideNav.vue'
import SearchModal from './components/SearchModal.vue'
import ImageViewer from './components/ImageViewer.vue'
import TermPopover from './components/TermPopover.vue'
import { ui } from './lib/store.js'

function onKey(e) {
  const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '')
  if ((e.key === 'k' || e.key === 'л') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    ui.searchOpen = true
  } else if (e.key === '/' && !typing && !ui.viewer) {
    e.preventDefault()
    ui.searchOpen = true
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// блокируем прокрутку страницы под открытыми окнами
watch(
  () => !!(ui.viewer || ui.searchOpen || ui.sidebarOpen),
  (lock) => document.documentElement.classList.toggle('no-scroll', lock),
)
</script>

<template>
  <div class="app">
    <a class="skip-link" href="#main">К содержанию</a>
    <TopBar />
    <SideNav />
    <main id="main" class="main">
      <RouterView v-slot="{ Component, route }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="['glossary', 'model', 'trainers'].includes(route.name) ? route.name : route.fullPath.split('?')[0]" />
        </Transition>
      </RouterView>
    </main>
    <SearchModal />
    <ImageViewer />
    <TermPopover />
  </div>
</template>
