// Сцены для уроков о крепеже, резьбе, моменте затяжки и общеслесарных работах
export default [
  { id: 'bolt', title: 'Болт, шайба и гайка', replaces: 'болт_строение.svg', load: () => import('./bolt.js') },
  { id: 'locking', title: 'Стопорение крепежа', replaces: 'стопорение.svg', load: () => import('./locking.js') },
  { id: 'torque-wrench', title: 'Динамометрический ключ и доворот на угол', replaces: 'динамометрический_ключ.svg', load: () => import('./torque-wrench.js') },
  { id: 'tightening-order', title: 'Порядок затяжки', replaces: 'порядок_затяжки.svg', load: () => import('./tightening-order.js') },
  { id: 'tapping', title: 'Нарезание резьбы', replaces: 'нарезание_резьбы.svg', load: () => import('./tapping.js') },
  { id: 'drilling', title: 'Сверление и зенковка', replaces: 'сверление.svg', load: () => import('./drilling.js') },
]
