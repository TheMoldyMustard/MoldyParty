import { expect, test, type Page } from '@playwright/test'

async function openCharades(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Forehead Charades' }).click()
  await page.getByRole('button', { name: 'Create new session' }).click()
  await page.getByLabel('Session name').fill('Guess Crew')
  await page.getByRole('button', { name: 'Set up session' }).click()
  await expect(page.getByRole('heading', { name: 'Forehead Charades' })).toBeVisible()
}

async function disableOptionalFeedback(page: Page) {
  await page.getByRole('checkbox', { name: /Tilt controls/ }).uncheck()
  await page.getByRole('checkbox', { name: /Sound/ }).uncheck()
  await page.getByRole('checkbox', { name: /Haptics/ }).uncheck()
}

async function chooseMode(page: Page, label: string) {
  await page.getByText(label, { exact: true }).click()
  await expect(page.getByRole('radio', { name: new RegExp(label, 'i') })).toBeChecked()
}

async function beginReadyRound(page: Page) {
  await page.getByRole('button', { name: 'Start game' }).click()
  await page.getByRole('button', { name: 'Start Get Ready' }).click()
  await page.clock.fastForward(3_000)
  await expect(page.getByRole('button', { name: 'Correct' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.clock.install()
})

test('classic uses tap fallback, recovers after refresh, and shows an ordered recap', async ({ page }) => {
  await openCharades(page)
  await disableOptionalFeedback(page)
  await beginReadyRound(page)

  const firstWord = await page.locator('.charades-card h1').textContent()
  expect(firstWord).toBeTruthy()
  await page.getByRole('button', { name: 'Correct' }).click()
  const secondWord = await page.locator('.charades-card h1').textContent()
  await page.getByRole('button', { name: 'Pass' }).click()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Correct' })).toBeVisible()
  await page.clock.fastForward(60_000)

  await expect(page.getByRole('heading', { name: 'Round recap' })).toBeVisible()
  await expect(page.getByText('1 point')).toBeVisible()
  const review = page.locator('.charades-word-review')
  await expect(review.getByText(firstWord!)).toBeVisible()
  await expect(review.getByText(secondWord!)).toBeVisible()
  await expect(review.locator('.word-review--correct')).toHaveCount(1)
  await expect(review.locator('.word-review--pass')).toHaveCount(1)
})

test('Henyo fixes two minutes, exposes category helpers, and applies a foul without changing cards', async ({ page }) => {
  await openCharades(page)
  await chooseMode(page, 'Henyo')
  await expect(page.getByText('2:00 fixed')).toBeVisible()
  await disableOptionalFeedback(page)
  await beginReadyRound(page)

  await expect(page.locator('.charades-category')).toBeVisible()
  const word = await page.locator('.charades-card h1').textContent()
  await page.getByRole('button', { name: 'Oo / Yes' }).click()
  await page.getByRole('button', { name: 'Hindi / No' }).click()
  await page.getByRole('button', { name: 'Pwede / Maybe' }).click()
  const beforeFoul = Number(await page.locator('.charades-timer').textContent())
  await page.getByRole('button', { name: 'Foul (-5s)' }).click()
  const afterFoul = Number(await page.locator('.charades-timer').textContent())
  await expect(page.locator('.charades-card h1')).toHaveText(word!)
  expect(beforeFoul - afterFoul).toBeGreaterThanOrEqual(5)
  expect(beforeFoul - afterFoul).toBeLessThanOrEqual(6)
})

test('One-Word repeats its rule before and during play', async ({ page }) => {
  await openCharades(page)
  await chooseMode(page, 'One-Word')
  await disableOptionalFeedback(page)
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.getByText('Each clue-giver may say exactly one word per card.')).toBeVisible()
  await page.getByRole('button', { name: 'Start Get Ready' }).click()
  await page.clock.fastForward(3_000)
  await expect(page.getByText('One word per clue-giver')).toBeVisible()
})

test('Team Relay alternates teams and rotates holders across configured rounds', async ({ page }) => {
  await openCharades(page)
  await chooseMode(page, 'Team Relay')
  await disableOptionalFeedback(page)
  await page.getByLabel('Player 1 name').fill('Alex')
  await page.getByLabel('Player 2 name').fill('Blair')
  await page.getByRole('button', { name: 'Add player' }).click()
  await page.getByLabel('Player 3 name').fill('Casey')
  await page.getByRole('button', { name: 'Add player' }).click()
  await page.getByLabel('Player 4 name').fill('Devon')
  await page.getByLabel('Team 1 name').fill('Molds')
  await page.getByLabel('Team 2 name').fill('Spores')
  await page.getByLabel('Alex team').selectOption({ label: 'Molds' })
  await page.getByLabel('Blair team').selectOption({ label: 'Molds' })
  await page.getByLabel('Casey team').selectOption({ label: 'Spores' })
  await page.getByLabel('Devon team').selectOption({ label: 'Spores' })
  await page.getByLabel('Relay rounds').selectOption('3')
  await page.getByRole('button', { name: 'Start game' }).click()

  for (const holder of ['Alex', 'Casey', 'Blair', 'Devon', 'Alex', 'Casey']) {
    await expect(page.getByRole('heading', { name: `Get ready, ${holder}` })).toBeVisible()
    await page.getByRole('button', { name: 'Start Get Ready' }).click()
    await page.clock.fastForward(3_000)
    await page.getByRole('button', { name: 'Correct' }).click()
    await page.clock.fastForward(60_000)
    await expect(page.getByRole('heading', { name: 'Round recap' })).toBeVisible()
    await page.getByRole('button', { name: 'Next turn' }).click()
  }

  await expect(page.getByText('Team Relay complete')).toBeVisible()
  await expect(page.getByText('Molds')).toBeVisible()
  await expect(page.getByText('Spores')).toBeVisible()
  await expect(page.getByText('3 turns').first()).toBeVisible()
})

test('completed turn stats survive continuation and a later confirmed abort', async ({ page }) => {
  await openCharades(page)
  await page.getByLabel('Player 1 name').fill('Alex')
  await page.getByLabel('Player 2 name').fill('Blair')
  await disableOptionalFeedback(page)
  await beginReadyRound(page)
  await page.getByRole('button', { name: 'Correct' }).click()
  await page.clock.fastForward(60_000)
  await expect(page.getByLabel('Completed turn stats')).toContainText('1 correct')
  await page.getByRole('button', { name: 'Return to sessions' }).click()

  await page.getByRole('button', { name: 'View stats for Guess Crew' }).click()
  const stats = page.getByRole('table', { name: 'Guess Crew Forehead Charades session stats' })
  await expect(stats.getByRole('row', { name: /^Alex/ })).toContainText('1')
  await page.getByRole('button', { name: '← Sessions' }).click()
  await page.getByRole('button', { name: 'Continue Guess Crew' }).click()
  await expect(page.getByLabel('Player 1 name')).toBeDisabled()
  await page.getByRole('button', { name: 'Start game' }).click()

  await page.getByRole('button', { name: 'Abort game' }).click()
  const dialog = page.getByRole('dialog', { name: 'Abort this game?' })
  await expect(dialog).toContainText('Completed session stats stay unchanged')
  await dialog.getByRole('button', { name: 'Abort game' }).click()
  await expect(page.getByRole('heading', { name: 'Forehead Charades sessions' })).toBeVisible()
  await page.getByRole('button', { name: 'View stats for Guess Crew' }).click()
  await expect(page.getByRole('table', { name: 'Guess Crew Forehead Charades session stats' }).getByRole('row', { name: /^Alex/ })).toContainText('1')
})
