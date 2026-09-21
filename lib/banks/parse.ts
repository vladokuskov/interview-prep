/**
 * Turns an interview-question README into cards.
 *
 * Splitting is done with a parser rather than a model on purpose: the published
 * answers are the ground truth, and a model rewriting them is exactly how wrong
 * answers get into spaced repetition.
 *
 * Two upstream formats are supported:
 *
 *  "sudheerj"      12. ### Question text
 *                      answer, indented, ends at a "Back to Top" link
 *
 *  "devinterview"  ## 12. Question text
 *                  answer, flush left, ends at the next "## n." heading
 *
 *  "details"       <details><summary>12. Question text</summary>
 *                  answer ... </details>
 */
export type BankFormat = 'sudheerj' | 'devinterview' | 'details'
export type ParsedCard = { ord: number; question: string; answer: string; tags: string[] }

const PATTERNS: Record<Exclude<BankFormat, 'details'>, RegExp> = {
  sudheerj: /^(\d+)\.\s*###\s+(.+?)\s*$/,
  devinterview: /^##\s+(\d+)\.\s+(.+?)\s*$/,
}

const DETAILS_RE = /<details>\s*<summary>\s*(\d+)[.)]?\s*(.+?)\s*<\/summary>([\s\S]*?)<\/details>/gi

const BACK_TO_TOP = /\*\*\[⬆\s*Back to Top\]/

export function parseBank(markdown: string, format: BankFormat = 'sudheerj'): ParsedCard[] {
  if (format === 'details') return parseDetails(markdown)
  const heading = PATTERNS[format]
  const lines = markdown.split('\n')
  const cards: ParsedCard[] = []
  let current: { ord: number; question: string; body: string[] } | null = null

  const flush = () => {
    if (!current) return
    const answer = clean(dedent(current.body))
    // Numbered sub-headings inside an answer can look like a new question
    // ("354. ### Benefits"). Real questions are phrases, not single words.
    if (answer && wordCount(current.question) >= 3) {
      cards.push({ ord: current.ord, question: clean(current.question), answer, tags: inferTags(current.question, answer) })
    }
    current = null
  }

  for (const line of lines) {
    const match = line.match(heading)
    if (match) {
      flush()
      current = { ord: Number(match[1]), question: match[2], body: [] }
      continue
    }
    if (!current) continue
    if (format === 'sudheerj' && BACK_TO_TOP.test(line)) {
      flush()
      continue
    }
    current.body.push(line)
  }
  flush()

  // Tables of contents repeat every question; real cards have bodies. Guard
  // against duplicate ordinals anyway by keeping the longest answer.
  const byOrd = new Map<number, ParsedCard>()
  for (const card of cards) {
    const existing = byOrd.get(card.ord)
    if (!existing || card.answer.length > existing.answer.length) byOrd.set(card.ord, card)
  }
  return [...byOrd.values()].sort((a, b) => a.ord - b.ord)
}

function parseDetails(markdown: string): ParsedCard[] {
  const cards: ParsedCard[] = []
  for (const m of markdown.matchAll(DETAILS_RE)) {
    const question = clean(m[2])
    const answer = clean(m[3])
    if (question && answer) cards.push({ ord: Number(m[1]), question, answer, tags: inferTags(question, answer) })
  }
  return cards.sort((a, b) => a.ord - b.ord)
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/** sudheerj answer bodies are indented under the list item; strip the common indent. */
function dedent(lines: string[]): string {
  const meaningful = lines.filter((l) => l.trim())
  if (meaningful.length === 0) return ''
  const indent = Math.min(...meaningful.map((l) => l.match(/^ */)![0].length))
  return lines.map((l) => l.slice(indent)).join('\n')
}

/** Upstream decorates terms with _underscores_ and pads sections with <br>. */
function clean(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '')
    .replace(/_([^_\n]{2,40})_/g, '$1')
    .trim()
}

/**
 * Keyword tagging, deliberately not a model call. Tags only drive grouping and
 * the weak-areas view, so cheap and deterministic beats clever and expensive.
 */
const TAG_RULES: [string, RegExp][] = [
  ['types', /typescript|\btypeof\b|\binterface\b|\benum\b|union type|type annotation|type guard|narrow|\bany\b|\bunknown\b/i],
  ['generics', /\bgeneric|type parameter|<T>|keyof|infer\b|conditional type|mapped type/i],
  ['async', /\basync|await|promise|callback|event loop|microtask|settimeout/i],
  ['closures', /\bclosure|scope|hoist|iife|lexical/i],
  // "this" is also an ordinary English word, so require it to look like code
  // or be named as the keyword; a bare /\bthis\b/ tagged a third of the bank.
  ['this', /`this`|this keyword|\bthis\.|\bthis\b\s*(?:binding|context)|\.bind\(|\.call\(|\.apply\(|arrow function/i],
  ['prototype', /\bprototype|inherit|__proto__|instanceof|\bclass\b/i],
  ['dom', /\bdom\b|element|event listener|bubbl|selector|innerhtml/i],
  ['react', /\breact|jsx|\bhook|usestate|useeffect|component|re-?render/i],
  ['perf', /\bperformance|memoi|debounce|throttle|lazy|reflow|repaint/i],
  ['storage', /\bcookie|localstorage|sessionstorage|indexeddb|\bcache/i],
  ['network', /\bfetch\b|ajax|\bxhr\b|\bcors\b|\bhttp|websocket|server-sent/i],
  ['security', /\bxss\b|\bcsrf\b|sanitiz|security|same-origin/i],
  ['modules', /\bmodule|\bimport\b|\bexport\b|require\(|commonjs|\besm\b|namespace/i],
  ['errors', /\berror|exception|\btry\b|\bcatch\b|\bthrow\b|finally/i],
  ['functional', /\bmap\(|filter|reduce|pure function|immutab|curry|compose/i],
  ['tooling', /\btsconfig|compiler|transpil|\bbabel\b|webpack|\bvite\b|\blint/i],
]

export function inferTags(question: string, answer: string): string[] {
  const haystack = `${question}\n${answer.slice(0, 600)}`
  const tags = TAG_RULES.filter(([, re]) => re.test(haystack)).map(([tag]) => tag)
  return tags.length ? tags : ['general']
}
