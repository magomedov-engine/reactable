// Сцены на полной модели двигателя (engine-scenes.js): уроки «Двигатель» и маршрут сборки
const scene = (id) => () => import('./engine-scenes.js').then((m) => ({ default: m.SCENES[id] }))

export default [
  { id: 'v12-overview', title: 'V12 целиком', replaces: 'v12_общий_вид_сбоку.svg', load: scene('v12-overview') },
  { id: 'v12-front', title: 'Вид спереди: развал 60°', replaces: 'v12_вид_спереди.svg', load: scene('v12-front') },
  { id: 'v12-numbering', title: 'Нумерация цилиндров и порядок работы', replaces: 'v12_вид_сверху_нумерация.svg', load: scene('v12-numbering') },
  { id: 'four-stroke', title: 'Четыре такта дизеля', replaces: '4_такта_дизеля.svg', load: scene('four-stroke') },
  { id: 'crank-train', title: 'Кривошипно-шатунный механизм', replaces: 'кшм_движение.svg', load: scene('crank-train') },
  { id: 'timing-marks', title: 'Метки ГРМ', replaces: 'метки_грм.svg', load: scene('timing-marks') },
  { id: 'valve-train', title: 'Клапанный механизм', replaces: 'клапанный_механизм.svg', load: scene('valve-train') },
  { id: 'valve-timing', title: 'Фазы газораспределения', replaces: 'фазы_газораспределения.svg', load: scene('valve-timing') },
  { id: 'fuel-path', title: 'Путь топлива', replaces: 'топливо_путь.svg', load: scene('fuel-path') },
  { id: 'systems', title: 'Контуры: масло, вода, воздух, выпуск', replaces: 'контуры_масло_вода_воздух.svg', load: scene('systems') },
  { id: 'assembly-route', title: 'Маршрут сборки по шагам', inserts: [{ lesson: 'assembly-01', heading: 'Весь маршрут' }], load: scene('assembly-route') },
]
