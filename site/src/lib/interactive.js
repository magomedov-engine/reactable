// Оживление отрендеренного markdown: ссылки, термины, схемы, mermaid
import { ui, openViewer } from './store.js'
import { icon } from './markdown.js'

const ZOOM_BADGE =
  '<span class="scheme-zoom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/></svg><span>Увеличить</span></span>'

// Делегированный обработчик кликов внутри контента
export function contentClick(e, router, figures) {
  const a = e.target.closest('a')
  if (a?.classList.contains('gl')) {
    e.preventDefault()
    const slug = a.dataset.term
    if (ui.term?.slug === slug) ui.term = null
    else ui.term = { slug, rect: a.getBoundingClientRect() }
    return
  }
  if (a?.dataset.route) {
    e.preventDefault()
    ui.term = null
    router.push(a.dataset.route)
    return
  }
  const fig = e.target.closest('.scheme-btn')
  if (fig && figures?.length) {
    openViewer(figures, Number(fig.dataset.fig) || 0)
    return
  }
  const mm = e.target.closest('.mermaid-btn')
  if (mm) {
    const svg = mm.querySelector('svg')
    if (svg) openViewer([{ type: 'svg', html: svg.outerHTML, caption: mm.dataset.caption || 'Схема' }], 0)
  }
}

// ---------- mermaid (грузится лениво, только когда нужен)
let mermaidPromise = null
let seq = 0

// схемы в цветах reactable: графит и молочный
function themeVars() {
  return { background: 'transparent', primaryColor: '#212226', primaryBorderColor: '#5a5a5e', primaryTextColor: '#ece6da', lineColor: '#9a958c', secondaryColor: '#2a2b30', tertiaryColor: '#1a1b1e', edgeLabelBackground: '#1a1b1e', clusterBkg: '#1a1b1e', clusterBorder: '#44454b', fontSize: '15px' }
}

export async function renderMermaid(root, dark) {
  const blocks = [...root.querySelectorAll('.mermaid-wrap')]
  if (!blocks.length) return
  mermaidPromise ||= import('mermaid').then((m) => m.default)
  const mermaid = await mermaidPromise
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: { fontFamily: '"IBM Plex Sans", system-ui, sans-serif', ...themeVars() },
    flowchart: { curve: 'basis', padding: 12, nodeSpacing: 34, rankSpacing: 40 },
  })
  for (const b of blocks) {
    if (!b.isConnected) continue
    let code = decodeURIComponent(b.dataset.mermaid)
    // на телефоне горизонтальные схемы разворачиваем вертикально: так текст крупнее
    if (window.innerWidth < 720) code = code.replace(/^(\s*flowchart\s+)LR/m, '$1TD')
    try {
      const { svg } = await mermaid.render(`mmd-${++seq}`, code)
      if (!b.isConnected) continue
      const horizontal = /^\s*flowchart\s+LR/m.test(code)
      b.innerHTML = `<button class="mermaid-btn${horizontal ? ' lr' : ''}" type="button" data-caption="Схема" aria-label="Открыть схему на весь экран">${svg}${ZOOM_BADGE}</button>`
      b.classList.add('ready')
    } catch (err) {
      b.innerHTML = `<pre class="mermaid-error">${code.replace(/</g, '&lt;')}</pre>`
    }
  }
}

export { icon }
