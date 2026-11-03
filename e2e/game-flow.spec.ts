import { expect, test, type Page } from '@playwright/test'

async function openNewSession(page: Page, name = 'E2E Session') {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Impostor' }).click()
  await page.getByRole('button', { name: 'Create new session' }).click()
  await page.getByLabel('Session name').fill(name)
  await page.getByRole('button', { name: 'Set up session' }).click()
}

async function holdReveal(page: Page, player: string) {
  await expect(page.getByRole('heading', { name: `Pass to ${player}` })).toBeVisible()
  const reveal = page.getByRole('button', { name: 'Drag up to reveal your role' })
  const box = await reveal.boundingBox()
  if (!box) throw new Error('Reveal control is not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * .75)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * .25)
  await expect(page.getByTestId('private-role')).toBeVisible()
  await page.mouse.up()
  await expect(page.getByTestId('private-role')).toBeHidden()
  await page.getByRole('button', { name: /seen my role/i }).click()
}

test('three players can complete a private round and replay', async ({ page }) => {
  await openNewSession(page)

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
    await page.getByRole('group', { name: 'Vote for up to 1 player' }).getByRole('button', { name: target }).click()
    await page.getByRole('button', { name: 'Lock in vote' }).click()
  }

  await expect(page.getByRole('heading', { name: 'Blair was voted out' })).toBeVisible()
  await expect(page.getByText('Secret word')).toBeVisible()
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByText('Round 2')).toBeVisible()
})

test('Group Vote completes a round without device handoffs', async ({ page }) => {
  await openNewSession(page)

  for (const [index, name] of ['Alex', 'Blair', 'Casey'].entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name)
  }
  await page.getByLabel('Group Vote').check()
  await page.getByRole('button', { name: 'Start secret round' }).click()

  await holdReveal(page, 'Alex')
  await holdReveal(page, 'Blair')
  await holdReveal(page, 'Casey')
  await page.getByRole('button', { name: 'Proceed to voting' }).click()

  await expect(page.getByText('Everyone chooses together')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pass to Alex' })).toHaveCount(0)
  await page.getByRole('group', { name: 'Vote for up to 1 player' }).getByRole('button', { name: 'Blair' }).click()
  await page.getByRole('button', { name: 'Decide the vote' }).click()

  await expect(page.getByRole('heading', { name: /was voted out|Nobody was voted out|vote was tied/ })).toBeVisible()
  await page.getByRole('button', { name: 'Group Vote' }).click()
  await expect(page.getByText('Round 2')).toBeVisible()
})

test('voting can switch to Group Vote after setup', async ({ page }) => {
  await openNewSession(page)

  for (const [index, name] of ['Alex', 'Blair', 'Casey'].entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name)
  }
  await page.getByRole('button', { name: 'Start secret round' }).click()
  await holdReveal(page, 'Alex')
  await holdReveal(page, 'Blair')
  await holdReveal(page, 'Casey')
  await page.getByRole('button', { name: 'Proceed to voting' }).click()

  await page.getByRole('button', { name: 'Proceed to Group Vote' }).click()
  await expect(page.getByText('Everyone chooses together')).toBeVisible()
  await page.getByRole('group', { name: 'Vote for up to 1 player' }).getByRole('button', { name: 'Blair' }).click()
  await page.getByRole('button', { name: 'Decide the vote' }).click()
})

test('special roles guess privately and every role is revealed', async ({ page }) => {
  const players = ['Alex', 'Blair', 'Casey', 'Devon', 'Emery']
  await openNewSession(page)
  await page.getByRole('button', { name: 'Add player' }).click()
  await page.getByRole('button', { name: 'Add player' }).click()

  for (const [index, name] of players.entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name)
  }
  await page.getByLabel('Jester').check()
  await page.getByRole('checkbox', { name: 'Outlier', exact: true }).check()
  await page.getByLabel('Give Outlier a hint').check()
  await page.getByRole('button', { name: 'Start secret round' }).click()

  let jester = ''
  let outlier = ''
  let secretWord = ''
  for (const player of players) {
    await expect(page.getByRole('heading', { name: `Pass to ${player}` })).toBeVisible()
    const reveal = page.getByRole('button', { name: 'Drag up to reveal your role' })
    const box = await reveal.boundingBox()
    if (!box) throw new Error('Reveal control is not visible')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * .75)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * .25)
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
    await page.getByRole('group', { name: 'Vote for up to 1 player' }).getByRole('button', { name: target }).click()
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

