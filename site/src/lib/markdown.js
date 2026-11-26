import MarkdownIt from 'markdown-it'
import { resolveWikilink, scheme } from './content.js'
import { REPLACE, INSERTS } from '../lessons3d/registry.js'

// --- иконки врезок (простые линейные, 24×24)
const ICONS = {
  abstract: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  tip: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  warning: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  danger: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M12 8v5M12 16v.5"/>',
  example: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 15h9"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17v.5"/>',
}
const ALIAS = { note: 'info', important: 'warning', caution: 'warning', error: 'danger', bug: 'danger', faq: 'question', help: 'question', success: 'tip', check: 'tip', summary: 'abstract', tldr: 'abstract' }
const TITLES = { abstract: 'Кратко', info: 'Важно', tip: 'Совет', warning: 'Внимание', danger: 'Опасно', example: 'Пример', question: 'Вопрос' }
export const icon = (name, cls = 'ico') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------- вики-ссылки и вставки ![[...]]
function wikilinkPlugin(md) {
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const src = state.src
    let pos = state.pos
    const embed = src.charCodeAt(pos) === 0x21 /* ! */
    if (embed) pos++
    if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) return false
    const end = src.indexOf(']]', pos + 2)
    if (end < 0) return false
    if (!silent) {
      const inner = src.slice(pos + 2, end)
      const [target, alias] = inner.split(/\\?\|/)
      const tok = state.push(embed ? 'wiki_embed' : 'wikilink', '', 0)
      tok.meta = { target: target.trim(), alias: (alias || '').trim() }
    }
    state.pos = end + 2
    return true
  })

  md.renderer.rules.wikilink = (tokens, i) => {
    const { target, alias } = tokens[i].meta
    const r = resolveWikilink(target)
    const label = esc(alias || r?.term?.term || r?.lesson?.title || target.split('/').pop().replace(/_/g, ' '))
    if (!r) return `<span class="wl-missing">${label}</span>`
    if (r.type === 'term') return `<a class="gl" href="#/glossary/${r.term.slug}" data-term="${r.term.slug}">${label}</a>`
    if (r.type === 'home') return `<a class="wl" href="#/" data-route="/">${alias ? label : 'План курса'}</a>`
    return `<a class="wl" href="#/lesson/${r.lesson.id}" data-route="/lesson/${r.lesson.id}">${alias ? label : esc(r.lesson.title)}</a>`
  }

  md.renderer.rules.wiki_embed = (tokens, i, _o, env) => figureHtml(tokens[i].meta.target, env)
}

function figureHtml(target, env) {
  const name = target.split('/').pop()
  const s = /\.svg$/i.test(name) ? scheme(name) : null
  if (!s) {
    return `<div class="figure-missing">${icon('example')}<span>Здесь будет ваше фото: <code>${esc(name)}</code></span></div>`
  }
  // схема, для которой есть 3D-сцена: показываем 3D-блок (схема остаётся во вкладке «Схема»)
  if (REPLACE[name]) return l3dHtml(REPLACE[name], s.url, s.caption)
  env.figures = env.figures || []
  const idx = env.figures.length
  env.figures.push({ type: 'img', src: s.url, caption: s.caption })
  return `<figure class="scheme" data-fig="${idx}">
<button class="scheme-btn" type="button" data-fig="${idx}" aria-label="Открыть схему «${esc(s.caption)}» на весь экран">
<img src="${s.url}" alt="${esc(s.caption)}" loading="lazy" decoding="async" />
<span class="scheme-zoom">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/></svg>'}<span>Увеличить</span></span>
</button>
<figcaption>${esc(s.caption)}</figcaption>
</figure>`
}

// место для 3D-блока: компонент монтирует LessonView
function l3dHtml(id, poster = '', caption = '') {
  return `<div class="l3d-mount" data-scene="${esc(id)}" data-poster="${esc(poster)}" data-caption="${esc(caption)}"></div>
`
}

// дополнительные 3D-блоки по урокам: после первого абзаца раздела, заголовок которого содержит подстроку
function insertsPlugin(md) {
  md.core.ruler.push('l3d_inserts', (state) => {
    const list = INSERTS[state.env?.lesson]
    if (!list?.length) return
    const t = state.tokens
    for (const ins of list) {
      const needle = ins.heading.toLowerCase()
      const h = t.findIndex((tok, i) => tok.type === 'heading_open' && t[i + 1]?.content.toLowerCase().includes(needle))
      if (h < 0) continue
      let at = h + 3 // сразу после заголовка
      // если раздел начинается с абзаца — ставим после него, чтобы сначала шёл текст
      if (t[at]?.type === 'paragraph_open' && t[at].level === 0) {
        const close = t.findIndex((tok, i) => i > at && tok.type === 'paragraph_close' && tok.level === 0)
        if (close > 0) at = close + 1
      }
      const tok = new state.Token('html_block', '', 0)
      tok.content = l3dHtml(ins.scene)
      t.splice(at, 0, tok)
    }
  })
}

