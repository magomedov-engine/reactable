<script setup>
// Прохождение вопросов по одному: варианты перемешаны, после ответа — подсветка и пояснение.
// Общий для теста урока (LessonQuiz) и итогового экзамена (ExamView).
// Вопрос: { q, options: [{ html, correct }], explain, lessonId? }. По окончании — событие finish(answers).
import { reactive, computed, ref, onMounted } from 'vue'

const props = defineProps({
  questions: { type: Array, required: true }, // уже в нужном порядке
  label: { type: String, default: 'Вопрос' },
})
const emit = defineEmits(['finish', 'quit'])

const root = ref(null)
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const opts = props.questions.map((q) => shuffle(q.options))
const s = reactive({ i: 0, picked: -1, answers: [] })
const total = props.questions.length
const cur = computed(() => props.questions[s.i])
const curOpts = computed(() => opts[s.i])
const score = computed(() => s.answers.filter((a) => a.ok).length)

onMounted(() => {
  root.value?.focus({ preventScroll: true })
  root.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})

function pick(k) {
  if (s.picked >= 0 || !curOpts.value[k]) return
  s.picked = k
  const q = cur.value
  s.answers.push({
    q: q.q,
    lessonId: q.lessonId,
    key: q.key,
    ok: curOpts.value[k].correct,
    chosen: curOpts.value[k].html,
    right: curOpts.value.find((o) => o.correct).html,
    explain: q.explain,
  })
}

function next() {
  if (s.picked < 0) return
  if (s.i + 1 < total) {
    s.i++
    s.picked = -1
    root.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  } else emit('finish', s.answers)
}

function onKey(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return
  const n = Number(e.key)
  if (n >= 1 && n <= curOpts.value.length) {
    e.preventDefault()
    pick(n - 1)
  } else if (e.key === 'Enter' && s.picked >= 0) {
    e.preventDefault()
    next()
  }
}

function optClass(k, o) {
  if (s.picked < 0) return ''
  if (o.correct) return 'right'
  return k === s.picked ? 'wrong' : 'dim'
}
</script>

<template>
  <div ref="root" class="quiz-run" tabindex="-1" @keydown="onKey">
    <div class="quiz-head">
      <span class="quiz-kicker">{{ label }} {{ s.i + 1 }} из {{ total }}</span>
      <span class="quiz-tally">верно {{ score }}</span>
      <button type="button" class="link-btn quiz-quit" @click="emit('quit')">Прервать</button>
    </div>
    <div class="quiz-bar" aria-hidden="true"><div :style="{ width: ((s.i + (s.picked >= 0 ? 1 : 0)) / total) * 100 + '%' }" /></div>
    <slot name="above" :question="cur" />
    <h3 class="quiz-q" v-html="cur.q" />
    <div class="quiz-opts" role="group" aria-label="Варианты ответа">
      <button
        v-for="(o, k) in curOpts"
        :key="s.i + '-' + k"
        type="button"
        class="quiz-opt"
        :class="optClass(k, o)"
        :disabled="s.picked >= 0"
        @click="pick(k)"
      >
        <span class="opt-key">{{ k + 1 }}</span>
        <span class="opt-text" v-html="o.html" />
        <svg v-if="s.picked >= 0 && o.correct" class="opt-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10" /></svg>
        <svg v-else-if="k === s.picked" class="opt-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
    <div v-if="s.picked >= 0" class="quiz-feedback" :class="curOpts[s.picked].correct ? 'ok' : 'bad'" aria-live="polite">
      <strong>{{ curOpts[s.picked].correct ? 'Верно' : 'Неверно' }}</strong>
      <div v-if="cur.explain" class="quiz-explain" v-html="cur.explain" />
      <slot name="feedback" :question="cur" />
      <button type="button" class="btn btn-primary quiz-next" @click="next">
        {{ s.i + 1 < total ? 'Дальше' : 'Показать результат' }}
      </button>
    </div>
    <p v-else class="quiz-hint">Клавиши 1–{{ curOpts.length }} — выбрать ответ, Enter — дальше.</p>
  </div>
</template>

<style scoped>
.quiz-run { outline: none; }
.quiz-tally { margin-left: auto; font-family: var(--font-mono); font-size: 12px; color: var(--text-3); }
.quiz-quit { font-size: 13px; color: var(--text-3); }
.quiz-bar { height: 3px; margin: 10px 0 0; background: var(--surface-3); border-radius: 2px; overflow: hidden; }
.quiz-bar > div { height: 100%; background: var(--c-question); transition: width 0.3s var(--ease); }
.quiz-q { margin: 16px 0 12px; font-family: var(--font); font-size: 1.08em; font-weight: 600; line-height: 1.45; letter-spacing: 0; text-transform: none; }

.quiz-opts { display: grid; gap: 8px; }
.quiz-opt {
  display: flex; align-items: flex-start; gap: 12px; width: 100%;
  padding: 11px 14px; text-align: left; line-height: 1.45;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  transition: border-color 0.2s var(--ease), background 0.2s var(--ease), opacity 0.2s var(--ease);
}
.quiz-opt:not(:disabled):hover { border-color: var(--border-strong); background: var(--surface-2); }
.quiz-opt:disabled { cursor: default; }
.opt-key {
  flex: none; display: inline-grid; place-items: center; width: 22px; height: 22px; margin-top: 1px;
  font-family: var(--font-mono); font-size: 12px; color: var(--text-3);
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
}
.opt-text { flex: 1; }
.opt-mark { flex: none; width: 20px; height: 20px; margin-top: 1px; }
.quiz-opt.right { border-color: color-mix(in srgb, var(--ok) 60%, transparent); background: var(--ok-soft); }
.quiz-opt.right .opt-mark, .quiz-opt.right .opt-key { color: var(--ok); border-color: currentColor; }
.quiz-opt.wrong { border-color: color-mix(in srgb, var(--c-danger) 60%, transparent); background: var(--c-danger-bg); }
.quiz-opt.wrong .opt-mark, .quiz-opt.wrong .opt-key { color: var(--c-danger); border-color: currentColor; }
.quiz-opt.dim { opacity: 0.55; }

.quiz-feedback { margin-top: 14px; padding: 12px 14px; border-radius: var(--radius); background: var(--surface); border-left: 3px solid var(--ok); animation: reveal 0.3s var(--ease); }
.quiz-feedback.bad { border-left-color: var(--c-danger); }
.quiz-feedback > strong { display: block; color: var(--ok); }
.quiz-feedback.bad > strong { color: var(--c-danger); }
.quiz-explain { margin-top: 4px; color: var(--text-2); }
.quiz-explain :deep(p) { margin: 0.3em 0 0; }
.quiz-next { display: flex; margin-top: 12px; padding-top: 9px; padding-bottom: 9px; }
.quiz-hint { margin: 12px 0 0; font-size: 13px; color: var(--text-3); }
</style>
