import { expect, test, type Page } from '@playwright/test'

async function holdReveal(page: Page, player: string) {
  await expect(page.getByRole('heading', { name: `Pass to ${player}` })).toBeVisible()
  const reveal = page.getByRole('button', { name: 'Hold to reveal your role' })
  await reveal.hover()
  await page.mouse.down()
  await expect(page.getByTestId('private-role')).toBeVisible()
  await page.mouse.up()
  await expect(page.getByTestId('private-role')).toBeHidden()
  await page.getByRole('button', { name: /seen my role/i }).click()
}

test('three players can complete a private round and replay', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /set up a round/i }).click()

  for (const [index, name] of ['Alex', 'Blair', 'Casey'].entries()) {
    const input = page.getByLabel(`Player ${index + 1} name`)
    await input.fill(name)
  }
  await page.getByRole('button', { name: 'Start secret round' }).click()

  await holdReveal(page, 'Alex')
  await holdReveal(page, 'Blair')
  await holdReveal(page, 'Casey')

  await expect(page.getByRole('heading', { name: 'Discussion time' })).toBeVisible()
  await page.getByRole('button', { name: 'Proceed to voting' }).click()

  for (const [voter, target] of [['Alex', 'Blair'], ['Blair', 'Alex'], ['Casey', 'Blair']] as const) {
    await page.getByRole('button', { name: `I’m ${voter}` }).click()
    await page.getByRole('group', { name: 'Vote for one player' }).getByRole('button', { name: target }).click()
    await page.getByRole('button', { name: 'Lock in vote' }).click()
  }

  await expect(page.getByRole('heading', { name: 'Blair was voted out' })).toBeVisible()
  await expect(page.getByText('Secret word')).toBeVisible()
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByText('Round 2')).toBeVisible()
})
