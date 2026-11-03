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

test('Absolute Voting completes a round without device handoffs', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /set up a round/i }).click()

  for (const [index, name] of ['Alex', 'Blair', 'Casey'].entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name)
  }
  await page.getByLabel('Absolute Voting').check()
  await page.getByRole('button', { name: 'Start secret round' }).click()

  await holdReveal(page, 'Alex')
  await holdReveal(page, 'Blair')
  await holdReveal(page, 'Casey')
  await page.getByRole('button', { name: 'Proceed to voting' }).click()

  await expect(page.getByText('Everyone can see this ballot')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pass to Alex' })).toHaveCount(0)
  for (const target of ['Blair', 'Alex', 'Blair']) {
    await page.getByRole('group', { name: 'Vote for one player' }).getByRole('button', { name: target }).click()
    await page.getByRole('button', { name: 'Lock in vote' }).click()
  }

  await expect(page.getByRole('heading', { name: /was voted out|Nobody was voted out|vote was tied/ })).toBeVisible()
  await page.getByRole('button', { name: 'Absolute Voting' }).click()
  await expect(page.getByText('Round 2')).toBeVisible()
})

test('special roles guess privately and every role is revealed', async ({ page }) => {
  const players = ['Alex', 'Blair', 'Casey', 'Devon', 'Emery']
  await page.goto('/')
  await page.getByRole('button', { name: /set up a round/i }).click()
  await page.getByRole('button', { name: 'Add player' }).click()
  await page.getByRole('button', { name: 'Add player' }).click()

  for (const [index, name] of players.entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name)
  }
  await page.getByLabel('Jester').check()
  await page.getByLabel('Outlier').check()
  await page.getByLabel('Give Outlier a hint').check()
  await page.getByRole('button', { name: 'Start secret round' }).click()

  let jester = ''
  let outlier = ''
  let secretWord = ''
  for (const player of players) {
    await expect(page.getByRole('heading', { name: `Pass to ${player}` })).toBeVisible()
    const reveal = page.getByRole('button', { name: 'Hold to reveal your role' })
    await reveal.hover()
    await page.mouse.down()
    const privateRole = page.getByTestId('private-role')
    await expect(privateRole).toBeVisible()
    const role = (await privateRole.locator('strong').textContent())?.trim() ?? ''
    if (role === 'Jester') jester = player
    if (role === 'Outlier') outlier = player
    if (!['Impostor', 'Jester', 'Outlier'].includes(role)) secretWord = role
    await page.mouse.up()
    await expect(privateRole).toBeHidden()
    await page.getByRole('button', { name: /seen my role/i }).click()
  }

  expect(jester).not.toBe('')
  expect(outlier).not.toBe('')
  expect(secretWord).not.toBe('')
  await page.getByRole('button', { name: 'Proceed to voting' }).click()

  for (const voter of players) {
    await page.getByRole('button', { name: `I’m ${voter}` }).click()
    const target = voter === jester ? players.find((player) => player !== voter)! : jester
    await page.getByRole('group', { name: 'Vote for one player' }).getByRole('button', { name: target }).click()
    await page.getByRole('button', { name: 'Lock in vote' }).click()
  }

  await expect(page.getByRole('heading', { name: `Pass to ${outlier}` })).toBeVisible()
  await page.getByRole('button', { name: `I’m ${outlier}` }).click()
  await page.getByLabel('Your word guess').fill(secretWord)
  await page.getByRole('button', { name: 'Lock in guess' }).click()

  await expect(page.getByRole('heading', { name: `${jester} was voted out` })).toBeVisible()
  await expect(page.getByText(`${jester} won as Jester`)).toBeVisible()
  await expect(page.getByText(`${outlier} won as Outlier`)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Player roles' }).getByRole('listitem')).toHaveCount(5)
})
