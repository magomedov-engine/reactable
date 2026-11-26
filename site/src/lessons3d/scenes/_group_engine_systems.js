// Сцены для уроков о системах двигателя: топливо, ГРМ (тепловой зазор), смазка, охлаждение, наддув
export default [
  { id: 'injector', title: 'Форсунка в разрезе', replaces: 'форсунка_разрез.svg', load: () => import('./injector.js') },
  { id: 'thermostat', title: 'Термостат: малый и большой круг', replaces: 'термостат_круги.svg', load: () => import('./thermostat.js') },
  { id: 'turbo', title: 'Турбокомпрессор в разрезе (справка: есть у ЯМЗ-240НМ2, у 240М2 нет)', replaces: 'турбокомпрессор.svg', load: () => import('./turbo.js') },
  { id: 'valve-clearance', title: 'Регулировка теплового зазора', inserts: [{ lesson: 'engine-04', heading: 'Тепловой зазор клапанов' }], load: () => import('./valve-clearance.js') },
  { id: 'oil-pump', title: 'Шестерёнчатый масляный насос', inserts: [{ lesson: 'engine-06', heading: 'Масло: смазка и давление' }], load: () => import('./oil-pump.js') },
]
