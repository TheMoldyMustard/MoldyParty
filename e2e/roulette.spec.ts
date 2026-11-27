import { expect, test } from '@playwright/test'

test('names can be entered and spun without viewport overflow', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Name Roulette' }).click()
  await page.getByRole('textbox', { name: 'Name 1', exact: true }).fill('Alex')
  await page.getByRole('textbox', { name: 'Name 2', exact: true }).fill('Blair')
  await page.getByRole('button', { name: 'Add name' }).click()
  await page.getByRole('textbox', { name: 'Name 3', exact: true }).fill('Casey')

  const wheel = page.getByRole('img', { name: 'Roulette wheel with 3 names' })
  await expect(wheel).toBeVisible()
  const box = await wheel.boundingBox()
  expect(box).not.toBeNull()
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.getByRole('button', { name: 'Spin the wheel' }).click()
  await expect(page.getByRole('button', { name: 'Spinning…' })).toBeDisabled()
  const winner = page.getByRole('heading', { name: /^(Alex|Blair|Casey) wins!$/ })
  await expect(winner).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('button', { name: 'Spin again' })).toBeEnabled()
})

test('a saved session roster can be copied into the wheel', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Impostor' }).click()
  await page.getByRole('button', { name: 'Create new session' }).click()
  await page.getByLabel('Session name').fill('Roulette Crew')
  await page.getByRole('button', { name: 'Set up session' }).click()
  for (const [index, name] of ['Alex', 'Blair', 'Casey'].entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name)
  }
  await page.getByRole('button', { name: 'Start secret round' }).click()
  await page.getByRole('button', { name: 'Abort game' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Abort game' }).click()
  await page.getByRole('button', { name: '← MoldyParty' }).click()

  await page.getByRole('button', { name: 'Open Name Roulette' }).click()
  await page.getByLabel('Saved session roster').selectOption({ label: 'Impostor · Roulette Crew' })
  await page.getByRole('button', { name: 'Use session names' }).click()

  await expect(page.getByRole('textbox', { name: 'Name 1', exact: true })).toHaveValue('Alex')
  await expect(page.getByRole('textbox', { name: 'Name 2', exact: true })).toHaveValue('Blair')
  await expect(page.getByRole('textbox', { name: 'Name 3', exact: true })).toHaveValue('Casey')
  await expect(page.getByRole('img', { name: 'Roulette wheel with 3 names' })).toBeVisible()
})
