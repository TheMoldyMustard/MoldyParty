import { expect, test } from '@playwright/test'

test('a saved custom pack remains available after an offline reload', async ({ page, context }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /set up a round/i }).click()
  await page.getByRole('button', { name: 'Manage custom packs' }).click()

  await page.getByLabel('Pack name').fill('Offline Friends')
  await page.getByLabel('Word 1').fill('Mina')
  await page.getByLabel('Hint 1').fill('Designer')
  await page.getByRole('button', { name: 'Save pack' }).click()
  await expect(page.getByText('Pack saved on this device.')).toBeVisible()
  await expect(page.getByText('Offline Friends')).toBeVisible()

  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('heading', { name: 'MoldyParty' })).toBeVisible()
  await page.getByRole('button', { name: /set up a round/i }).click()
  await page.getByRole('button', { name: 'Manage custom packs' }).click()
  await expect(page.getByText('Offline Friends')).toBeVisible()
})
