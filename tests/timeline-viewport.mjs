import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    const { makeProduction, makeFirstPosition, makeTransition } = await import('/src/model.ts')
    const project = makeProduction('长音乐时间轴检查', 2, 14, 10)
    const first = makeFirstPosition(project.actors, 'backstage')
    const second = structuredClone(first)
    second.id = crypto.randomUUID()
    second.name = '站位 2'
    project.positions = [first, second]
    project.transitions = [makeTransition(first.id, second.id, 10)]
    project.music = [{ id: crypto.randomUUID(), name: '长音乐', start: 0, duration: 400 }]
    localStorage.setItem('musicaldirector-productions-v1', JSON.stringify([project]))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Begin to Craft' }).click()
  await page.locator('.ticket-folder').hover()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: '打开剧目 长音乐时间轴检查' }).click()

  const navigator = page.getByRole('slider', { name: '可见时间范围' })
  const window = navigator.locator('.timeline-view-window')
  await navigator.scrollIntoViewIfNeeded()
  const full = await navigator.boundingBox()
  assert(full)
  const initial = await window.boundingBox()
  assert(initial && initial.width < full.width * .15, 'Long music was compressed into the whole visible timeline')
  assert((await page.locator('.timeline-ruler span').count()) <= 11, 'Time labels are crowded')
  assert.equal(await page.locator('.music-clip').count(), 1)
  const savedBefore = await page.evaluate(() => localStorage.getItem('musicaldirector-productions-v1'))

  await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2)
  await page.mouse.wheel(0, -400)
  await page.waitForTimeout(200)
  const zoomed = await window.boundingBox()
  assert(zoomed && zoomed.width < initial.width, `Wheel up did not shorten the visible time range: ${initial.width} -> ${zoomed?.width}`)

  await page.mouse.move(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2)
  await page.mouse.down()
  await page.mouse.move(zoomed.x + zoomed.width / 2 + 110, zoomed.y + zoomed.height / 2, { steps: 8 })
  await page.mouse.up()
  assert(Number(await navigator.getAttribute('aria-valuenow')) > 0, 'Dragging the overview did not pan to a later time')

  const moved = await window.boundingBox()
  assert(moved)
  await page.mouse.move(moved.x + moved.width - 2, moved.y + moved.height / 2)
  await page.mouse.down()
  await page.mouse.move(moved.x + moved.width + 70, moved.y + moved.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(100)
  const resized = await window.boundingBox()
  assert(resized && resized.width > moved.width, 'Dragging the range edge did not expand the visible duration')

  const beforeHorizontalScroll = Number(await navigator.getAttribute('aria-valuenow'))
  await page.locator('.music-track').hover()
  await page.mouse.wheel(220, 0)
  await page.waitForTimeout(100)
  const afterHorizontalScroll = Number(await navigator.getAttribute('aria-valuenow'))
  assert(afterHorizontalScroll > beforeHorizontalScroll, 'Horizontal wheel did not pan the timeline')
  await page.getByRole('button', { name: '时间轴向左' }).click()
  assert(Number(await navigator.getAttribute('aria-valuenow')) < afterHorizontalScroll, 'Timeline arrow did not move the visible range')

  await page.screenshot({ path: 'qa-timeline-viewport.png', fullPage: true })
  assert.equal(await page.evaluate(() => localStorage.getItem('musicaldirector-productions-v1')), savedBefore, 'Changing the viewport modified rehearsal timings')
  await context.close()
  console.log('Timeline viewport passed: long music, wheel zoom, overview pan/resize, adaptive ticks, persisted timing unchanged')
} finally {
  await browser.close()
}
