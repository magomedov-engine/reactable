<script setup>
// Раздел «Что показывать» на странице 3D-модели: готовые наборы деталей и режим одного цилиндра.
// Отдельные детали скрываются «глазком» в списке деталей.
import { computed } from 'vue'
import { SHOW_PRESETS } from '../model3d/showPresets.js'

const props = defineProps({
  preset: { type: String, default: 'all' },
  solo: { type: Number, default: null },
  hiddenCount: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['preset', 'solo', 'reset'])
const current = computed(() => SHOW_PRESETS.find((p) => p.id === props.preset) || null)
const banks = [
  { t: 'Ряд 1–6', c: [1, 2, 3, 4, 5, 6] },
  { t: 'Ряд 7–12', c: [7, 8, 9, 10, 11, 12] },
]
</script>

<template>
  <section class="mp-block vis">
    <div class="mp-title vis-title">
      <span>Что показывать</span>
      <button v-if="preset !== 'all' || solo || hiddenCount" class="vis-reset" type="button" @click="emit('reset')">Показать всё</button>
    </div>
    <div class="vis-presets">
      <button v-for="p in SHOW_PRESETS" :key="p.id" type="button" class="vis-chip" :class="{ on: preset === p.id }" @click="emit('preset', p)">{{ p.t }}</button>
    </div>
    <p v-if="current?.note" class="mp-note">{{ current.note }}</p>
    <p v-else-if="preset === 'custom'" class="mp-note">Свой набор: скрыто деталей — {{ hiddenCount }}. Глазок у детали в списке ниже прячет её и показывает обратно.</p>

    <div class="vis-sub">Один цилиндр</div>
    <div class="vis-banks">
      <button type="button" class="vis-all" :class="{ on: !solo }" @click="emit('solo', null)">Все 12</button>
      <div v-for="b in banks" :key="b.t" class="vis-bank">
        <small>{{ b.t }}</small>
        <div class="pairs">
          <button v-for="c in b.c" :key="c" type="button" :class="{ on: solo === c }" @click="emit('solo', c)">{{ c }}</button>
        </div>
      </div>
    </div>
    <p v-if="!compact" class="mp-note">
      Остаются детали выбранного цилиндра и общие: коленвал, распредвал, шестерни. Удобно смотреть, как работает один поршень вместе с клапанами.
      <template v-if="!hiddenCount && preset === 'all'"> Отдельные детали прячутся глазком в списке ниже.</template>
    </p>
  </section>
</template>

<style scoped>
.vis-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.vis-reset { border: 0; background: none; padding: 0; font: inherit; font-size: 11.5px; letter-spacing: 0.04em; color: var(--accent-strong, var(--accent)); cursor: pointer; text-transform: uppercase; }
.vis-reset:hover { text-decoration: underline; }
.vis-presets { display: flex; flex-wrap: wrap; gap: 6px; }
.vis-chip { border: 1px solid var(--border); background: var(--surface); border-radius: 2px; padding: 5px 10px; font-size: 12.5px; font-weight: 600; color: var(--text-2); transition: all 0.15s; text-align: left; }
.vis-chip:hover { border-color: var(--accent); color: var(--text); }
.vis-chip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.vis-sub { margin-top: 14px; font-size: 12.5px; font-weight: 650; color: var(--text-2); }
.vis-banks { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 14px; margin-top: 6px; }
.vis-bank small { display: block; font-size: 11px; color: var(--text-3); font-weight: 600; }
.vis-bank .pairs { margin-top: 3px; }
.vis-bank .pairs button { min-width: 30px; padding: 5px 6px; }
.vis-all { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-sm); padding: 5px 9px; font-size: 12.5px; font-weight: 650; color: var(--text-2); transition: all 0.15s; }
.vis-all:hover { border-color: var(--accent); color: var(--text); }
.vis-all.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
</style>
