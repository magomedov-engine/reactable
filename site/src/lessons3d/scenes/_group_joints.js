// Сцены для доп. уроков «Подшипники и соединения» (extra-02) и «Уплотнения» (extra-03)
export default [
  { id: 'rolling-bearing', title: 'Подшипник качения', replaces: 'подшипник_качения.svg', load: () => import('./rolling-bearing.js') },
  { id: 'bearing-mount', title: 'Монтаж подшипника', replaces: 'монтаж_подшипника.svg', load: () => import('./bearing-mount.js') },
  { id: 'keys-splines', title: 'Шпонка, шлицы, штифты, стопорные кольца', replaces: 'шпонка_шлицы_штифты_кольца.svg', load: () => import('./keys-splines.js') },
  { id: 'seal-lip', title: 'Манжета (сальник)', replaces: 'манжета_сальник.svg', load: () => import('./seal-lip.js') },
  { id: 'gaskets-orings', title: 'Прокладки и резиновые кольца', replaces: 'прокладки_и_кольца.svg', load: () => import('./gaskets-orings.js') },
]
