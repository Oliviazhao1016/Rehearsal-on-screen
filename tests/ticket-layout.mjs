import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})

try {
  for (const viewport of [{ width: 1863, height: 942 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(async () => {
      const { makeProduction } = await import('/src/model.ts')
      const project = makeProduction('星期天与乔治在公园', 7, 14, 12)
      localStorage.setItem('musicaldirector-productions-v1', JSON.stringify([project]))
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Begin to Craft' }).click()
    await page.locator('.ticket-folder').hover()
    await page.waitForTimeout(750)
    const dimensions = await page.locator('.ticket-card:not(.blank)').evaluate(ticket => {
      const title = ticket.querySelector('.ticket-body strong')
      const body = ticket.querySelector('.ticket-body')
      const open = ticket.querySelector('.ticket-open-surface')
      const content = ticket.querySelector('.ticket-content')
      const ticketBox = ticket.getBoundingClientRect()
      const titleBox = title.getBoundingClientRect()
      const bodyBox = body.getBoundingClientRect()
      const openBox = open.getBoundingClientRect()
      const contentBox = content.getBoundingClientRect()
      return {
        ticketRatio: ticketBox.width / ticketBox.height,
        titleWithinBody: titleBox.left >= bodyBox.left - 1 && titleBox.right <= bodyBox.right + 1,
        bodyWithinTicket: bodyBox.left >= ticketBox.left - 1 && bodyBox.right <= ticketBox.right + 1,
        openWithinTicket: openBox.left >= ticketBox.left - 1 && openBox.right <= ticketBox.right + 1,
        contentWithinTicket: contentBox.left >= ticketBox.left - 1 && contentBox.right <= ticketBox.right + 1,
        titleLines: title.offsetHeight / parseFloat(getComputedStyle(title).lineHeight),
        titleTextFits: title.scrollWidth <= title.clientWidth && title.scrollHeight <= title.clientHeight + 1,
        titleScroll: { width: title.scrollWidth, clientWidth: title.clientWidth, height: title.scrollHeight, clientHeight: title.clientHeight },
        titleWidth: titleBox.width,
        bodyWidth: bodyBox.width,
        widths: {ticket: ticketBox.width, open: openBox.width, content: contentBox.width},
      }
    })
    console.log(JSON.stringify({ viewport, dimensions }))
    await page.screenshot({ path: `qa-ticket-${viewport.width}.png` })
    assert(Math.abs(dimensions.ticketRatio - 2 / 3) < .02, `Ticket aspect ratio changed: ${JSON.stringify({ viewport, dimensions })}`)
    assert(dimensions.titleWithinBody, `Title escapes the ticket body: ${JSON.stringify({ viewport, dimensions })}`)
    assert(dimensions.bodyWithinTicket && dimensions.openWithinTicket && dimensions.contentWithinTicket, `Ticket content escapes ticket artwork: ${JSON.stringify({ viewport, dimensions })}`)
    assert(dimensions.titleTextFits, `Title text clips instead of wrapping: ${JSON.stringify({ viewport, dimensions })}`)
    assert(dimensions.titleLines >= 1.8, `Title did not wrap inside the ticket: ${JSON.stringify({ viewport, dimensions })}`)
    await context.close()
  }
  console.log('Ticket layout passed at 1863px and 390px')
} finally {
  await browser.close()
}
