import { beforeEach, describe, expect, it } from 'vitest'
import type { GameSetupInput } from '../domain/types'
import { createGameStore } from './gameStore'

const setup: GameSetupInput = {
  playerNames: ['Alex', 'Blair', 'Casey'],
  impostorCount: 1,
  pack: {
    id: 'test',
    packName: 'Test',
    category: 'Test',
    source: 'builtIn',
    items: [{ word: 'Moon', hint: 'Orbit' }],
  },
  hintsEnabled: true,
  discussionDurationSeconds: 180,
}

describe('game store', () => {
  beforeEach(() => localStorage.clear())

  it('moves from lobby through private role reveals into discussion', () => {
    const store = createGameStore('role-flow', () => 0)
    store.getState().startGame(setup)
    expect(store.getState().game?.phase).toBe('ROLE_REVEAL')

    store.getState().showRole()
    expect(store.getState().game?.isRoleVisible).toBe(true)
    store.getState().hideRole()
    expect(store.getState().game?.isRoleVisible).toBe(false)

    store.getState().confirmRole()
    store.getState().confirmRole()
    store.getState().confirmRole()
    expect(store.getState().game?.phase).toBe('DISCUSSION')
  })

  it('uses a ready screen and confirmation before recording each secret vote', () => {
    const store = createGameStore('vote-flow', () => 0)
    store.getState().startGame(setup)
    store.getState().confirmRole()
    store.getState().confirmRole()
    store.getState().confirmRole()
    store.getState().beginVoting()

    expect(store.getState().isVoteReady).toBe(false)
    store.getState().showVote()
    store.getState().castVote('player-2')
    expect(store.getState().game?.votes).toEqual([])
    expect(store.getState().pendingVote).toBe('player-2')

    store.getState().confirmVote()
    expect(store.getState().game?.votes).toEqual([
      { voterId: 'player-1', targetId: 'player-2' },
    ])
    expect(store.getState().isVoteReady).toBe(false)
  })

  it('replays with the same setup and increments the round', () => {
    const store = createGameStore('replay', () => 0)
    store.getState().startGame({
      ...setup,
      pack: { ...setup.pack, items: [
        { word: 'Moon', hint: 'Orbit' },
        { word: 'Comet', hint: 'Tail' },
      ] },
    })
    expect(store.getState().game?.currentWord).toBe('Moon')
    store.getState().playAgain()

    expect(store.getState().game).toMatchObject({ phase: 'ROLE_REVEAL', round: 2 })
    expect(store.getState().game?.currentWord).toBe('Comet')
    expect(store.getState().setup?.pack.id).toBe('test')
  })

  it('returns to the lobby while retaining setup for edits', () => {
    const store = createGameStore('lobby', () => 0)
    store.getState().startGame(setup)
    store.getState().changeCategory()
    expect(store.getState().game).toBeNull()
    expect(store.getState().lobbyIntent).toBe('category')
    expect(store.getState().setup?.playerNames).toEqual(setup.playerNames)

    store.getState().startGame(setup)
    store.getState().returnToLobby()
    expect(store.getState().game).toBeNull()
    expect(store.getState().lobbyIntent).toBe('default')
  })

  it('restores the in-progress round from versioned local persistence', async () => {
    const firstStore = createGameStore('refresh-recovery', () => 0)
    firstStore.getState().startGame(setup)
    firstStore.getState().confirmRole()

    const restoredStore = createGameStore('refresh-recovery', () => 0)
    await restoredStore.persist.rehydrate()

    expect(restoredStore.getState().game).toMatchObject({
      phase: 'ROLE_REVEAL',
      currentRevealIndex: 1,
      currentWord: 'Moon',
    })
  })

  it('always masks a visible role and unfinished ballot after hydration', async () => {
    const revealStore = createGameStore('private-reveal', () => 0)
    revealStore.getState().startGame(setup)
    revealStore.getState().showRole()

    const restoredReveal = createGameStore('private-reveal', () => 0)
    await restoredReveal.persist.rehydrate()
    expect(restoredReveal.getState().game?.isRoleVisible).toBe(false)

    const ballotStore = createGameStore('private-ballot', () => 0)
    ballotStore.getState().startGame(setup)
    ballotStore.getState().confirmRole(); ballotStore.getState().confirmRole(); ballotStore.getState().confirmRole()
    ballotStore.getState().beginVoting()
    ballotStore.getState().showVote()
    ballotStore.getState().castVote('player-2')

    const restoredBallot = createGameStore('private-ballot', () => 0)
    await restoredBallot.persist.rehydrate()
    expect(restoredBallot.getState().isVoteReady).toBe(false)
    expect(restoredBallot.getState().pendingVote).toBeUndefined()
    expect(restoredBallot.getState().game?.votes).toEqual([])
  })

  it('persists a paused timer and derives a running timer from elapsed wall time', async () => {
    let now = 1_000
    const clock = () => now
    const store = createGameStore('timer-recovery', () => 0, localStorage, clock)
    store.getState().startGame(setup)
    store.getState().confirmRole(); store.getState().confirmRole(); store.getState().confirmRole()
    expect(store.getState().discussionRemainingSeconds).toBe(180)

    now += 2_500
    store.getState().syncDiscussionTimer()
    expect(store.getState().discussionRemainingSeconds).toBe(178)
    store.getState().pauseDiscussionTimer()

    now += 30_000
    const restored = createGameStore('timer-recovery', () => 0, localStorage, clock)
    await restored.persist.rehydrate()
    expect(restored.getState().discussionRemainingSeconds).toBe(178)
    expect(restored.getState().isDiscussionTimerRunning).toBe(false)
  })
})
