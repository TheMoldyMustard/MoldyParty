import { expect, test, type Page } from '@playwright/test'

async function openCategoryBomb(page: Page, names: string[]) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Category Bomb' }).click()
  for (let index = 3; index > names.length; index -= 1) {
    await page.getByRole('button', { name: `Remove player ${index}` }).click()
  }
  for (let index = 3; index < names.length; index += 1) {
    await page.getByRole('button', { name: 'Add player' }).click()
  }
  for (const [index, name] of names.entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name)
  }
  await page.getByRole('checkbox', { name: /Sound/ }).uncheck()
  await page.getByRole('checkbox', { name: /Haptics/ }).uncheck()
}

async function expectBoxesNotToOverlap(page: Page, selector: string) {
  const boxes = await page.locator(selector).evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect()
    return { label: element.className, left: box.left, right: box.right, top: box.top, bottom: box.bottom }
  }))
  for (let first = 0; first < boxes.length; first += 1) {
    for (let second = first + 1; second < boxes.length; second += 1) {
      const a = boxes[first]
      const b = boxes[second]
      const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      expect(overlapWidth <= 1 || overlapHeight <= 1, `${a.label} and ${b.label} overlap by ${overlapWidth}×${overlapHeight}`).toBe(true)
    }
  }
}

test('radial game hides the timer, explodes on expiry, and replays', async ({ page }) => {
  await openCategoryBomb(page, ['Alex', 'Blair', 'Casey', 'Devon'])
  await page.getByRole('button', { name: 'Arrange players' }).click()
  await expect(page.getByTestId('category-bomb-placement-arrow')).toBeVisible()
  await expect(page.getByTestId('category-bomb-seat')).toHaveCount(4)

  await page.clock.install()
  await page.getByRole('button', { name: 'Arm bomb' }).click()
  await expect(page.getByTestId('category-bomb-arrow')).toBeVisible()
  await expect(page.getByRole('timer')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(/\b\d{1,2}:\d{2}\b/)

  await page.getByRole('button', { name: /Accept .* answer and pass/ }).click()
  await expect(page.getByText('+1.5s')).toBeVisible()
  await page.clock.fastForward(120_000)
  await expect(page.getByRole('heading', { name: /got exploded!/ })).toBeVisible()

  await page.getByRole('button', { name: 'New bomb' }).click()
  await expect(page.getByTestId('category-bomb-arrow')).toBeVisible()
  await expect(page.getByRole('timer')).toHaveCount(0)
})

test('13-player game shows only the current name and no arrow board', async ({ page }) => {
  const names = Array.from({ length: 13 }, (_, index) => `Player ${index + 1}`)
  await openCategoryBomb(page, names)
  await expect(page.getByText('Large group — current name only')).toBeVisible()
  await page.getByRole('button', { name: 'Start large-group game' }).click()
  await page.getByRole('button', { name: 'Arm bomb' }).click()

  await expect(page.locator('.category-bomb-active--name-only h1')).toHaveText(/Player \d+/)
  await expect(page.getByText('Pass to')).toBeVisible()
  await expect(page.getByTestId('category-bomb-arrow')).toHaveCount(0)
  await expect(page.getByTestId('category-bomb-active-seat')).toHaveCount(0)
})

test('two- and eight-player rosters use balanced radial play', async ({ page }) => {
  for (const count of [2, 8]) {
    if (count > 2) {
      await page.evaluate(() => localStorage.clear())
    }
    await openCategoryBomb(page, Array.from({ length: count }, (_, index) => `Guest ${index + 1}`))
    await page.getByRole('button', { name: 'Arrange players' }).click()
    await expect(page.getByTestId('category-bomb-seat')).toHaveCount(count)
    await page.getByRole('button', { name: 'Arm bomb' }).click()
    await expect(page.getByTestId('category-bomb-active-seat')).toHaveCount(count)
    await expect(page.getByTestId('category-bomb-arrow')).toBeVisible()
  }
})

test('twelve maximum-length names remain separated in portrait and landscape', async ({ page }, testInfo) => {
  const names = Array.from({ length: 12 }, (_, index) => `Player${String(index + 1).padStart(2, '0')}-ABCDEFGHIJKLMNO`)
  await openCategoryBomb(page, names)
  await page.getByRole('button', { name: 'Arrange players' }).click()
  await page.getByRole('button', { name: 'Arm bomb' }).click()

  for (const viewport of [{ width: 390, height: 844 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole('button', { name: 'Exit' })).toBeInViewport()
    await expect(page.locator('.category-bomb-active__category span')).toBeInViewport()
    await expect(page.locator('.category-bomb-active__category strong')).toBeInViewport()
    await expectBoxesNotToOverlap(page, '[data-testid="category-bomb-active-seat"]')
    await expectBoxesNotToOverlap(page, '[data-testid="category-bomb-active-seat"], .category-bomb-button, .category-bomb-foul, .category-bomb-active__category')
    const controlsFit = await page.locator('.category-bomb-active').evaluate((root) => {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      return [...root.querySelectorAll<HTMLElement>('.category-bomb-button, .category-bomb-foul, .category-bomb-active__exit, .category-bomb-active__category, .category-bomb-active__category span, .category-bomb-active__category strong')].every((element) => {
        const box = element.getBoundingClientRect()
        return box.left >= 0 && box.top >= 0 && box.right <= viewportWidth && box.bottom <= viewportHeight
      })
    })
    expect(controlsFit).toBe(true)
    const arrowClearsBomb = await page.locator('.category-bomb-board--active').evaluate((board) => {
      const arrow = board.querySelector<HTMLElement>('.category-bomb-arrow')!
      const bomb = board.querySelector<HTMLElement>('.category-bomb-button')!
      return arrow.offsetWidth > bomb.offsetWidth / 2 + 12
    })
    expect(arrowClearsBomb).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`category-bomb-${viewport.width}x${viewport.height}.png`) })
  }
})

test('a maximum-length name keeps the bomb reachable in large-group landscape', async ({ page }, testInfo) => {
  const names = Array.from({ length: 13 }, (_, index) => `Player${String(index + 1).padStart(2, '0')}-ABCDEFGHIJKLMNO`)
  await openCategoryBomb(page, names)
  await page.getByRole('button', { name: 'Start large-group game' }).click()
  await page.setViewportSize({ width: 667, height: 375 })
  await page.getByRole('button', { name: 'Arm bomb' }).click()
  const bomb = await page.getByRole('button', { name: /Accept .* answer and pass/ }).boundingBox()
  expect(bomb).not.toBeNull()
  expect(bomb!.y).toBeGreaterThanOrEqual(0)
  expect(bomb!.y + bomb!.height).toBeLessThanOrEqual(375)
  await page.screenshot({ path: testInfo.outputPath('category-bomb-name-only-667x375.png') })
})

test('a fifty-player roster can enter name-only play', async ({ page }) => {
  const names = Array.from({ length: 50 }, (_, index) => `Guest ${index + 1}`)
  await openCategoryBomb(page, names)
  await page.getByRole('button', { name: 'Start large-group game' }).click()
  await page.getByRole('button', { name: 'Arm bomb' }).click()
  await expect(page.locator('.category-bomb-active--name-only h1')).toHaveText(/Guest \d+/)
  await expect(page.getByTestId('category-bomb-arrow')).toHaveCount(0)
})
