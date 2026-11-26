<script setup>
// Карточки с интервальным повторением: по 5–10 минут в день.
// Расписание — lib/cards.js, состояние хранится в браузере (store.js).
import { reactive, computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { cards, decks, todayQueue, deckStats, gradeCard, nextInterval, intervalLabel, NEW_PER_DAY, GLOSSARY_DECK } from '../lib/cards.js'
import { plural } from '../lib/quizbank.js'

const s = reactive({ deck: '', mode: 'intro', queue: [], i: 0, shown: false, done: 0, again: 0, total: 0 })
const stats = computed(() => deckStats(s.deck))
const allStats = computed(() => deckStats(''))
const cur = computed(() => s.queue[s.i])
const card = ref(null)
const GRADES = [
  { g: 0, t: 'Не помню', cls: 'bad' },
  { g: 1, t: 'Трудно', cls: 'mid' },
  { g: 2, t: 'Помню', cls: 'ok' },
]

function start() {
  s.queue = todayQueue(s.deck)
  Object.assign(s, { mode: s.queue.length ? 'run' : 'intro', i: 0, shown: false, done: 0, again: 0, total: s.queue.length })
  nextTick(() => card.value?.focus({ preventScroll: true }))
}
function show() {
  s.shown = true
}
function grade(g) {
  const c = cur.value
  gradeCard(c.id, g)
  if (g === 0) {
    // не вспомнил — покажем ещё раз через несколько карточек
    s.queue.splice(Math.min(s.i + 4, s.queue.length), 0, c)
    s.again++
  } else s.done++
  s.shown = false
  if (s.i + 1 < s.queue.length) s.i++
  else s.mode = 'result'
}
function onKey(e) {
  if (s.mode !== 'run' || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA/.test(e.target.tagName)) return
  if (!s.shown && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault()
    show()
  } else if (s.shown && ['1', '2', '3'].includes(e.key)) {
    e.preventDefault()
    grade(Number(e.key) - 1)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const deckCount = (d) => cards.filter((c) => !d || c.deck === d).length
const left = computed(() => s.queue.length - s.i)
</script>

<template>
  <div class="page cards-page">
    <header class="cards-head">
      <div class="hero-kicker">5–10 минут в день</div>
      <h1 class="cards-title">Карточки</h1>
      <p class="hero-sub">
        Термины, числа и правила курса. Сайт сам решает, что пора повторить: то, что помните, возвращается всё реже
        (через 1, 3, 7, 14, 30 дней), а забытое — уже сегодня. Новых карточек — не больше {{ NEW_PER_DAY }} в день.
      </p>
    </header>

    <template v-if="s.mode === 'intro'">
      <div class="deck-chips" role="tablist" aria-label="Колода">
        <button type="button" class="chip" :class="{ on: !s.deck }" @click="s.deck = ''">Все <span>{{ deckCount('') }}</span></button>
        <button v-for="d in decks" :key="d" type="button" class="chip" :class="{ on: s.deck === d }" @click="s.deck = d">
          {{ d }} <span>{{ deckCount(d) }}</span>
        </button>
      </div>

      <div class="stats">
        <div class="stat"><strong>{{ stats.due }}</strong><span>к повторению</span></div>
        <div class="stat"><strong>{{ stats.fresh }}</strong><span>новых сегодня</span></div>
        <div class="stat"><strong>{{ stats.learned }}</strong><span>выучено</span></div>
        <div class="stat progress-stat">
          <strong>{{ stats.total - stats.unseen }}</strong><span>из {{ stats.total }} начато</span>
          <div class="bar"><div class="bar-fill" :style="{ width: (stats.learned / stats.total) * 100 + '%' }" /></div>
        </div>
      </div>

      <div class="quiz-actions">
        <button v-if="stats.due + stats.fresh" type="button" class="btn btn-primary" @click="start">
          Начать: {{ stats.due + stats.fresh }} {{ plural(stats.due + stats.fresh, 'карточка', 'карточки', 'карточек') }}
        </button>
        <p v-else class="cards-empty">
          На сегодня в этой колоде всё. {{ allStats.due + allStats.fresh ? `В других колодах ждут ещё ${allStats.due + allStats.fresh}.` : 'Возвращайтесь завтра.' }}
        </p>
      </div>
    </template>

    <section v-else-if="s.mode === 'run'" class="quiz cards-run">
      <div class="quiz-head">
        <span class="quiz-kicker">{{ cur.deck }}</span>
        <span class="quiz-best">осталось {{ left }}</span>
        <button type="button" class="link-btn quiz-quit" @click="s.mode = 'intro'">Закончить</button>
      </div>
      <div class="quiz-bar" aria-hidden="true"><div :style="{ width: (s.done / Math.max(1, s.total)) * 100 + '%' }" /></div>

      <div ref="card" class="flashcard" tabindex="-1" :class="{ shown: s.shown }">
        <div class="fc-front">{{ cur.front }}</div>
        <template v-if="s.shown">
          <div class="fc-back">{{ cur.back }}</div>
          <RouterLink v-if="cur.term" :to="`/glossary/${cur.term}`" target="_blank" class="fc-link">Открыть в глоссарии →</RouterLink>
        </template>
      </div>

      <div v-if="!s.shown" class="fc-actions">
        <button type="button" class="btn btn-primary fc-show" @click="show">Показать ответ</button>
        <span class="quiz-hint">Пробел — показать ответ</span>
      </div>
      <div v-else class="fc-actions">
        <div class="fc-grades">
          <button v-for="b in GRADES" :key="b.g" type="button" class="fc-grade" :class="b.cls" @click="grade(b.g)">
            <span class="fg-t"><span class="opt-key">{{ b.g + 1 }}</span>{{ b.t }}</span>
            <span class="fg-n">{{ intervalLabel(nextInterval(cur.id, b.g)) }}</span>
          </button>
        </div>
        <span class="quiz-hint">Честная оценка важнее: «Не помню» вернёт карточку ещё сегодня.</span>
      </div>
    </section>

    <section v-else class="quiz">
      <div class="quiz-head"><span class="quiz-kicker">Готово на сегодня</span></div>
      <div class="quiz-score ok">
        <strong>{{ s.done }}</strong>
        <span>{{ plural(s.done, 'карточка', 'карточки', 'карточек') }} повторено{{ s.again ? `, ${s.again} раз пришлось вернуться` : '' }}</span>
      </div>
      <p class="quiz-lead">
        Выучено {{ allStats.learned }} из {{ cards.length }}. Завтра часть карточек вернётся — так они перейдут в долгую память.
        {{ allStats.due + allStats.fresh ? `Сегодня можно повторить ещё ${allStats.due + allStats.fresh}.` : '' }}
      </p>
      <div class="quiz-actions">
        <button v-if="allStats.due + allStats.fresh" type="button" class="btn btn-primary" @click="(s.deck = ''), start()">Ещё карточки</button>
        <button type="button" class="btn btn-ghost" @click="s.mode = 'intro'">К колодам</button>
      </div>
    </section>

    <p class="cards-foot">
      Колоду можно пополнять: строка «вопрос::ответ» в заметке <code>04_Практика/Карточки.md</code>. Термины берутся из глоссария ({{ deckCount(GLOSSARY_DECK) }}).
      История повторений хранится только в этом браузере.
    </p>
  </div>
</template>

<style scoped>
.cards-page { max-width: 820px; }
.cards-title { margin: 6px 0 0; font-family: var(--font-head); font-weight: 600; font-size: clamp(30px, 5vw, 44px); line-height: 1.05; text-transform: uppercase; letter-spacing: 0.01em; }
.cards-head .hero-sub { margin-top: 12px; }
.deck-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0 16px; }
.chip {
  padding: 7px 12px; font-size: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  transition: border-color 0.2s var(--ease), background 0.2s var(--ease);
}
.chip:hover { border-color: var(--text-3); }
.chip span { margin-left: 4px; font-family: var(--font-mono); font-size: 12px; color: var(--text-3); }
.chip.on { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.chip.on span { color: var(--accent-ink); opacity: 0.7; }
.cards-empty { margin: 0; color: var(--text-2); }

.cards-run .quiz-best { margin-left: auto; }
.quiz-quit { font-size: 13px; color: var(--text-3); }
.quiz-bar { height: 3px; margin: 10px 0 0; background: var(--surface-3); border-radius: 2px; overflow: hidden; }
.quiz-bar > div { height: 100%; background: var(--c-question); transition: width 0.3s var(--ease); }

.flashcard {
  display: grid; align-content: center; gap: 14px; min-height: 200px; margin-top: 16px; padding: 28px 24px;
  text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); outline: none;
}
.fc-front { font-size: 1.25em; font-weight: 600; line-height: 1.4; }
.fc-back { padding-top: 14px; border-top: 1px dashed var(--border-strong); font-size: 1.08em; line-height: 1.5; color: var(--text); animation: reveal 0.3s var(--ease); }
.fc-link { justify-self: center; font-size: 13px; color: var(--text-3); border-bottom: 1px dashed var(--border-strong); }
.fc-link:hover { color: var(--text); }

.fc-actions { display: grid; justify-items: center; gap: 10px; margin-top: 14px; }
.fc-show { min-width: 220px; align-items: center; }
.quiz-hint { font-size: 13px; color: var(--text-3); text-align: center; }
.fc-grades { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; }
.fc-grade {
  display: grid; gap: 2px; justify-items: center; padding: 10px 8px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  transition: border-color 0.2s var(--ease), background 0.2s var(--ease);
}
.fg-t { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
.fg-n { font-family: var(--font-mono); font-size: 11.5px; color: var(--text-3); }
.opt-key {
  display: inline-grid; place-items: center; width: 20px; height: 20px;
  font-family: var(--font-mono); font-size: 11px; color: var(--text-3);
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
}
.fc-grade.bad:hover { border-color: var(--c-danger); background: var(--c-danger-bg); }
.fc-grade.mid:hover { border-color: var(--c-warning); background: var(--c-warning-bg); }
.fc-grade.ok:hover { border-color: var(--ok); background: var(--ok-soft); }
.fc-grade.bad .fg-t { color: var(--c-danger); }
.fc-grade.mid .fg-t { color: var(--c-warning); }
.fc-grade.ok .fg-t { color: var(--ok); }

.cards-foot { margin-top: 28px; font-size: 13px; color: var(--text-3); }
.cards-foot code { font-family: var(--font-mono); font-size: 12px; }
@media (max-width: 600px) {
  .flashcard { min-height: 170px; padding: 22px 16px; }
  .fc-grades { gap: 6px; }
  .fg-t { font-size: 14px; gap: 6px; }
}
</style>
