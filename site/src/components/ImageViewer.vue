<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import Panzoom from '@panzoom/panzoom'
import { ui } from '../lib/store.js'

const stage = ref(null)
const target = ref(null)
const scale = ref(1)
const dir = ref(1)
let pz = null
let swipe = null

const item = computed(() => (ui.viewer ? ui.viewer.items[ui.viewer.index] : null))
const count = computed(() => ui.viewer?.items.length || 0)

function close() {
  ui.viewer = null
}
function go(step) {
  if (!ui.viewer || count.value < 2) return
  dir.value = step
  ui.viewer.index = (ui.viewer.index + step + count.value) % count.value
}

function setup() {
  destroy()
  const el = target.value
  if (!el) return
  pz = Panzoom(el, { maxScale: 10, minScale: 0.6, step: 0.35, panOnlyWhenZoomed: true, cursor: 'grab', animate: true, duration: 220 })
  scale.value = 1
  el.addEventListener('panzoomchange', onChange)
}
function destroy() {
  if (pz) {
    target.value?.removeEventListener('panzoomchange', onChange)
    pz.destroy()
    pz = null
  }
}
function onChange(e) {
  scale.value = e.detail.scale
}
function onWheel(e) {
  if (!pz) return
  e.preventDefault()
  pz.zoomWithWheel(e)
}
const zoomIn = () => pz?.zoomIn()
const zoomOut = () => pz?.zoomOut()
const reset = () => pz?.reset()
function onDbl(e) {
  if (!pz) return
  if (pz.getScale() > 1.05) pz.reset()
  else pz.zoomToPoint(2.6, { clientX: e.clientX, clientY: e.clientY })
}

// свайп между схемами, когда картинка не увеличена
function onPointerDown(e) {
  if (scale.value > 1.02 || count.value < 2) return
  swipe = { x: e.clientX, y: e.clientY, t: Date.now() }
}
function onPointerUp(e) {
  if (!swipe) return
  const dx = e.clientX - swipe.x
  const dy = e.clientY - swipe.y
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - swipe.t < 600) go(dx < 0 ? 1 : -1)
  swipe = null
}

function onKey(e) {
  if (!ui.viewer) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === '+' || e.key === '=') zoomIn()
  else if (e.key === '-') zoomOut()
  else if (e.key === '0') reset()
}

// открытие/закрытие; смену схемы обрабатывают хуки внутреннего Transition
watch(
  () => !!ui.viewer,
  async () => {
    if (!ui.viewer) {
      destroy()
      window.removeEventListener('keydown', onKey)
      return
    }
    window.addEventListener('keydown', onKey)
    await nextTick()
    setup()
  },
)
onBeforeUnmount(() => {
  destroy()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Transition name="viewer">
    <div v-if="ui.viewer && item" class="viewer" role="dialog" aria-modal="true" :aria-label="item.caption">
      <div class="viewer-top">
        <div class="viewer-caption">
          <span v-if="count > 1" class="viewer-count">{{ ui.viewer.index + 1 }} / {{ count }}</span>
          {{ item.caption }}
        </div>
        <button class="v-btn" type="button" aria-label="Закрыть" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div
        ref="stage"
        class="viewer-stage"
        @wheel="onWheel"
        @dblclick="onDbl"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @click.self="close"
      >
        <Transition :name="dir > 0 ? 'slide-next' : 'slide-prev'" mode="out-in" @before-leave="destroy" @after-enter="setup">
          <div :key="ui.viewer.index" class="viewer-item">
            <div ref="target" class="viewer-target">
              <img v-if="item.type === 'img'" :src="item.src" :alt="item.caption" draggable="false" />
              <div v-else class="viewer-svg" v-html="item.html" />
            </div>
          </div>
        </Transition>
      </div>

      <button v-if="count > 1" class="v-nav prev" type="button" aria-label="Предыдущая схема" @click="go(-1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6" /></svg>
      </button>
      <button v-if="count > 1" class="v-nav next" type="button" aria-label="Следующая схема" @click="go(1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
      </button>

      <div class="viewer-tools">
        <button class="v-btn" type="button" aria-label="Уменьшить" @click="zoomOut">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 12h12" /></svg>
        </button>
        <button class="v-scale" type="button" title="Сбросить масштаб" @click="reset">{{ Math.round(scale * 100) }}%</button>
        <button class="v-btn" type="button" aria-label="Увеличить" @click="zoomIn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 12h12M12 6v12" /></svg>
        </button>
      </div>
      <div class="viewer-hint">Колесо мыши или два пальца: масштаб · Двойной клик: приблизить · Перетаскивание: сдвиг</div>
    </div>
  </Transition>
</template>
