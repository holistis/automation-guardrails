import { chromium } from 'playwright'
import { verifyContext, fillEditable } from './index.js'
import assert from 'node:assert/strict'

const testHtml = `<!DOCTYPE html>
<html><body>
  <div id="editor" contenteditable="true" role="textbox"></div>
  <input id="plain" type="text" />
</body></html>`

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent(testHtml, { waitUntil: 'load' })

  // --- Test 1: fillEditable on a plain contenteditable div ---
  const r1 = await fillEditable(page, '#editor', 'Hello Playwright')
  assert.equal(r1.value, 'Hello Playwright', 'fillEditable should write the exact text once')
  console.log('PASS: fillEditable writes correct single value')

  // --- Test 2: fillEditable overwrite (not append) when called again ---
  const r2 = await fillEditable(page, '#editor', 'Second write')
  assert.equal(r2.value, 'Second write', 'fillEditable should REPLACE, not append, on a second call')
  console.log('PASS: fillEditable replaces existing content instead of appending')

  // --- Test 3: verifyContext passes on matching URL ---
  await page.goto('data:text/html,<h1>ok</h1>')
  const v1 = await verifyContext(page, 'data:text/html')
  assert.equal(v1.ok, true)
  console.log('PASS: verifyContext resolves ok on matching URL')

  // --- Test 4: verifyContext throws on mismatch ---
  let threw = false
  try {
    await verifyContext(page, 'https://example.com/expected-page')
  } catch (e) {
    threw = true
    assert.match(e.message, /expected page matching/)
  }
  assert.equal(threw, true, 'verifyContext should throw on a URL mismatch')
  console.log('PASS: verifyContext throws a clear error on mismatch')

  // --- Test 5: verifyContext with onMismatch:"return" does not throw ---
  const v2 = await verifyContext(page, 'https://example.com/expected-page', { onMismatch: 'return' })
  assert.equal(v2.ok, false)
  console.log('PASS: verifyContext returns {ok:false} instead of throwing when asked to')

  await browser.close()
  console.log('\nAll 5 tests passed.')
}

main().catch(err => {
  console.error('TEST FAILURE:', err)
  process.exit(1)
})