test('saved session can be continued, inspected, and deleted locally', async ({ page }) => {
  await openNewSession(page, 'Stats Crew')
  for (const [index, name] of ['Alex', 'Blair', 'Casey'].entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name)
  }
  await page.getByLabel('Group Vote').check()
  await page.getByRole('button', { name: 'Start secret round' }).click()
  await holdReveal(page, 'Alex')
  await holdReveal(page, 'Blair')
  await holdReveal(page, 'Casey')
  await page.getByRole('button', { name: 'Proceed to voting' }).click()
  await page.getByRole('group', { name: 'Vote for up to 1 player' }).getByRole('button', { name: 'Blair' }).click()
  await page.getByRole('button', { name: 'Decide the vote' }).click()

  let statsTable = page.getByRole('table', { name: 'Stats Crew session stats' })
  await expect(statsTable).toContainText('Alex')
  for (const player of ['Alex', 'Blair', 'Casey']) {
    const cells = statsTable.getByRole('row', { name: new RegExp(`^${player}`) }).getByRole('cell')
    for (const counterIndex of [3, 4, 5, 6, 7]) await expect(cells.nth(counterIndex)).toHaveText('0')
  }

  await page.reload()
  await expect(page.getByRole('heading', { name: /was voted out|Nobody was voted out/ })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Stats Crew session stats' }).getByRole('row', { name: /^Alex/ }).getByRole('cell').nth(0)).toHaveText('1')

  await page.getByRole('button', { name: 'Play again' }).click()
  await holdReveal(page, 'Alex')
  await holdReveal(page, 'Blair')
  await holdReveal(page, 'Casey')
  await page.getByRole('button', { name: 'Proceed to voting' }).click()
  await page.getByRole('group', { name: 'Vote for up to 1 player' }).getByRole('button', { name: 'Blair' }).click()
  await page.getByRole('button', { name: 'Decide the vote' }).click()
  statsTable = page.getByRole('table', { name: 'Stats Crew session stats' })
  await expect(statsTable.getByRole('row', { name: /^Alex/ }).getByRole('cell').nth(0)).toHaveText('2')

  await page.getByRole('button', { name: 'Return to lobby' }).click()
  await expect(page.getByRole('heading', { name: 'Impostor sessions' })).toBeVisible()

  await page.getByRole('button', { name: 'Continue a session' }).click()
  await expect(page.getByLabel('Player 1 name')).toHaveValue('Alex')
  await page.getByRole('button', { name: '← MoldyParty' }).click()

  await page.getByRole('button', { name: 'View session stats' }).click()
  await expect(page.getByRole('heading', { name: 'Stats Crew stats' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Stats Crew session stats' }).getByRole('row', { name: /^Alex/ }).getByRole('cell').nth(0)).toHaveText('2')
  await page.getByRole('button', { name: '← Sessions' }).click()

  await page.getByRole('button', { name: 'Create new session' }).click()
  await page.getByLabel('Session name').fill('Other Crew')
  await page.getByRole('button', { name: 'Set up session' }).click()
  for (const [index, name] of ['Dana', 'Eli', 'Fran'].entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name)
  }
  await page.getByLabel('Group Vote').check()
  await page.getByRole('button', { name: 'Start secret round' }).click()
  await holdReveal(page, 'Dana')
  await holdReveal(page, 'Eli')
  await holdReveal(page, 'Fran')
  await page.getByRole('button', { name: 'Proceed to voting' }).click()
  await page.getByRole('group', { name: 'Vote for up to 1 player' }).getByRole('button', { name: 'Eli' }).click()
  await page.getByRole('button', { name: 'Decide the vote' }).click()
  await page.getByRole('button', { name: 'Return to lobby' }).click()

  await page.getByRole('button', { name: 'Stats Crew' }).click()
  await page.getByRole('button', { name: 'Delete session' }).click()
  await expect(page.getByRole('dialog')).toContainText('Stats Crew')
  await page.getByRole('button', { name: 'Delete Stats Crew' }).click()
  await expect(page.getByRole('button', { name: 'Other Crew' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stats Crew' })).toHaveCount(0)
})

test('can abort an unfinished game without counting it', async ({ page }) => {
  await openNewSession(page, 'Abort Crew')
  for (const [index, name] of ['Alex', 'Blair', 'Casey'].entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name)
  }
  await page.getByRole('button', { name: 'Start secret round' }).click()

  await expect(page.getByRole('heading', { name: 'Pass to Alex' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abort game' })).toBeVisible()
  await page.getByRole('button', { name: 'Abort game' }).click()
  await expect(page.getByRole('dialog')).toContainText('Completed session stats stay unchanged')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Pass to Alex' })).toBeVisible()

  await page.getByRole('button', { name: 'Abort game' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Abort game' }).click()
  await expect(page.getByRole('heading', { name: 'Impostor sessions' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Abort Crew/ })).toContainText('0 completed rounds')

  await page.reload()
  await page.getByRole('button', { name: 'Open Impostor' }).click()
  await page.getByRole('button', { name: 'Abort Crew' }).click()
  await page.getByRole('button', { name: 'Continue a session' }).click()
  await expect(page.getByRole('heading', { name: 'Who can you trust?' })).toBeVisible()
  await expect(page.getByLabel('Player 1 name')).toHaveValue('Alex')
})
