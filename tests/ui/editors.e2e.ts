import { expect, test } from '@playwright/test'
// Separate from Vitest's unit-test file patterns.

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/ui/fixture.html')
  await page.locator('.request-editor').waitFor()
  await page.evaluate(() => document.fonts.ready)
})

for (const font of ['small', 'medium', 'large']) {
  test(`body click, drag and wrapped text align at ${font} font size`, async ({ page }) => {
    await page.evaluate((size) => {
      document.querySelector('.app-shell')!.classList.remove('font-small', 'font-medium', 'font-large')
      document.querySelector('.app-shell')!.classList.add(`font-${size}`)
    }, font)
    await page.getByRole('button', { name: 'Body', exact: true }).first().click()
    const editor = page.getByRole('textbox', { name: 'JSON request body' })
    // Locate a visible glyph in the syntax mirror, then click its center in the native textarea.
    const position = await page.locator('.json-body-highlight code').evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let node: Node | null
      let offset = 0
      while ((node = walker.nextNode())) {
        const index = node.textContent!.indexOf('Windows')
        if (index >= 0) {
          const range = document.createRange()
          range.setStart(node, index)
          range.setEnd(node, index + 1)
          const rect = range.getBoundingClientRect()
          range.setStart(node, index + 7)
          range.setEnd(node, index + 8)
          return {
            x: rect.left + 1,
            y: rect.top + rect.height / 2,
            endX: range.getBoundingClientRect().left + 1,
            offset: offset + index
          }
        }
        offset += node.textContent!.length
      }
      throw new Error('glyph not found')
    })
    await page.mouse.click(position.x, position.y)
    expect(await editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(
      position.offset
    )
    await page.mouse.move(position.x, position.y)
    await page.mouse.down()
    await page.mouse.move(position.endX, position.y, { steps: 8 })
    await page.mouse.up()
    const selected = await editor.evaluate((element: HTMLTextAreaElement) =>
      element.value.slice(element.selectionStart, element.selectionEnd)
    )
    expect(selected).toBe('Windows')
    await page.keyboard.insertText('EDITED')
    await expect(editor).toHaveValue(/EDITED/)
    const widths = await page.evaluate(() => ({
      native: document.querySelector('textarea')!.clientWidth,
      mirror: document.querySelector('.json-body-highlight')!.clientWidth
    }))
    expect(widths.native).toBe(widths.mirror)
    await page.screenshot({ path: `test-results/body-${font}-windows.png` })
  })
}

test('edits an environment variable from URL hover and explicitly saves in variables', async ({ page }) => {
  const variable = page.locator('.url-highlight .variable-reference').first()
  const bounds = await variable.boundingBox()
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)
  const popover = page.getByRole('dialog', { name: 'Variable base_url' })
  await expect(popover).toBeVisible()
  await popover.getByRole('button', { name: 'Edit value' }).click()
  await popover.getByRole('textbox', { name: 'Variable value' }).fill('https://updated.example.com')
  await popover.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(popover).not.toBeVisible()
  await page.getByRole('button', { name: 'Variables', exact: true }).first().click()
  await page.getByRole('button', { name: 'Save variables', exact: true }).click()
  await expect(page.getByText('Variables saved locally.')).toBeVisible()
  await page.reload()
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('ui-test-state')!))
  expect(state.workspaces[0].environments[0].variables[0].value).toBe('https://updated.example.com')
})

test('persists both script phases with the request', async ({ page }) => {
  await page.getByRole('button', { name: 'Scripts', exact: true }).click()
  await page.getByRole('textbox', { name: 'Pre-request script' }).fill('pm.variables.set("id", "42");')
  await page.getByRole('button', { name: 'Post-response', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Post-response script' })
    .fill('pm.test("status", () => pm.response.to.have.status(200));')
  await page.locator('.request-title-row').getByRole('button', { name: 'Save', exact: true }).click()
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('ui-test-state') || '{}').workspaces?.[0].collections[0].requests[0]
            .scripts?.postResponse
      )
    )
    .toContain('pm.test')
  await page.screenshot({ path: 'test-results/scripts-windows.png' })
})

test('native selection also aligns inside variables in URL, params and auth', async ({ page }) => {
  for (const [tab, mirror, control] of [
    ['', '.url-highlight', '.url-input'],
    ['Params', '.variable-value-highlight', '.variable-value-input'],
    ['Auth', '.auth-value-highlight', '.auth-variable-input']
  ]) {
    if (tab)
      await page
        .getByRole('button', { name: new RegExp(`^${tab}`) })
        .first()
        .click()
    const point = await page
      .locator(`${mirror} .variable-reference`)
      .first()
      .evaluate((element) => {
        const range = document.createRange()
        range.setStart(element.firstChild!, 2)
        range.setEnd(element.firstChild!, 3)
        const rect = range.getBoundingClientRect()
        return { x: rect.left + 1, y: rect.top + rect.height / 2 }
      })
    await page.mouse.click(point.x, point.y)
    const selection = await page
      .locator(control)
      .first()
      .evaluate((element: HTMLInputElement) => ({ value: element.value, start: element.selectionStart }))
    expect(selection.start).toBe(selection.value.indexOf('{{') + 2)
  }
})

test('clicking a long wrapped body after scrolling selects the visible character', async ({ page }) => {
  await page.getByRole('button', { name: 'Body', exact: true }).first().click()
  const editor = page.getByRole('textbox', { name: 'JSON request body' })
  await editor.fill(
    Array.from({ length: 25 }, (_, index) => `line ${index}: ${'Windows Unicode ç á {} '.repeat(12)}`).join(
      '\n'
    )
  )
  await editor.evaluate((element: HTMLTextAreaElement) => {
    element.scrollTop = 200
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
  })
  const point = await page.locator('.json-body-highlight').evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node: Node | null
    let offset = 0
    while ((node = walker.nextNode())) {
      for (let index = 0; index < node.textContent!.length; index++) {
        if (node.textContent![index] !== 'W') continue
        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + 1)
        const rect = range.getBoundingClientRect()
        if (rect.top > bounds.top + 12 && rect.bottom < bounds.bottom - 12)
          return { x: rect.left + 1, y: rect.top + rect.height / 2, offset: offset + index }
      }
      offset += node.textContent!.length
    }
    throw new Error('No visible glyph after scrolling')
  })
  await page.mouse.click(point.x, point.y)
  expect(await editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(point.offset)
})
