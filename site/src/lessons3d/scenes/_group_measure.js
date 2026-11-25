// Сцены для уроков «Чтение чертежей» (basics-03) и «Измерительный инструмент» (basics-05)
export default [
  { id: 'three-views', title: 'Три вида детали', replaces: 'три_вида_чертежа.svg', load: () => import('./three-views.js') },
  { id: 'section-drawing', title: 'Разрез и сборочный чертёж', replaces: 'разрез_и_сборочный_чертёж.svg', load: () => import('./section-drawing.js') },
  { id: 'shaft-drawing', title: 'Чертёж вала: что написано', replaces: 'чертёж_вала_пример.svg', load: () => import('./shaft-drawing.js') },
  { id: 'caliper', title: 'Штангенциркуль', replaces: 'штангенциркуль.svg', load: () => import('./caliper.js') },
  { id: 'micrometer', title: 'Микрометр', replaces: 'микрометр.svg', load: () => import('./micrometer.js') },
  { id: 'indicator-gauges', title: 'Индикатор, нутромер и щуп', replaces: 'индикатор_нутромер_щуп.svg', load: () => import('./indicator-gauges.js') },
]