// Абзац, состоящий только из ![[...]], превращаем в блок (без обёртки <p>)
function blockEmbedPlugin(md) {
  md.core.ruler.after('inline', 'block_embed', (state) => {
    const t = state.tokens
    for (let i = 0; i < t.length - 2; i++) {
      if (t[i].type === 'paragraph_open' && t[i + 1].type === 'inline' && t[i + 2].type === 'paragraph_close') {
        const kids = t[i + 1].children.filter((c) => !(c.type === 'text' && !c.content.trim()) && c.type !== 'softbreak')
        if (kids.length && kids.every((c) => c.type === 'wiki_embed')) {
          t[i].hidden = true
          t[i + 2].hidden = true
          t[i + 1].children = kids
        }
      }
    }
  })
}

// ---------- врезки Obsidian: > [!type]± Заголовок
function calloutPlugin(md) {
  md.core.ruler.before('inline', 'callouts', (state) => {
    const t = state.tokens
    const stack = []
    for (let i = 0; i < t.length; i++) {
      if (t[i].type === 'blockquote_open') {
        let meta = null
        if (t[i + 1]?.type === 'paragraph_open' && t[i + 2]?.type === 'inline') {
          const inl = t[i + 2]
          const m = inl.content.match(/^\[!(\w+)\]([-+]?)[ \t]*(.*)(?:\n|$)/)
          if (m) {
            let type = m[1].toLowerCase()
            type = ALIAS[type] || type
            if (!ICONS[type]) type = 'info'
            meta = { type, fold: m[2], title: m[3].trim() || TITLES[type] }
            const rest = inl.content.slice(m[0].length)
            if (rest.trim()) inl.content = rest
            else { t.splice(i + 1, 3); }
          }
        }
        t[i].meta = meta
        stack.push(t[i])
      } else if (t[i].type === 'blockquote_close') {
        const open = stack.pop()
        t[i].meta = open?.meta || null
      }
    }
  })

  md.renderer.rules.blockquote_open = (tokens, i) => {
    const m = tokens[i].meta
    if (!m) return '<blockquote>'
    const title = md.renderInline(m.title)
    if (m.fold) {
      return `<details class="callout callout-${m.type}"${m.fold === '+' ? ' open' : ''}><summary class="callout-title">${icon(m.type)}<span>${title}</span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></summary><div class="callout-body">`
    }
    return `<div class="callout callout-${m.type}"><div class="callout-title">${icon(m.type)}<span>${title}</span></div><div class="callout-body">`
  }
  md.renderer.rules.blockquote_close = (tokens, i) => {
    const m = tokens[i].meta
    if (!m) return '</blockquote>'
    return m.fold ? '</div></details>' : '</div></div>'
  }
}

// ---------- заголовки с якорями + оглавление
function headingPlugin(md) {
  md.renderer.rules.heading_open = (tokens, i, _o, env) => {
    const tok = tokens[i]
    const level = Number(tok.tag.slice(1))
    env.toc = env.toc || []
    const id = `sec-${env.toc.length + 1}`
    // строгий стиль: эмодзи в начале заголовка на сайте не показываем (в Obsidian они остаются)
    const first = tokens[i + 1].children.find((c) => c.type === 'text')
    if (first) first.content = first.content.replace(/^[^\p{L}\p{N}«"(]+/u, '')
    const text = tokens[i + 1].children.filter((c) => c.type === 'text' || c.type === 'code_inline').map((c) => c.content).join('')
    if (level === 2 || level === 3) env.toc.push({ id, level, text: text.replace(/^[^\p{L}\p{N}]+/u, '').trim() })
    else env.toc.push({ id, level, text })
    return `<${tok.tag} id="${id}">`
  }
}

// ---------- таблицы с горизонтальной прокруткой, mermaid, бейджи
function miscPlugin(md) {
  md.renderer.rules.table_open = () => '<div class="table-wrap"><table>'
  md.renderer.rules.table_close = () => '</table></div>'

  const defaultFence = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, i, opts, env, self) => {
    const tok = tokens[i]
    if (tok.info.trim() === 'mermaid') {
      return `<div class="mermaid-wrap" data-mermaid="${encodeURIComponent(tok.content)}"><div class="mermaid-skeleton"></div></div>`
    }
    return defaultFence(tokens, i, opts, env, self)
  }

  md.renderer.rules.code_inline = (tokens, i) => {
    const c = tokens[i].content
    if (/^~пример/.test(c)) return `<span class="badge badge-example" title="Число для примера. Точное значение берите из ТК">${esc(c.replace(/^~/, ''))}</span>`
    return `<code>${esc(c)}</code>`
  }

  md.renderer.rules.text = (tokens, i) =>
    esc(tokens[i].content).replace(/#проверить/g, '<span class="badge badge-check" title="Факт нужно сверить с документацией завода">проверить</span>')

  const defaultLink = md.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o))
  md.renderer.rules.link_open = (tokens, i, opts, env, self) => {
    const href = tokens[i].attrGet('href') || ''
    if (/^https?:/.test(href)) {
      tokens[i].attrSet('target', '_blank')
      tokens[i].attrSet('rel', 'noopener')
    }
    return defaultLink(tokens, i, opts, env, self)
  }
}

