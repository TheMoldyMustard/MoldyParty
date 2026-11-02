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
    store.getState().startGame(setup)
    store.getState().playAgain()

    expect(store.getState().game).toMatchObject({ phase: 'ROLE_REVEAL', round: 2 })
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
})
