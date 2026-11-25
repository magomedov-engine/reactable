// Наборы деталей для раздела «Что показывать»: изучаем работу одного узла без лишнего.
// parts — что остаётся видимым (всё остальное скрыто), null — весь двигатель.
// solo — сразу показать только один цилиндр (на общих деталях вроде вала это не влияет).
// flows — бегущие потоки систем, которые включаются вместе с набором.
const PISTON = ['piston', 'rings', 'pin', 'rod', 'rodcap', 'rodbearing']
const CRANK = ['crank', 'bearing', 'maincap', 'thrust', 'flywheel', 'damper']
const VALVES = ['camshaft', 'tappet', 'pushrod', 'rocker', 'adjscrew', 'valve_in', 'valve_ex', 'spring', 'gear', 'gearmark']

export const SHOW_PRESETS = [
  { id: 'all', t: 'Весь двигатель', parts: null, solo: null },
  {
    id: 'piston', t: 'Поршень и шатун', parts: [...PISTON, 'crank', 'liner'], solo: 1,
    note: 'Поршень с кольцами, палец, шатун с крышкой и вкладышем на шейке вала. Гильза полупрозрачная: видно, как поршень ходит внутри неё.',
  },
  {
    id: 'crank', t: 'Поршни и коленвал', parts: [...PISTON, ...CRANK], solo: null,
    note: 'Кривошипно-шатунный механизм: 12 поршней через шатуны крутят один вал. На каждой шатунной шейке сидят два шатуна — по одному из каждого ряда.',
  },
  {
    id: 'valves', t: 'Распредвал и клапаны', parts: [...VALVES, 'crank'], solo: null,
    note: 'Газораспределение: шестерни от коленвала крутят распредвал вдвое медленнее, кулачок поднимает толкатель и штангу, коромысло нажимает на клапан, пружина закрывает его обратно.',
  },
  {
    id: 'linked', t: 'Поршень + распредвал + коленвал', parts: [...PISTON, ...CRANK, ...VALVES, 'liner', 'port_in', 'port_ex'], solo: 1,
    note: 'Один цилиндр целиком: смотрите, как поршень идёт вниз на впуске — и в это время кулачок держит открытым впускной клапан, а на сжатии оба клапана закрыты.',
  },
  {
    id: 'air', t: 'Путь воздуха и газов',
    parts: ['airfilter', 'compressor', 'intercooler', 'manifold_in', 'port_in', 'valve_in', 'piston', 'rings', 'liner', 'valve_ex', 'port_ex', 'manifold_ex', 'turbine', 'exhaustpipe'],
    solo: null, flows: ['air', 'exhaust'],
    note: 'Воздух: фильтр → компрессор → охладитель → коллектор → патрубок → канал головки → впускной клапан. Газы: выпускной клапан → канал головки → коллектор → турбина → выпускная труба.',
  },
  {
    id: 'fuel', t: 'Топливо', parts: ['fuelfilter', 'pump', 'hpline', 'injector', 'piston', 'liner'], solo: null, flows: ['fuel'],
    note: 'Фильтр → ТНВД → трубки высокого давления → форсунки. Каждая трубка ведёт к своему цилиндру.',
  },
  {
    id: 'oil', t: 'Смазка', parts: ['oil', 'oilpickup', 'oilpump', 'oilfilter', 'oilgallery', 'bearing', 'rodbearing', 'crank', 'maincap'], solo: null, flows: ['oil'],
    note: 'Маслоприёмник → насос → фильтр → главная магистраль → коренные вкладыши → по каналам вала к шатунным вкладышам → стекает в поддон.',
  },
]