// ---------- тест: место, куда LessonView монтирует компонент теста
const QUIZ_MARK = '%%quiz%%'
function quizMountPlugin(md) {
  md.core.ruler.after('inline', 'quiz_mount', (state) => {
    const t = state.tokens
    for (let i = 0; i < t.length - 2; i++) {
      if (t[i].type === 'paragraph_open' && t[i + 1].type === 'inline' && t[i + 1].content.trim() === QUIZ_MARK) {
        const tok = new state.Token('html_block', '', 0)
        tok.content = '<div class="quiz-mount"></div>\n'
        t.splice(i, 3, tok)
      }
    }
  })
}

const md = new MarkdownIt({ html: false, linkify: true, typographer: false, breaks: false })
md.use(wikilinkPlugin).use(blockEmbedPlugin).use(calloutPlugin).use(headingPlugin).use(miscPlugin).use(insertsPlugin).use(quizMountPlugin)

// Вопросы самопроверки с вариантами превращаются в тест. Формат в Obsidian:
//   > [!question]- 1. Вопрос
//   > - [x] правильный вариант
//   > - [ ] неверный вариант
//   >
//   > Пояснение
// Вопросы без вариантов остаются обычными раскрывающимися врезками.
const OPTION = /^-\s+\[([ xX])\]\s+(.+)$/
export function extractQuiz(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const start = lines.findIndex((l) => /^##\s.*Самопроверка/i.test(l))
  if (start < 0) return { src, quiz: [] }
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l))
  if (end < 0) end = lines.length
  const quiz = []
  const keep = []
  let placed = false
  for (let i = start + 1; i < end; ) {
    const head = lines[i].match(/^>\s*\[!question\][-+]?\s*(.*)$/i)
    if (!head) {
      keep.push(lines[i++])
      continue
    }
    let j = i + 1
    while (j < end && lines[j].startsWith('>')) j++
    const body = lines.slice(i + 1, j).map((l) => l.replace(/^>\s?/, ''))
    const options = []
    const explain = []
    for (const l of body) {
      const m = l.match(OPTION)
      if (m) options.push({ html: md.renderInline(m[2].trim()), text: m[2].trim(), correct: m[1] !== ' ' })
      else explain.push(l)
    }
    if (options.length >= 2 && options.filter((o) => o.correct).length === 1) {
      const correct = options.find((o) => o.correct).text
      const ex = explain.join('\n').trim()
      // пояснение, которое просто повторяет правильный вариант, не показываем
      const same = ex.replace(/[.\s]+$/, '').toLowerCase() === correct.replace(/[.\s]+$/, '').toLowerCase()
      quiz.push({
        q: md.renderInline(head[1].replace(/^\d+[а-я]?\.\s*/i, '').trim()),
        options,
        explain: ex && !same ? md.render(ex) : '',
      })
      if (!placed) {
        keep.push(QUIZ_MARK)
        placed = true
      }
    } else {
      keep.push(...lines.slice(i, j))
    }
    i = j
  }
  return { src: [...lines.slice(0, start + 1), ...keep, ...lines.slice(end)].join('\n'), quiz }
}

export function renderMarkdown(src, lesson = '') {
  const env = { toc: [], figures: [], lesson }
  const ex = extractQuiz(src)
  const html = md.render(ex.src, env)
  return { html, toc: env.toc.filter((h) => h.level === 2), figures: env.figures, quiz: ex.quiz }
}

// Плоский текст для поиска
export function plainText(src) {
  return src
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[\[[^\]]*\]\]/g, ' ')
    .replace(/\[\[([^\]|]*\/)?([^\]|\\]*)(\\?\|([^\]]*))?\]\]/g, (_, _p, t, _a, alias) => alias || t)
    .replace(/\[!\w+\][-+]?/g, ' ')
    .replace(/^>?\s*-\s+\[[ xX]\]/gm, ' ')
    .replace(/[#>*`|~_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
