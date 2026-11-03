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
  jesterEnabled: false,
  outlierEnabled: false,
  outlierHintsEnabled: false,
  absoluteVotingEnabled: false,
  discussionDurationSeconds: 180,
}

describe('game store', () => {
  beforeEach(() => localStorage.clear())

  function completePrivateRound(store: ReturnType<typeof createGameStore>) {
    store.getState().confirmRole(); store.getState().confirmRole(); store.getState().confirmRole()
    store.getState().beginVoting()
    for (const targetId of ['player-2', 'player-1', 'player-2']) {
      store.getState().showVote()
      store.getState().castVote(targetId)
      store.getState().confirmVote()
    }
  }

  it('creates a named local session when its first round starts', () => {
    const store = createGameStore('named-session', () => 0, localStorage, () => 1_000, () => 'session-1')

    store.getState().createSession(' Friday Crew ')
    store.getState().startGame(setup)

    expect(store.getState().activeSessionId).toBe('session-1')
    expect(store.getState().sessionsById['session-1']).toMatchObject({
      id: 'session-1',
      name: 'Friday Crew',
      completedRounds: 0,
      players: [
        { id: 'player-1', name: 'Alex' },
        { id: 'player-2', name: 'Blair' },
        { id: 'player-3', name: 'Casey' },
      ],
    })
  })

  it('commits completed-round stats exactly once', async () => {
    const store = createGameStore('session-stats', () => 0, localStorage, () => 1_000, () => 'session-1')
    store.getState().createSession('Friday Crew')
    store.getState().startGame(setup)

    completePrivateRound(store)

    expect(store.getState().sessionsById['session-1']).toMatchObject({
      completedRounds: 1,
      statsByPlayerId: {
        'player-1': { roundsPlayed: 1, correctImpostorGuesses: 1, wins: { total: 1 } },
        'player-2': { roundsPlayed: 1, losses: { total: 1 } },
        'player-3': { roundsPlayed: 1, correctImpostorGuesses: 1, wins: { total: 1 } },
      },
    })

    const restored = createGameStore('session-stats', () => 0, localStorage, () => 1_000, () => 'unused')
    await restored.persist.rehydrate()
    expect(restored.getState().sessionsById['session-1'].completedRounds).toBe(1)
    expect(restored.getState().sessionsById['session-1'].statsByPlayerId['player-1'].roundsPlayed).toBe(1)

    restored.getState().playAgain()
    completePrivateRound(restored)
    expect(restored.getState().sessionsById['session-1'].completedRounds).toBe(2)
    expect(restored.getState().sessionsById['session-1'].statsByPlayerId['player-1'].roundsPlayed).toBe(2)
  })

  it('continues saved sessions without mixing their rounds or stats', () => {
    const ids = ['session-1', 'session-2']
    const store = createGameStore('session-isolation', () => 0, localStorage, () => 1_000, () => ids.shift()!)
    store.getState().createSession('Friday Crew')
    store.getState().startGame(setup)
    completePrivateRound(store)
    store.getState().returnToLobby()

    store.getState().createSession('Saturday Crew')
    store.getState().startGame({ ...setup, playerNames: ['Dee', 'Emery', 'Frankie'] })
    store.getState().returnToLobby()
    store.getState().continueSession('session-1')

    expect(store.getState().activeSessionId).toBe('session-1')
    expect(store.getState().setup?.playerNames).toEqual(['Alex', 'Blair', 'Casey'])
    expect(store.getState().sessionsById['session-1'].completedRounds).toBe(1)
    expect(store.getState().sessionsById['session-2'].completedRounds).toBe(0)
  })

  it('deletes only the selected local session', () => {
    const ids = ['session-1', 'session-2']
    const store = createGameStore('delete-session', () => 0, localStorage, () => 1_000, () => ids.shift()!)
    store.getState().createSession('Friday Crew')
    store.getState().startGame(setup)
    store.getState().returnToLobby()
    store.getState().createSession('Saturday Crew')
    store.getState().startGame({ ...setup, playerNames: ['Dee', 'Emery', 'Frankie'] })

    store.getState().deleteSession('session-1')

    expect(store.getState().sessionsById['session-1']).toBeUndefined()
    expect(store.getState().sessionsById['session-2']?.name).toBe('Saturday Crew')
    expect(store.getState().activeSessionId).toBe('session-2')
  })

  it('resumes the unfinished round stored with a continued session', () => {
    const store = createGameStore('resume-session', () => 0, localStorage, () => 1_000, () => 'session-1')
    store.getState().createSession('Friday Crew')
    store.getState().startGame(setup)
    store.getState().confirmRole()
    store.getState().returnToLobby()

    store.getState().continueSession('session-1')

    expect(store.getState().game).toMatchObject({ phase: 'ROLE_REVEAL', currentRevealIndex: 1 })
  })

  it('aborts an unfinished round without changing session statistics', () => {
    const store = createGameStore('abort-session', () => 0, localStorage, () => 1_000, () => 'session-1')
    store.getState().createSession('Friday Crew')
    store.getState().startGame(setup)
    completePrivateRound(store)

    const completed = structuredClone(store.getState().sessionsById['session-1'])
    store.getState().playAgain()
    expect(store.getState().game?.phase).toBe('ROLE_REVEAL')

    store.getState().abortGame()

    expect(store.getState().game).toBeNull()
    expect(store.getState().activeSessionId).toBeNull()
    expect(store.getState().sessionsById['session-1']).toMatchObject({
      currentGame: null,
      completedRounds: completed.completedRounds,
      statsByPlayerId: completed.statsByPlayerId,
    })
  })

  it('persists an aborted session without a current game', async () => {
    const store = createGameStore('abort-persistence', () => 0, localStorage, () => 1_000, () => 'session-1')
    store.getState().createSession('Friday Crew')
    store.getState().startGame(setup)
    store.getState().abortGame()

    const restored = createGameStore('abort-persistence', () => 0)
    await restored.persist.rehydrate()

    expect(restored.getState().sessionsById['session-1']).toMatchObject({
      name: 'Friday Crew',
      currentGame: null,
      completedRounds: 0,
    })
    expect(restored.getState().sessionsById['session-1'].statsByPlayerId['player-1'].roundsPlayed).toBe(0)
  })

  it('preserves completed statistics when an aborted session is hydrated', async () => {
    const store = createGameStore('abort-prior-stats', () => 0, localStorage, () => 1_000, () => 'session-1')
    store.getState().createSession('Friday Crew')
    store.getState().startGame(setup)
    completePrivateRound(store)
    const expectedStats = structuredClone(store.getState().sessionsById['session-1'].statsByPlayerId)
    store.getState().playAgain()
    store.getState().abortGame()

    const restored = createGameStore('abort-prior-stats', () => 0)
    await restored.persist.rehydrate()

    expect(restored.getState().sessionsById['session-1']).toMatchObject({
      currentGame: null,
      completedRounds: 1,
      statsByPlayerId: expectedStats,
    })
  })

  it('preserves player identity when starting the next round of a saved session', () => {
    const store = createGameStore('stable-roster', () => 0, localStorage, () => 1_000, () => 'session-1')
    store.getState().createSession('Friday Crew')
    store.getState().startGame(setup)
    store.getState().returnToLobby()
    store.getState().continueSession('session-1')

    store.getState().startGame({ ...setup, playerNames: ['Changed', 'Names', 'Here'] })

    expect(store.getState().game?.players.map((player) => player.name)).toEqual(['Alex', 'Blair', 'Casey'])
  })

  it('migrates a version 3 in-progress game into a local session', async () => {
    const source = createGameStore('v3-source', () => 0, localStorage, () => 1_000, () => 'source')
    source.getState().startGame(setup)
    source.getState().confirmRole()
    localStorage.setItem('v3-session-migration', JSON.stringify({
      state: {
        setup: source.getState().setup,
        game: source.getState().game,
        lobbyIntent: 'default',
      },
      version: 3,
    }))

    const restored = createGameStore('v3-session-migration', () => 0, localStorage, () => 2_000, () => 'recovered-session')
    await restored.persist.rehydrate()

    expect(restored.getState().activeSessionId).toBe('recovered-session')
    expect(restored.getState().sessionsById['recovered-session']).toMatchObject({
      name: 'Recovered Session',
      completedRounds: 0,
      currentGame: { phase: 'ROLE_REVEAL', currentRevealIndex: 1 },
    })
  })

  it('drops a malformed version 4 session without deleting valid sessions', async () => {
    const source = createGameStore('v4-source', () => 0, localStorage, () => 1_000, () => 'valid-session')
    source.getState().createSession('Valid')
    source.getState().startGame(setup)
    const valid = source.getState().sessionsById['valid-session']
    localStorage.setItem('v4-session-validation', JSON.stringify({
      state: {
        setup: null,
        game: null,
        sessionsById: {
          'valid-session': valid,
          broken: { id: 'broken', name: 'Broken', players: [], statsByPlayerId: { nope: -1 } },
        },
        activeSessionId: null,
      },
      version: 4,
    }))

    const restored = createGameStore('v4-session-validation', () => 0)
    await restored.persist.rehydrate()

    expect(Object.keys(restored.getState().sessionsById)).toEqual(['valid-session'])
  })

  it('rejects malformed active games and clears their detached projection', async () => {
    const source = createGameStore('v4-invalid-game-source', () => 0, localStorage, () => 1_000, () => 'invalid-session')
    source.getState().createSession('Invalid')
    source.getState().startGame(setup)
    const invalid = structuredClone(source.getState().sessionsById['invalid-session'])
    invalid.currentGame!.players[0].id = 'detached-player'
    localStorage.setItem('v4-invalid-game', JSON.stringify({
      state: {
        sessionsById: { 'invalid-session': invalid },
        activeSessionId: 'invalid-session',
        setup,
        game: source.getState().game,
      },
      version: 4,
    }))

    const restored = createGameStore('v4-invalid-game', () => 0)
    await restored.persist.rehydrate()

    expect(restored.getState().sessionsById).toEqual({})
    expect(restored.getState().activeSessionId).toBeNull()
    expect(restored.getState().setup).toBeNull()
    expect(restored.getState().game).toBeNull()
  })

  it('derives the active game from the validated session instead of a detached persisted copy', async () => {
    const source = createGameStore('v4-canonical-source', () => 0, localStorage, () => 1_000, () => 'valid-session')
    source.getState().createSession('Valid')
    source.getState().startGame(setup)
    const session = source.getState().sessionsById['valid-session']
    localStorage.setItem('v4-canonical-session', JSON.stringify({
      state: {
        sessionsById: { 'valid-session': session },
        activeSessionId: 'valid-session',
        setup: { ...setup, playerNames: ['Wrong', 'Names', 'Here'] },
        game: { ...source.getState().game, phase: 'GAME_OVER', voteResult: null },
      },
      version: 4,
    }))

    const restored = createGameStore('v4-canonical-session', () => 0)
    await restored.persist.rehydrate()

    expect(restored.getState().setup?.playerNames).toEqual(['Alex', 'Blair', 'Casey'])
    expect(restored.getState().game?.phase).toBe('ROLE_REVEAL')
  })

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
    expect(store.getState().pendingVote).toEqual(['player-2'])

    store.getState().confirmVote()
    expect(store.getState().game?.votes).toEqual([
      { voterId: 'player-1', targetId: 'player-2' },
    ])
    expect(store.getState().isVoteReady).toBe(false)
  })

  it('allows a private voter to select two targets in a two-impostor round', () => {
    const store = createGameStore('two-private-vote-flow', () => 0)
    store.getState().startGame({ ...setup, impostorCount: 2 })
    store.getState().confirmRole()
    store.getState().confirmRole()
    store.getState().confirmRole()
    store.getState().beginVoting()
    store.getState().showVote()
    store.getState().castVote('player-2')
    store.getState().castVote('player-3')

    expect(store.getState().pendingVote).toEqual(['player-2', 'player-3'])
    store.getState().castVote('player-1')
    expect(store.getState().pendingVote).toEqual(['player-2', 'player-3'])
  })

  it('starts Group Vote ready without a pass-device handoff', () => {
    const store = createGameStore('absolute-vote-flow', () => 0)
    store.getState().startGame({ ...setup, impostorCount: 2, absoluteVotingEnabled: true })
    store.getState().confirmRole()
    store.getState().confirmRole()
    store.getState().confirmRole()
    store.getState().beginVoting()

    expect(store.getState().game?.absoluteVotingEnabled).toBe(true)
    expect(store.getState().isVoteReady).toBe(true)
    store.getState().castVote('player-2')
    store.getState().castVote('player-3')
    store.getState().confirmVote()

    expect(store.getState().game?.phase).toBe('GAME_OVER')
    expect(store.getState().game?.voteResult?.eliminatedPlayerIds).toEqual(['player-2', 'player-3'])
    expect(store.getState().isVoteReady).toBe(false)
  })

  it('switches an in-progress private ballot to Group Vote and resets prior votes', () => {
    const store = createGameStore('absolute-switch-flow', () => 0)
    store.getState().startGame(setup)
    store.getState().confirmRole()
    store.getState().confirmRole()
    store.getState().confirmRole()
    store.getState().beginVoting()
    store.getState().showVote()
    store.getState().castVote('player-2')
    store.getState().confirmVote()

    store.getState().enableAbsoluteVoting()

    expect(store.getState().game?.absoluteVotingEnabled).toBe(true)
    expect(store.getState().game?.votes).toEqual([])
    expect(store.getState().game?.currentVoterIndex).toBe(0)
    expect(store.getState().isVoteReady).toBe(true)
  })

  it('replays with Group Vote when the result shortcut is used', () => {
    const store = createGameStore('absolute-replay', () => 0)
    store.getState().startGame(setup)
    store.getState().playAgain({ absoluteVotingEnabled: true })

    expect(store.getState().game).toMatchObject({
      phase: 'ROLE_REVEAL',
      round: 2,
      absoluteVotingEnabled: true,
    })
    expect(store.getState().setup?.absoluteVotingEnabled).toBe(true)
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

  it('collects a private Outlier guess after voting and before game over', () => {
    const store = createGameStore('outlier-flow', () => 0)
    store.getState().startGame({
      ...setup,
      playerNames: ['Alex', 'Blair', 'Casey', 'Devon'],
      outlierEnabled: true,
    })
    for (let index = 0; index < 4; index += 1) store.getState().confirmRole()
    store.getState().beginVoting()

    for (const target of ['player-2', 'player-1', 'player-2', 'player-2']) {
      store.getState().showVote()
      store.getState().castVote(target)
      store.getState().confirmVote()
    }

    expect(store.getState().game?.phase).toBe('OUTLIER_GUESS')
    expect(store.getState().isOutlierGuessReady).toBe(false)
    store.getState().showOutlierGuess()
    store.getState().setOutlierGuess(' moon ')
    expect(store.getState().game?.outlierGuesses).toEqual([])
    store.getState().confirmOutlierGuess()

    expect(store.getState().game?.phase).toBe('GAME_OVER')
    expect(store.getState().game?.outlierGuesses).toEqual([
      { playerId: 'player-3', guess: 'moon', isCorrect: true },
    ])
    expect(store.getState().pendingOutlierGuess).toBe('')
    expect(store.getState().isOutlierGuessReady).toBe(false)
  })

  it('masks and clears an unfinished Outlier guess after hydration', async () => {
    const store = createGameStore('private-outlier-guess', () => 0)
    store.getState().startGame({
      ...setup,
      playerNames: ['Alex', 'Blair', 'Casey', 'Devon'],
      outlierEnabled: true,
    })
    store.getState().confirmRole(); store.getState().confirmRole(); store.getState().confirmRole(); store.getState().confirmRole()
    store.getState().beginVoting()
    for (const targetId of ['player-2', 'player-1', 'player-2', 'player-2']) {
      store.getState().showVote()
      store.getState().castVote(targetId)
      store.getState().confirmVote()
    }
    store.getState().showOutlierGuess()
    store.getState().setOutlierGuess('Moon')

    const restored = createGameStore('private-outlier-guess', () => 0)
    await restored.persist.rehydrate()

    expect(restored.getState().game?.phase).toBe('OUTLIER_GUESS')
    expect(restored.getState().isOutlierGuessReady).toBe(false)
    expect(restored.getState().pendingOutlierGuess).toBe('')
  })

  it('masks and clears an unfinished Outlier guess when privacy is lost', () => {
    const store = createGameStore('mask-outlier-guess', () => 0)
    store.getState().startGame({
      ...setup,
      playerNames: ['Alex', 'Blair', 'Casey', 'Devon'],
      outlierEnabled: true,
    })
    store.setState((state) => ({
      game: state.game ? { ...state.game, phase: 'OUTLIER_GUESS' } : null,
    }))
    store.getState().showOutlierGuess()
    store.getState().setOutlierGuess('Moon')

    store.getState().hideOutlierGuess()

    expect(store.getState().isOutlierGuessReady).toBe(false)
    expect(store.getState().pendingOutlierGuess).toBe('')
  })

  it('migrates version 1 rounds with special roles disabled', async () => {
    const legacySetup = {
      playerNames: setup.playerNames,
      impostorCount: setup.impostorCount,
      pack: setup.pack,
      hintsEnabled: setup.hintsEnabled,
      discussionDurationSeconds: setup.discussionDurationSeconds,
    }
    const legacyGame = createGameStore('legacy-source', () => 0).getState()
    const source = createGameStore('legacy-round', () => 0)
    source.getState().startGame(setup)
    const game = source.getState().game!
    const legacyRound = structuredClone(game) as unknown as Record<string, unknown>
    for (const field of [
      'jesterEnabled',
      'outlierEnabled',
      'outlierHintsEnabled',
      'currentOutlierGuessIndex',
      'outlierGuesses',
    ]) delete legacyRound[field]
    expect(legacyGame.game).toBeNull()
    localStorage.setItem('legacy-migration', JSON.stringify({
      state: { setup: legacySetup, game: legacyRound, lobbyIntent: 'default' },
      version: 1,
    }))

    const restored = createGameStore('legacy-migration', () => 0)
    await restored.persist.rehydrate()

    expect(restored.getState().setup).toMatchObject({
      jesterEnabled: false,
      outlierEnabled: false,
      outlierHintsEnabled: false,
    })
    expect(restored.getState().game).toMatchObject({
      jesterEnabled: false,
      outlierEnabled: false,
      outlierHintsEnabled: false,
      currentOutlierGuessIndex: 0,
      outlierGuesses: [],
    })
  })

  it('migrates version 2 rounds to private voting when the mode is missing', async () => {
    const source = createGameStore('absolute-v2-source', () => 0)
    source.getState().startGame(setup)
    const legacyRound = structuredClone(source.getState().game!) as unknown as Record<string, unknown>
    delete legacyRound.absoluteVotingEnabled
    const legacySetup = structuredClone(setup) as unknown as Record<string, unknown>
    delete legacySetup.absoluteVotingEnabled
    localStorage.setItem('absolute-v2-migration', JSON.stringify({
      state: { setup: legacySetup, game: legacyRound, lobbyIntent: 'default' },
      version: 2,
    }))

    const restored = createGameStore('absolute-v2-migration', () => 0)
    await restored.persist.rehydrate()

    expect(restored.getState().setup?.absoluteVotingEnabled).toBe(false)
    expect(restored.getState().game?.absoluteVotingEnabled).toBe(false)
  })

  it('drops a malformed legacy round while preserving its editable setup', async () => {
    const legacySetup = {
      playerNames: setup.playerNames,
      impostorCount: setup.impostorCount,
      pack: setup.pack,
      hintsEnabled: setup.hintsEnabled,
      discussionDurationSeconds: setup.discussionDurationSeconds,
    }
    localStorage.setItem('malformed-legacy', JSON.stringify({
      state: {
        setup: legacySetup,
        game: {
          phase: 'SECRET_ALIEN_PHASE',
          players: [{ id: 'player-1', name: 'Alex', role: 'ALIEN', hasViewedRole: false }],
        },
        lobbyIntent: 'default',
      },
      version: 1,
    }))

    const restored = createGameStore('malformed-legacy', () => 0)
    await restored.persist.rehydrate()

    expect(restored.getState().game).toBeNull()
    expect(restored.getState().setup).toMatchObject({
      playerNames: setup.playerNames,
      jesterEnabled: false,
      outlierEnabled: false,
    })
  })

  it('drops legacy rounds with unsafe phase-specific state instead of hydrating a crash', async () => {
    const source = createGameStore('unsafe-legacy-source', () => 0)
    source.getState().startGame(setup)
    const current = source.getState().game!
    const legacyRound = structuredClone(current) as unknown as Record<string, unknown>
    for (const field of [
      'jesterEnabled',
      'outlierEnabled',
      'outlierHintsEnabled',
      'currentOutlierGuessIndex',
      'outlierGuesses',
    ]) delete legacyRound[field]

    const unsafeRounds: Record<string, unknown>[] = [
      { ...legacyRound, phase: 'ROLE_REVEAL', currentRevealIndex: 99 },
      { ...legacyRound, phase: 'GAME_OVER', voteResult: null },
      { phase: 'VOTING', players: legacyRound.players },
      { ...legacyRound, players: [null] },
    ]

    for (const [index, game] of unsafeRounds.entries()) {
      const storageName = `unsafe-legacy-${index}`
      localStorage.setItem(storageName, JSON.stringify({
        state: { setup: { ...setup }, game, lobbyIntent: 'default' },
        version: 1,
      }))
      const restored = createGameStore(storageName, () => 0)
      await restored.persist.rehydrate()
      expect(restored.getState().game, `unsafe legacy case ${index}`).toBeNull()
      expect(restored.getState().setup?.playerNames).toEqual(setup.playerNames)
    }
  })

  it('normalizes invalid persisted role settings to safe disabled defaults', async () => {
    localStorage.setItem('invalid-role-settings', JSON.stringify({
      state: {
        setup: {
          ...setup,
          jesterEnabled: 'false',
          outlierEnabled: 1,
          outlierHintsEnabled: null,
        },
        game: null,
        lobbyIntent: 'default',
      },
      version: 2,
    }))

    const restored = createGameStore('invalid-role-settings', () => 0)
    await restored.persist.rehydrate()

    expect(restored.getState().setup).toMatchObject({
      jesterEnabled: false,
      outlierEnabled: false,
      outlierHintsEnabled: false,
    })
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
