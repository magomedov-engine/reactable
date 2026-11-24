import { reactive, computed, watch } from 'vue'
import { lessons } from './content.js'

const KEY = 'slesar:'
const load = (k, d) => {
  try {
    const v = localStorage.getItem(KEY + k)
    return v == null ? d : JSON.parse(v)
  } catch {
    return d
  }
}
const save = (k, v) => {
  try {
    localStorage.setItem(KEY + k, JSON.stringify(v))
  } catch {}
}

// ---------- прогресс
export const progress = reactive({
  done: load('done', []),
  last: load('last', null), // { id, y }
})
watch(() => [...progress.done], (v) => save('done', v))
watch(() => progress.last, (v) => save('last', v), { deep: true })

export const isDone = (id) => progress.done.includes(id)
export function toggleDone(id) {
  const i = progress.done.indexOf(id)
  if (i >= 0) progress.done.splice(i, 1)
  else progress.done.push(id)
}
export const doneCount = computed(() => lessons.filter((l) => progress.done.includes(l.id)).length)
export const donePercent = computed(() => Math.round((doneCount.value / lessons.length) * 100))
export const nextLesson = computed(() => {
  if (progress.last && !isDone(progress.last.id)) return lessons.find((l) => l.id === progress.last.id)
  return lessons.find((l) => !progress.done.includes(l.id)) || null
})
export function resetProgress() {
  progress.done.splice(0)
  progress.last = null
}

// ---------- оформление
// у reactable одна тема — тёмная (графит и молочный); светлой нет
let fontRaw = '1'
try {
  fontRaw = localStorage.getItem(KEY + 'font') || '1'
} catch {}

export const settings = reactive({
  font: Number(fontRaw), // множитель размера текста урока
})
export const isDark = computed(() => true)
if (typeof document !== 'undefined') document.documentElement.dataset.theme = 'dark'

watch(
  () => settings.font,
  (f) => {
    document.documentElement.style.setProperty('--reader-scale', String(f))
    try {
      localStorage.setItem(KEY + 'font', String(f))
    } catch {}
  },
  { immediate: true },
)

// ---------- глобальный UI
export const ui = reactive({
  sidebarOpen: false,
  searchOpen: false,
  viewer: null, // { items, index }
  term: null, // { slug, rect }
})

export function openViewer(items, index = 0) {
  ui.viewer = { items, index }
}
