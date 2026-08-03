# automation-guardrails

Two small, framework-agnostic guardrails for Playwright and Puppeteer. No dependency on
either library — both functions just need a `page` (or `frame`) object with `.url()` and
`.evaluate()`.

Built while running a production browser-automation tool that kept hitting the exact
problems below, badly enough that it was worth extracting into something reusable.

## `fillEditable` — reliably fill contenteditable / rich-text editors

Setting `.value` or `.textContent` on a contenteditable element is silently ignored by
Draft.js, ProseMirror, CodeMirror, and similar editors. This is a well-known pain point:

- [Playwright #39492](https://github.com/microsoft/playwright/issues/39492) — `fill()` appends the new text after the existing content instead of replacing it
- [Playwright #29813](https://github.com/microsoft/playwright/issues/29813) — "Element is not an `<input>`, `<textarea>` or `[contenteditable]` element" on an element that clearly is contenteditable

`fillEditable` writes via `document.execCommand('insertText', ...)`, which fires the real
input events these editors listen for, then reads the field back to verify the write
actually replaced the content instead of appending to it (the append case is a real,
reproducible failure mode when a write races the editor's own state reconciliation — we
hit it ourselves posting to a Draft.js-based editor). If verification fails, it clears the
field and retries once before throwing, instead of silently submitting garbled text.

```js
import { fillEditable } from 'automation-guardrails'

await fillEditable(page, '[data-testid="editor"]', 'Hello world')
```

## `verifyContext` — confirm you're on the page you think you're on

Multi-tab automation can silently keep acting on a stale page after a navigation, a
manual tab switch, or a race between two async operations. This is the browser-automation
equivalent of a null check: cheap to add, expensive to debug without it.

```js
import { verifyContext } from 'automation-guardrails'

await verifyContext(page, '/dashboard') // throws if page.url() doesn't include this
// or, to handle it yourself instead of throwing:
const result = await verifyContext(page, /\/dashboard$/, { onMismatch: 'return' })
if (!result.ok) { /* ... */ }
```

## Install

```
npm install automation-guardrails
```

## What this is not

Not a replacement for Playwright's own `locator.fill()` on real `<input>`/`<textarea>`
elements — use that, it's fine. This is specifically for the contenteditable/rich-text
case where `.fill()` and `.type()` are known to misbehave, and for the multi-tab
correctness gap that neither library checks for you.

## License

MIT
