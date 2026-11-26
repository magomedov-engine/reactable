import MiniSearch from 'minisearch'
import { lessons, lessonSource, glossary, guides, guideSource } from './content.js'
import { plainText } from './markdown.js'

let index = null
const docs = new Map()

const norm = (s) => s.toLowerCase().replace(/ё/g, 'е')

function build() {
  index = new MiniSearch({
    fields: ['title', 'heading', 'text'],
    storeFields: ['kind', 'lessonId', 'guideId', 'title', 'heading', 'sec', 'slug'],
    processTerm: (t) => (t.length < 2 ? null : norm(t)),
    searchOptions: { boost: { title: 3, heading: 2 }, prefix: true, fuzzy: 0.2, combineWith: 'AND' },
  })
  const all = []
  for (const l of lessons) {
    const parts = lessonSource(l.id).split(/^##\s+/m)
    parts.forEach((p, n) => {
      const nl = p.indexOf('\n')
      const heading = n === 0 ? '' : p.slice(0, nl).replace(/^[^\p{L}\p{N}]+/u, '').trim()
      const body = n === 0 ? p : p.slice(nl + 1)
      const doc = { id: `${l.id}#${n}`, kind: 'lesson', lessonId: l.id, title: l.title, heading, sec: n, text: plainText(body) }
      all.push(doc)
      docs.set(doc.id, doc)
    })
  }
  for (const g of guides) {
    guideSource(g.id).split(/^##\s+/m).forEach((p, n) => {
      const nl = p.indexOf('\n')
      const heading = n === 0 ? '' : p.slice(0, nl).replace(/^[^\p{L}\p{N}]+/u, '').trim()
      const doc = { id: `guide:${g.id}#${n}`, kind: 'guide', guideId: g.id, title: g.title, heading, sec: n, text: plainText(n === 0 ? p : p.slice(nl + 1)) }
      all.push(doc)
      docs.set(doc.id, doc)
    })
  }
  for (const g of glossary) {
    const doc = { id: `g:${g.slug}`, kind: 'term', slug: g.slug, title: g.term, heading: 'Глоссарий', text: plainText(g.body) }
    all.push(doc)
    docs.set(doc.id, doc)
  }
  index.addAll(all)
}

// Отрывок текста вокруг первого совпадения
function snippet(text, terms) {
  const low = norm(text)
  let at = -1
  for (const t of terms) {
    at = low.indexOf(t)
    if (at >= 0) break
  }
  if (at < 0) return text.slice(0, 140) + (text.length > 140 ? '…' : '')
  const start = Math.max(0, at - 50)
  const s = (start > 0 ? '…' : '') + text.slice(start, start + 160) + (start + 160 < text.length ? '…' : '')
  return s
}

export function search(q) {
  if (!index) build()
  q = q.trim()
  if (q.length < 2) return []
  let res = index.search(q)
  if (!res.length) res = index.search(q, { combineWith: 'OR' })
  return res.slice(0, 30).map((r) => {
    const d = docs.get(r.id)
    return { ...r, snippet: snippet(d.text, r.terms) }
  })
}

// Подсветка найденных слов (на входе — уже безопасный текст)
export function highlight(text, terms) {
  const escd = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (!terms?.length) return escd
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'giu')
  return escd.replace(re, '<mark>$1</mark>')
}
