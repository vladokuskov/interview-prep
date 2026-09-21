import { describe, expect, it } from 'vitest'
import { parseBank, inferTags } from './parse'

const SAMPLE = `
# Questions

### Table of Contents

| No. | Questions |
| 1 | [What is a closure](#what-is-a-closure) |

1. ### What is a closure

   A closure is a function bundled with its lexical scope.

   \`\`\`javascript
   function outer() { let x = 1; return () => x }
   \`\`\`

   **[⬆ Back to Top](#table-of-contents)**

2. ### What are server-sent events

   SSE is a server push technology over HTTP.

   **[⬆ Back to Top](#table-of-contents)**
`

describe('parseBank', () => {
  it('extracts one card per numbered question', () => {
    const cards = parseBank(SAMPLE)
    expect(cards).toHaveLength(2)
    expect(cards[0].question).toBe('What is a closure')
    expect(cards[1].ord).toBe(2)
  })

  it('keeps the answer body including code, and drops the back-to-top link', () => {
    const [first] = parseBank(SAMPLE)
    expect(first.answer).toContain('lexical scope')
    expect(first.answer).toContain('function outer()')
    expect(first.answer).not.toContain('Back to Top')
  })

  it('dedents the answer so code fences survive markdown rendering', () => {
    const [first] = parseBank(SAMPLE)
    expect(first.answer.split('\n').some((l) => l.startsWith('```javascript'))).toBe(true)
  })

  it('ignores the table of contents rows', () => {
    expect(parseBank(SAMPLE).some((c) => c.answer.includes('| No. |'))).toBe(false)
  })

  it('tags by keyword and never returns an empty tag list', () => {
    expect(inferTags('What is a closure', 'lexical scope')).toContain('closures')
    expect(inferTags('Something unrelated', 'nothing here')).toEqual(['general'])
  })
})

const DEVINTERVIEW = `
# Top 100 Typescript Interview Questions

## 1. What is _TypeScript_?

TypeScript is a typed superset of JavaScript.

### Features

- **Type System**: static typing.
<br>

## 2. What are _generics_?

Generics let you write reusable typed code.

\`\`\`typescript
function id<T>(x: T): T { return x }
\`\`\`
<br>
`

describe('parseBank: devinterview format', () => {
  it('splits on "## n." headings', () => {
    const cards = parseBank(DEVINTERVIEW, 'devinterview')
    expect(cards).toHaveLength(2)
    expect(cards[0].question).toBe('What is TypeScript?')
    expect(cards[1].question).toBe('What are generics?')
  })

  it('strips <br> padding and underscore emphasis but keeps code', () => {
    const cards = parseBank(DEVINTERVIEW, 'devinterview')
    expect(cards[1].answer).not.toContain('<br>')
    expect(cards[1].answer).toContain('function id<T>')
  })

  it('keeps sub-headings inside the answer body', () => {
    const [first] = parseBank(DEVINTERVIEW, 'devinterview')
    expect(first.answer).toContain('### Features')
  })
})

const DETAILS = `
<details>
<summary>3. What are the built-in types?</summary>

#### TypeScript

- \`string\` for text
- \`never\` for functions that never return

</details>

<details>
<summary>4. How do you declare variables?</summary>

Use \`let\` and \`const\` with annotations.

</details>
`

describe('parseBank: details format', () => {
  it('pulls one card per details block', () => {
    const cards = parseBank(DETAILS, 'details')
    expect(cards).toHaveLength(2)
    expect(cards[0].ord).toBe(3)
    expect(cards[0].question).toBe('What are the built-in types?')
    expect(cards[1].question).toBe('How do you declare variables?')
  })

  it('keeps the answer body and drops the html wrapper', () => {
    const [first] = parseBank(DETAILS, 'details')
    expect(first.answer).toContain('never')
    expect(first.answer).not.toContain('<details>')
    expect(first.answer).not.toContain('</summary>')
  })
})

describe('parseBank: junk rejection', () => {
  it('drops numbered sub-headings that are not real questions', () => {
    const withJunk = `
1. ### What is a closure

   A closure is a function with its scope.

   **[⬆ Back to Top](#table-of-contents)**

354. ### Benefits

   - Avoids deep inheritance
`
    const cards = parseBank(withJunk, 'sudheerj')
    expect(cards.map((c) => c.question)).toEqual(['What is a closure'])
  })

  it('does not tag ordinary English "this" as the JS keyword', () => {
    expect(inferTags('What are typed arrays', 'This is a list of types.')).not.toContain('this')
    expect(inferTags('How does this work', 'The `this` keyword is bound at call time.')).toContain('this')
  })
})
