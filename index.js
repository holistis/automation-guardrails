/**
 * automation-guardrails
 *
 * Two small guardrails for Playwright/Puppeteer, extracted from a browser-automation
 * product where both bugs cost real time in production:
 *
 * 1. verifyContext — confirm you're actually on the page you think you're on before
 *    acting. Multi-tab automation can silently keep operating on a stale page after
 *    the user (or your own script) navigates elsewhere.
 * 2. fillEditable  — fill contenteditable / rich-text editors (Draft.js, ProseMirror,
 *    CodeMirror, and similar) reliably. Setting .value or .textContent is ignored by
 *    these editors, and a naive execCommand call can silently double-write if it runs
 *    twice against a page whose focus/selection state already changed.
 *
 * Both functions take a plain Playwright/Puppeteer `page` (or `frame`) object — no
 * dependency on either library, they just need `.url()` and `.evaluate()`.
 */

/**
 * Confirm the page's current URL matches what you expect before acting on it.
 *
 * @param {{url: () => string, evaluate: Function}} page - Playwright/Puppeteer Page or Frame
 * @param {string|RegExp} expected - substring to look for, or a RegExp to test against
 * @param {{onMismatch?: 'throw'|'return'}} [options]
 * @returns {Promise<{ok: boolean, currentUrl: string, message?: string}>}
 */
export async function verifyContext(page, expected, options = {}) {
  const { onMismatch = 'throw' } = options
  const currentUrl = typeof page.url === 'function' ? page.url() : String(page.url)
  const matches = expected instanceof RegExp
    ? expected.test(currentUrl)
    : currentUrl.includes(expected)

  if (matches) return { ok: true, currentUrl }

  const message = `verifyContext: expected page matching ${expected}, but the current page is "${currentUrl}". ` +
    `This usually means the automation is acting on a stale tab or a page that navigated away.`

  if (onMismatch === 'throw') throw new Error(message)
  return { ok: false, currentUrl, message }
}

/**
 * Fill a contenteditable / rich-text-editor element reliably, and verify the result.
 *
 * Uses document.execCommand('insertText', ...) because that fires the real input/
 * beforeinput events these editors listen for — setting .value or .textContent
 * directly is silently ignored by Draft.js, ProseMirror, and similar editors.
 *
 * Verifies by reading the field back after writing. This catches the double-write
 * failure mode where the field ends up containing the text twice, concatenated —
 * which happens when a second call (or a delayed reconciliation in the page's own
 * framework) races the first write. If that happens, fillEditable clears the field
 * and retries once before giving up, rather than silently submitting garbled text.
 *
 * @param {{evaluate: Function}} page - Playwright/Puppeteer Page or Frame
 * @param {string} selector - CSS selector for the editable element
 * @param {string} text - text to write
 * @param {{verify?: boolean, retries?: number}} [options]
 * @returns {Promise<{ok: boolean, value: string}>}
 */
export async function fillEditable(page, selector, text, options = {}) {
  const { verify = true, retries = 1 } = options

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await page.evaluate(({ selector, text }) => {
      const el = document.querySelector(selector)
      if (!el) return { ok: false, error: 'element_not_found' }
      el.focus()
      document.execCommand('selectAll', false, null)
      document.execCommand('delete', false, null)
      document.execCommand('insertText', false, text)
      const value = 'value' in el ? el.value : el.innerText
      return { ok: true, value }
    }, { selector, text })

    if (!result.ok) {
      throw new Error(`fillEditable: no element matched selector "${selector}"`)
    }
    if (!verify || result.value === text) {
      return result
    }
    // Mismatch (often a double-write) — loop will clear-and-retry if attempts remain.
    if (attempt === retries) {
      throw new Error(
        `fillEditable: verification failed after ${retries + 1} attempt(s). ` +
        `Expected "${text}" but the field contains "${result.value}". ` +
        `See README for why this happens with React-controlled editors.`
      )
    }
  }
}
