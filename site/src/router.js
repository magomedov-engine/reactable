import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import LessonView from './views/LessonView.vue'
import GlossaryView from './views/GlossaryView.vue'
import NotFound from './views/NotFound.vue'
import { getLesson } from './lib/content.js'
import { ui } from './lib/store.js'

export const router = createRouter({
  // hash-режим: GitHub Pages отдаёт только index.html, и прямые ссылки работают
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: 'Главная' } },
    {
      path: '/lesson/:id',
      name: 'lesson',
      component: LessonView,
      beforeEnter: (to) => (getLesson(to.params.id) ? true : { name: 'notfound' }),
    },
    { path: '/glossary/:slug?', name: 'glossary', component: GlossaryView, meta: { title: 'Глоссарий' } },
    // three.js грузится только при открытии этой страницы
    { path: '/model', name: 'model', component: () => import('./views/ModelView.vue'), meta: { title: '3D-модель V12' } },
    { path: '/:pathMatch(.*)*', name: 'notfound', component: NotFound, meta: { title: 'Не найдено' } },
  ],
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    if (to.name === from.name && (to.name === 'glossary' || to.name === 'model')) return false
    return { top: 0 }
  },
})

router.afterEach((to) => {
  ui.sidebarOpen = false
  ui.term = null
  const l = to.name === 'lesson' ? getLesson(to.params.id) : null
  document.title = `${l ? l.title : to.meta.title || 'Курс'} · Слесарь-сборщик V12`
})
