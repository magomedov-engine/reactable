// Сцены для уроков «Двигатель»: блок и гильзы (engine-02), КШМ (engine-03)
export default [
  { id: 'liner-block', title: 'Блок цилиндров и мокрая гильза', replaces: 'блок_гильза_разрез.svg', load: () => import('./liner-block.js') },
  { id: 'liner-protrusion', title: 'Выступание гильзы', replaces: 'выступание_гильзы.svg', load: () => import('./liner-protrusion.js') },
  { id: 'crank-journals', title: 'Коленчатый вал: шейки и каналы', replaces: 'коленвал_шейки.svg', load: () => import('./crank-journals.js') },
  { id: 'bearing-shell', title: 'Вкладыш: установка', replaces: 'вкладыш_установка.svg', load: () => import('./bearing-shell.js') },
  { id: 'piston-rings', title: 'Поршень и кольца', replaces: 'поршень_и_кольца.svg', load: () => import('./piston-rings.js') },
]
