// Копирует материалы из хранилища Obsidian (../vault) в src/content:
//  - уроки → src/content/lessons/<id>.md
//  - глоссарий → src/content/glossary.json
//  - схемы → src/content/schemes/<ascii-имя>.svg
//  - манифест → src/content/manifest.json
// Флаг --optional: если хранилища почему-то нет, используем уже имеющийся src/content.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vault = path.resolve(process.env.SLESAR_VAULT || path.join(root, '..', 'vault'))
const out = path.join(root, 'src', 'content')
const optional = process.argv.includes('--optional')

if (!fs.existsSync(path.join(vault, '00_План_курса.md'))) {
  if (optional && fs.existsSync(path.join(out, 'manifest.json'))) {
    console.log('[sync] хранилище не найдено, используем src/content как есть')
    process.exit(0)
  }
  console.error(`[sync] не найдено хранилище Obsidian: ${vault}`)
  process.exit(1)
}

const TR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}
export const translit = (s) =>
  s.toLowerCase().split('').map((c) => (c in TR ? TR[c] : c)).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const SECTIONS = [
  { id: 'basics', title: 'Неделя 1 · Основы', dir: '01_Основы', filter: (n) => /^0[1-7]_/.test(n) },
  { id: 'extra', title: 'Дополнительные уроки', dir: '01_Основы', filter: (n) => /^(0[89]|1\d)_/.test(n) },
  { id: 'engine', title: 'Неделя 2 · Двигатель V12', dir: '02_Двигатель', filter: () => true },
  { id: 'assembly', title: 'Сборка', dir: '03_Сборка', filter: () => true },
]

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { data: {}, body: text }
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([^:]+):\s*(.*)$/)
    if (kv) data[kv[1].trim()] = kv[2].trim()
  }
  return { data, body: text.slice(m[0].length) }
}

fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(path.join(out, 'lessons'), { recursive: true })
fs.mkdirSync(path.join(out, 'schemes'), { recursive: true })

// --- схемы
const schemes = {}
const schemeDir = path.join(vault, 'Вложения', 'схемы')
for (const f of fs.readdirSync(schemeDir).filter((f) => f.endsWith('.svg')).sort()) {
  const ascii = translit(f.replace(/\.svg$/, '')) + '.svg'
  const svg = fs.readFileSync(path.join(schemeDir, f), 'utf8')
  fs.writeFileSync(path.join(out, 'schemes', ascii), svg)
  // подпись: первый <text> в файле (заголовок схемы)
  const t = svg.match(/<text[^>]*>([^<]+)<\/text>/)
  const caption = t ? t[1].replace(/&amp;/g, '&').trim() : f.replace(/\.svg$/, '').replace(/_/g, ' ')
  schemes[f] = { file: ascii, caption }
}

// --- уроки
const lessons = []
for (const sec of SECTIONS) {
  const dir = path.join(vault, sec.dir)
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && sec.filter(f)).sort()
  files.forEach((f, i) => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8')
    const { data, body } = parseFrontmatter(raw)
    const h1 = body.match(/^#\s+(.+)$/m)
    const fullTitle = h1 ? h1[1].trim() : f
    const title = fullTitle.replace(/^(День\s+\d+\.|Доп\.\s*урок\.)\s*/i, '')
    const id = `${sec.id}-${String(i + 1).padStart(2, '0')}`
    const abstract = (body.match(/>\s*\[!abstract\][^\n]*\n((?:>.*\n?)+)/) || [])[1] || ''
    const summary = abstract.replace(/^>\s?/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
    fs.writeFileSync(path.join(out, 'lessons', `${id}.md`), body.replace(/^#\s+.+\r?\n/m, ''))
    lessons.push({
      id,
      section: sec.id,
      source: f.replace(/\.md$/, ''),
      title,
      fullTitle,
      day: data['день'] || '',
      time: data['время'] || '',
      summary: summary.length > 220 ? summary.slice(0, 217).replace(/\s+\S*$/, '') + '…' : summary,
    })
  })
}

// --- глоссарий
const glossary = []
const gDir = path.join(vault, 'Глоссарий')
for (const f of fs.readdirSync(gDir).filter((f) => f.endsWith('.md')).sort((a, b) => a.localeCompare(b, 'ru'))) {
  const { body } = parseFrontmatter(fs.readFileSync(path.join(gDir, f), 'utf8'))
  const term = f.replace(/\.md$/, '')
  // каждая строка «**Поле:** …» — отдельный абзац
  const text = body.replace(/^#\s+.+\r?\n/m, '').trim().replace(/\r?\n(?=\*\*)/g, '\n\n')
  const short = ((text.match(/\*\*Что это:\*\*\s*(.+)/) || [])[1] || '').trim()
  glossary.push({ term, slug: translit(term), body: text, short })
}

fs.writeFileSync(path.join(out, 'glossary.json'), JSON.stringify(glossary, null, 1))
fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify({ sections: SECTIONS.map(({ id, title }) => ({ id, title })), lessons, schemes }, null, 1),
)
console.log(`[sync] уроков: ${lessons.length}, терминов: ${glossary.length}, схем: ${Object.keys(schemes).length}`)
