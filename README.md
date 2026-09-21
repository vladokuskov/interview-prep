# Interview prep

Personal, local-first interview drilling. Single user, no auth, no deploy. Runs on your
machine against your own CV and your own API key.

## What it does

| Mode | Route | What it drills |
|---|---|---|
| Quiz cards | `/drill/quiz` | Rapid recall over 970 imported cards, FSRS scheduled, self graded |
| Story drill | `/drill/behavioral` | STAR answers built from your CV bullets, graded on content **and** English |
| Stories | `/stories` | Fill the gaps the CV bullet did not answer |
| Stats | `/stats` | Reps per day, average score by mode, weakest tags |
| Today | `/` | One button: what to do now |

Every typed answer gets two passes: a rubric grade (content) and an English review
(articles, tense, hedging, run-ons) with a rewritten version you can compare against.

## Setup

```bash
npm install
cp .env.example .env.local        # add ANTHROPIC_API_KEY
npm run ingest -- "/path/to/CV.pdf"   # needs python3 with pypdf
npm run seed:stories                  # CV bullets -> STAR skeletons + question phrasings
npm run import:bank -- js             # then: react, ts-ua
npm run dev                           # http://localhost:3000
```

`npm run dev` binds `0.0.0.0`, so quiz cards work from your phone on the same wifi.

## Commands

```bash
npm run dev            # app
npm test               # scheduler + bank parser
npm run eval:grader    # check the judge against hand-graded answers
npm run check:bank -- javascript-1000 20   # eyeball import quality
```

## Question banks

Imported from public GitHub READMEs into local SQLite, for personal study only.
`data/` is gitignored so nothing is redistributed.

| Bank | Cards | License |
|---|---|---|
| `javascript-1000` (sudheerj) | 517 | no license file |
| `react-500` (sudheerj) | 352 | MIT |
| `typescript-ua` (DevLoversTeam) | 101 | MIT, Ukrainian |

There is no good large English-language TypeScript bank on GitHub. The popular
"Top 100 TypeScript" repo publishes only 15 answers and gates the rest behind a
signup, so it is not imported. The biggest open TS bank is MIT but Ukrainian:
useful for concept recall, useless for English practice.

Answers always come from the source, never from a model. Splitting is done by a
parser (`lib/banks/parse.ts`) so no model can quietly rewrite an answer. Bad cards
get retired from the card itself with one click.

## Design notes

- **Percent mastered, not percent seen.** A card counts as mastered once FSRS
  expects it to survive 21 days. It moves slowly on purpose.
- **The grader must quote.** Every score carries a verbatim span from your answer;
  paraphrases are stripped in `enforceEvidence`. A score with no quote is a score
  with no reasoning.
- **Rubrics are anchored**, not vibes. See `lib/grading/rubrics/*.json`.
- **Pressure mode**: 90 second timer and a minimum word count. That constraint is
  what makes typed practice transfer to speaking.
- **Voice is a seam, not a rewrite.** Grading only ever sees a transcript, and
  `attempts` already has `audio_path` / `transcript_source` columns. Swapping
  `TextAnswerInput` for a voice input changes nothing downstream.
- `lib/text.ts` holds anything a client component needs. `lib/llm` and
  `lib/grading` are server-side only; importing them from a client component
  pulls `node:child_process` into the browser bundle and breaks the build.

## Cost

Default provider is the Anthropic SDK. Roughly 3k-6k tokens per graded answer,
so ordinary use is single-digit dollars a month.

`LLM_PROVIDER=claude-cli` needs no API key and bills against a Claude subscription,
but the CLI prepends its own harness context on every call: a one word reply
measured ~20k input tokens with `--system-prompt` and `--tools ""` set, and ~37k
without. Fine for one-off seeding scripts, wasteful for per-answer grading.

## This is not a substitute for human mocks

It is for reps and retention. An LLM will not reproduce a senior engineer going
quiet while you flail. Book real mocks too; this tool's job is making sure you
never waste one on a story you had not rehearsed.
