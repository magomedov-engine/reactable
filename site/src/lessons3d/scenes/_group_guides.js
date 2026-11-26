// Сцены раздела «Разбор узлов» (vault/05_Разбор_узлов): ставятся в текст блоком ```3d <id>```
const g = (id) => () => import('./guide-scenes.js').then((m) => ({ default: m.SCENES[id] }))

export default [
  { id: 'g-kshm-where', title: 'КШМ: где стоит и как работает', load: g('g-kshm-where') },
  { id: 'g-kshm-assembly', title: 'КШМ: сборка по шагам', load: g('g-kshm-assembly') },
  { id: 'g-grm-where', title: 'ГРМ: где стоит и как работает', load: g('g-grm-where') },
  { id: 'g-grm-assembly', title: 'ГРМ: сборка по шагам', load: g('g-grm-assembly') },
  { id: 'g-sys-lube', title: 'Смазка: путь масла и сборка', load: g('g-sys-lube') },
  { id: 'g-sys-cool', title: 'Охлаждение: путь жидкости и сборка', load: g('g-sys-cool') },
  { id: 'g-sys-fuel', title: 'Топливо: путь и сборка', load: g('g-sys-fuel') },
  { id: 'g-sys-air', title: 'Воздух и выпуск: путь и сборка', load: g('g-sys-air') },
  { id: 'valve-assembly', title: 'Сборка клапана: пружина и сухари', load: () => import('./valve-assembly.js') },
]
