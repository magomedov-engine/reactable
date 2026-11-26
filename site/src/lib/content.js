import manifest from '../content/manifest.json'
import glossaryList from '../content/glossary.json'

const lessonRaw = import.meta.glob('../content/lessons/*.md', { query: '?raw', import: 'default', eager: true })
const schemeFiles = import.meta.glob('../content/schemes/*.svg', { query: '?url', import: 'default', eager: true })

export const lessons = manifest.lessons
export const sections = manifest.sections.map((s) => ({
  ...s,
  lessons: lessons.filter((l) => l.section === s.id),
}))

const byId = new Map(lessons.map((l) => [l.id, l]))
const bySource = new Map(lessons.map((l) => [l.source, l]))

export const getLesson = (id) => byId.get(id)
export const lessonSource = (id) => lessonRaw[`../content/lessons/${id}.md`] || ''

// --- разбор узлов: отдельный раздел подробных разборов (не входит в план по дням)
const guideRaw = import.meta.glob('../content/guides/*.md', { query: '?raw', import: 'default', eager: true })
export const guides = manifest.guides || []
const guideById = new Map(guides.map((g) => [g.id, g]))
const guideBySource = new Map(guides.map((g) => [g.source, g]))
export const getGuide = (id) => guideById.get(id)
export const guideSource = (id) => guideRaw[`../content/guides/${id}.md`] || ''

export function lessonNeighbours(id) {
  const i = lessons.findIndex((l) => l.id === id)
  return { prev: lessons[i - 1] || null, next: lessons[i + 1] || null, index: i }
}

export const lessonLabel = (l) => (l?.day ? `День ${l.day}` : '')

// план курса по дням: строится из поля «день» в заметках
export const REVIEW_DAY = 14
export const planDays = (() => {
  const days = new Map()
  for (const l of lessons) if (l.day) (days.get(l.day) || days.set(l.day, []).get(l.day)).push(l)
  if (!days.has(REVIEW_DAY)) days.set(REVIEW_DAY, [])
  return [...days.entries()].sort((a, b) => a[0] - b[0]).map(([day, list]) => ({ day, lessons: list }))
})()

export const sectionTitle = (id) => manifest.sections.find((s) => s.id === id)?.title || ''

// --- схемы: исходное имя файла из Obsidian → URL и подпись
export function scheme(origName) {
  const s = manifest.schemes[origName]
  if (!s) return null
  return { url: schemeFiles[`../content/schemes/${s.file}`], caption: s.caption }
}
export const schemeCount = Object.keys(manifest.schemes).length

// --- глоссарий
export const glossary = glossaryList
const termIndex = new Map(glossary.map((g) => [g.term.toLowerCase(), g]))
const slugIndex = new Map(glossary.map((g) => [g.slug, g]))
export const getTerm = (name) => termIndex.get(String(name).toLowerCase())
export const getTermBySlug = (slug) => slugIndex.get(slug)

// Разрешение вики-ссылки [[...]] в объект для рендера
export function resolveWikilink(target) {
  const clean = target.trim()
  const base = clean.split('/').pop()
  if (/^Глоссарий\//i.test(clean) || (!bySource.has(base) && termIndex.has(base.toLowerCase()))) {
    const g = getTerm(base)
    return g ? { type: 'term', term: g } : null
  }
  if (base === '00_План_курса') return { type: 'home' }
  if (guideBySource.has(base)) return { type: 'guide', guide: guideBySource.get(base) }
  const l = bySource.get(base)
  return l ? { type: 'lesson', lesson: l } : null
}
