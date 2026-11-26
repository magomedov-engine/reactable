<script setup>
// Поле ответа тренажёра: ввод числа, «Проверить» (Enter), разбор, «Следующее» (Enter).
import { ref, watch, nextTick, onMounted } from 'vue'

const props = defineProps({
  s: { type: Object, required: true }, // состояние из useTask
  unit: { type: String, default: 'мм' },
  label: { type: String, default: 'Показание' },
  answer: { type: String, default: '' }, // правильный ответ текстом — показывается после проверки
})
const emit = defineEmits(['check', 'next'])
const input = ref(null)
const nextBtn = ref(null)

function submit() {
  if (props.s.state === 'ask') emit('check')
  else emit('next')
}
watch(
  () => props.s.state,
  async (st) => {
    await nextTick()
    if (st === 'ask') input.value?.focus({ preventScroll: true })
    else nextBtn.value?.focus({ preventScroll: true })
  },
)
onMounted(() => input.value?.focus({ preventScroll: true }))
</script>

<template>
  <form class="tr-answer" @submit.prevent="submit">
    <label class="tr-field">
      <span>{{ label }}</span>
      <input
        ref="input"
        v-model="s.input"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        :disabled="s.state !== 'ask'"
        :class="{ ok: s.state === 'ok', bad: s.state === 'bad' }"
        placeholder="0,00"
      />
      <span class="tr-unit">{{ unit }}</span>
    </label>
    <button v-if="s.state === 'ask'" type="submit" class="btn btn-primary">Проверить</button>
    <button v-else ref="nextBtn" type="submit" class="btn btn-primary">Следующее</button>
  </form>
  <p v-if="s.error" class="tr-error">{{ s.error }}</p>
  <div v-if="s.state !== 'ask'" class="tr-feedback" :class="s.state" aria-live="polite">
    <strong>{{ s.state === 'ok' ? 'Верно' : `Неверно. Правильно: ${answer} ${unit}` }}</strong>
    <div class="tr-explain"><slot /></div>
  </div>
</template>

<style scoped>
.tr-answer { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin-top: 16px; }
.tr-field { display: grid; grid-template-columns: auto auto; gap: 4px 8px; align-items: center; }
.tr-field > span:first-child { grid-column: 1 / -1; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); }
.tr-field input {
  width: 150px; padding: 10px 12px; font-family: var(--font-mono); font-size: 18px; color: var(--text);
  background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius);
}
.tr-field input:focus { outline: none; border-color: var(--accent); }
.tr-field input.ok { border-color: var(--ok); color: var(--ok); }
.tr-field input.bad { border-color: var(--c-danger); color: var(--c-danger); }
.tr-unit { font-family: var(--font-mono); color: var(--text-2); }
.tr-answer .btn { padding-top: 11px; padding-bottom: 11px; align-items: center; }
.tr-error { margin: 8px 0 0; font-size: 13px; color: var(--c-warning); }
.tr-feedback { margin-top: 14px; padding: 12px 14px; border-radius: var(--radius); background: var(--surface); border-left: 3px solid var(--ok); animation: reveal 0.3s var(--ease); }
.tr-feedback.bad { border-left-color: var(--c-danger); }
.tr-feedback > strong { display: block; color: var(--ok); }
.tr-feedback.bad > strong { color: var(--c-danger); }
.tr-explain { margin-top: 4px; color: var(--text-2); line-height: 1.55; }
.tr-explain :deep(b) { color: var(--text); }
</style>
