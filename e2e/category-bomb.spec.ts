import { expect, test, type Page } from '@playwright/test'

async function openCategoryBomb(page: Page, names: string[]) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Category Bomb' }).click()
  for (let index = 3; index < names.length; index += 1) {
    await page.getByRole('button', { name: 'Add player' }).click()
  }
  for (const [index, name] of names.entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name)
  }
  await page.getByRole('checkbox', { name: /Sound/ }).uncheck()
  await page.getByRole('checkbox', { name: /Haptics/ }).uncheck()
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
