// Реестр 3D-сцен для уроков.
// Сцены описаны группами в файлах scenes/_group_*.js (каждая группа — свой файл, чтобы не мешать друг другу):
//   export default [
//     { id: 'crank-train', title: 'Кривошипно-шатунный механизм',
//       replaces: 'кшм_движение.svg',                 // заменить эту схему в уроке на 3D (схема останется во вкладке «Схема»)
//       inserts: [{ lesson: 'engine-03', heading: 'Шатун' }], // ещё вставить блок в урок после заголовка (по подстроке)
//       load: () => import('./crank-train.js') },
//   ]
const groups = import.meta.glob('./scenes/_group_*.js', { eager: true, import: 'default' })

export const SCENES = {}
for (const list of Object.values(groups)) for (const s of list || []) SCENES[s.id] = s

// имя файла схемы → id сцены
export const REPLACE = {}
for (const s of Object.values(SCENES)) if (s.replaces) for (const f of [].concat(s.replaces)) REPLACE[f] = s.id

// урок → [{ heading, scene }]
export const INSERTS = {}
for (const s of Object.values(SCENES))
  for (const ins of s.inserts || []) (INSERTS[ins.lesson] ||= []).push({ heading: ins.heading, scene: s.id })

export const sceneById = (id) => SCENES[id] || null
