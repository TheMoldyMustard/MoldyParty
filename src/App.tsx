import { useEffect, useState, type ReactNode } from 'react'
import AbortGameDialog from './features/game/AbortGameDialog'
import InstallPrompt from './components/InstallPrompt'
import UpdatePrompt from './components/UpdatePrompt'
import DiscussionScreen from './features/game/DiscussionScreen'
import GameOverScreen from './features/game/GameOverScreen'
import LobbyScreen, { type LobbyDraft } from './features/game/LobbyScreen'
import OutlierGuessScreen from './features/game/OutlierGuessScreen'
import RoleRevealScreen from './features/game/RoleRevealScreen'
import SessionManagerScreen from './features/game/SessionManagerScreen'
import VotingScreen from './features/game/VotingScreen'
import PackManager from './features/packs/PackManager'
import { gameStore, useGameStore } from './store/gameStore'
import CharadesGame from './features/charades/CharadesGame'
import CharadesSetupScreen from './features/charades/CharadesSetupScreen'
import CharadesSessionManagerScreen from './features/charades/CharadesSessionManagerScreen'
import { appStore, resolveActiveGame, useAppStore } from './store/appStore'
import { charadesStore, useCharadesStore } from './store/charadesStore'
import CategoryBombSetupScreen from './features/category-bomb/CategoryBombSetupScreen'
import CategoryBombGame from './features/category-bomb/CategoryBombGame'
import CategoryBombSessionManagerScreen from './features/category-bomb/CategoryBombSessionManagerScreen'
import { categoryBombStore, useCategoryBombStore } from './store/categoryBombStore'
import type { CategoryBombTurnPolicy } from './domain/categoryBomb'
import RouletteScreen from './features/roulette/RouletteScreen'
import { createRouletteRosterOptions } from './features/roulette/sessionRosters'

type AppView = 'home' | 'sessions' | 'lobby' | 'packs' | 'charades-sessions' | 'charades' | 'charades-packs' | 'category-bomb-sessions' | 'category-bomb' | 'roulette'
type CategoryBombDraft = {
  playerNames: string[]
  turnPolicy: CategoryBombTurnPolicy
  passTimeBonusEnabled: boolean
  passTimeBonusMinSeconds: number
  passTimeBonusMaxSeconds: number
}

function AppContent() {
  const [view, setView] = useState<AppView>('home')
  const [lobbyDraft, setLobbyDraft] = useState<LobbyDraft | null>(null)
  const [preferredPackId, setPreferredPackId] = useState<string | null>(null)
  const [preferredCharadesPackId, setPreferredCharadesPackId] = useState<string | null>(null)
  const [lobbyNotice, setLobbyNotice] = useState('')
  const [categoryBombDraft, setCategoryBombDraft] = useState<CategoryBombDraft | null>(null)
  const [categoryBombRecoveryNotice, setCategoryBombRecoveryNotice] = useState('')
  const [charadesRecoveryNotice, setCharadesRecoveryNotice] = useState('')
  const game = useGameStore((state) => state.game)
  const changeCategory = useGameStore((state) => state.changeCategory)
  const returnToLobby = useGameStore((state) => state.returnToLobby)
  const abortGame = useGameStore((state) => state.abortGame)
  const createSession = useGameStore((state) => state.createSession)
  const continueSession = useGameStore((state) => state.continueSession)
  const activeSessionId = useGameStore((state) => state.activeSessionId)
  const impostorSessions = useGameStore((state) => state.sessionsById)
  const charadesSession = useCharadesStore((state) => state.session)
  const charadesSessions = useCharadesStore((state) => state.sessionsById)
  const charadesSessionId = useCharadesStore((state) => state.activeSessionId)
  const createCharadesSession = useCharadesStore((state) => state.createSession)
  const continueCharadesSession = useCharadesStore((state) => state.continueSession)
  const activeCharadesSession = charadesSessionId ? charadesSessions[charadesSessionId] : null
  const categoryBombRound = useCategoryBombStore((state) => state.round)
  const categoryBombSessions = useCategoryBombStore((state) => state.sessionsById)
  const categoryBombSessionId = useCategoryBombStore((state) => state.activeSessionId)
  const createCategoryBombSession = useCategoryBombStore((state) => state.createSession)
  const continueCategoryBombSession = useCategoryBombStore((state) => state.continueSession)
  const activeCategoryBombSession = categoryBombSessionId ? categoryBombSessions[categoryBombSessionId] : null
  const explicitActiveGame = useAppStore((state) => state.activeGameId)
  const activeGame = resolveActiveGame(explicitActiveGame, game !== null, charadesSession !== null, categoryBombRound !== null)
  const rouletteRosterOptions = createRouletteRosterOptions([
    { gameId: 'impostor', gameLabel: 'Impostor', sessions: impostorSessions },
    { gameId: 'charades', gameLabel: 'Forehead Charades', sessions: charadesSessions },
    { gameId: 'category-bomb', gameLabel: 'Category Bomb', sessions: categoryBombSessions },
  ])

  useEffect(() => {
    if (view !== 'home') return
    if (explicitActiveGame === 'charades' && !charadesSession) {
      const timeout = window.setTimeout(() => {
        setCharadesRecoveryNotice('The unfinished Charades game could not be recovered. Your saved session and completed statistics are still available.')
        appStore.getState().setActiveGame(null)
        setView('charades-sessions')
      }, 0)
      return () => window.clearTimeout(timeout)
    } else if (explicitActiveGame === 'category-bomb' && !categoryBombRound) {
      const timeout = window.setTimeout(() => {
        setCategoryBombRecoveryNotice('The unfinished Category Bomb round could not be recovered. Your saved session and completed statistics are still available.')
        appStore.getState().setActiveGame(null)
        setView('category-bomb-sessions')
      }, 0)
      return () => window.clearTimeout(timeout)
    }
  }, [categoryBombRound, charadesSession, explicitActiveGame, view])

  if (activeGame === 'charades' && charadesSession) return <CharadesGame onExit={() => setView('charades-sessions')} />
  if (activeGame === 'category-bomb' && categoryBombRound) return <CategoryBombGame
    onExit={() => { categoryBombStore.getState().reset(); appStore.getState().setActiveGame(null); setCategoryBombDraft(null); setView('category-bomb-sessions') }}
    onSetup={() => {
      const round = categoryBombStore.getState().round
      if (round) setCategoryBombDraft({
        playerNames: round.settings.players.map((player) => player.name),
        turnPolicy: round.settings.turnPolicy,
        passTimeBonusEnabled: round.settings.passTimeBonusEnabled,
        passTimeBonusMinSeconds: round.settings.passTimeBonusMinMs / 1_000,
        passTimeBonusMaxSeconds: round.settings.passTimeBonusMaxMs / 1_000,
      })
      categoryBombStore.getState().editSetup()
      appStore.getState().setActiveGame(null)
      setView('category-bomb')
    }}
  />

  if (activeGame === 'impostor' && game?.phase === 'GAME_OVER') return <GameOverScreen
    onChangeCategory={() => { changeCategory(); setLobbyDraft(null); setView('lobby') }}
    onReturnToSessions={() => { returnToLobby(); setView('sessions') }}
  />

  let activeGameScreen: ReactNode = null
  if (activeGame === 'impostor' && game?.phase === 'ROLE_REVEAL') activeGameScreen = <RoleRevealScreen key={game.currentRevealIndex} />
  if (activeGame === 'impostor' && game?.phase === 'DISCUSSION') activeGameScreen = <DiscussionScreen />
  if (activeGame === 'impostor' && game?.phase === 'VOTING') activeGameScreen = <VotingScreen />
  if (activeGame === 'impostor' && game?.phase === 'OUTLIER_GUESS') activeGameScreen = <OutlierGuessScreen />
  if (activeGameScreen) return <>
    {activeGameScreen}
    <AbortGameDialog onConfirm={() => { abortGame(); setView('sessions') }} />
  </>

  if (view === 'roulette') return <RouletteScreen rosterOptions={rouletteRosterOptions} onBack={() => setView('home')} />

  if (view === 'sessions') return <SessionManagerScreen
    onBack={() => { appStore.getState().setActiveGame(null); setView('home') }}
    onCreate={(name) => { createSession(name); setLobbyDraft(null); setView('lobby') }}
    onContinue={(sessionId) => {
      continueSession(sessionId)
      if (!gameStore.getState().game) setView('lobby')
    }}
  />
  if (view === 'lobby') return <LobbyScreen draft={lobbyDraft} preferredPackId={preferredPackId} onPreferredPackApplied={() => setPreferredPackId(null)} notice={lobbyNotice} onDraftChange={setLobbyDraft} onBack={() => setView('sessions')} onManagePacks={() => setView('packs')} rosterLocked={activeSessionId !== null} />
  if (view === 'packs') return <main className="screen"><nav className="topbar"><button className="text-button" onClick={() => setView('lobby')}>← Back to setup</button></nav><PackManager onImported={(packId) => { setPreferredPackId(packId); setLobbyNotice('Pack imported and ready in your round.'); setView('lobby') }} /></main>
  if (view === 'charades-sessions') return <CharadesSessionManagerScreen
    notice={charadesRecoveryNotice}
    onBack={() => { appStore.getState().setActiveGame(null); setView('home') }}
    onCreate={(name) => { setCharadesRecoveryNotice(''); createCharadesSession(name); setView('charades') }}
    onContinue={(sessionId) => {
      continueCharadesSession(sessionId)
      const record = charadesStore.getState().sessionsById[sessionId]
      if (!record) {
        setCharadesRecoveryNotice('That Charades session is no longer available on this browser.')
        return
      }
      setCharadesRecoveryNotice('')
      if (record.currentGame) appStore.getState().setActiveGame('charades')
      else setView('charades')
    }}
  />
  if (view === 'charades') return <CharadesSetupScreen
    preferredPackId={preferredCharadesPackId}
    initialSettings={activeCharadesSession?.setup}
    initialPlayers={activeCharadesSession?.players}
    rosterLocked={Boolean(activeCharadesSession?.players.length)}
    legacyTrackingNotice={Boolean(activeCharadesSession && !activeCharadesSession.trackingEnabled)}
    onBack={() => {
      charadesStore.setState({ session: null, activeSessionId: null, pendingSessionName: null })
      appStore.getState().setActiveGame(null)
      setView('charades-sessions')
    }}
    onManagePacks={() => setView('charades-packs')}
  />
  if (view === 'charades-packs') return <main className="screen"><nav className="topbar"><button className="text-button" onClick={() => setView('charades')}>← Back to Charades</button></nav><PackManager onImported={(packId) => { setPreferredCharadesPackId(packId); setView('charades') }} /></main>
  if (view === 'category-bomb-sessions') return <CategoryBombSessionManagerScreen
    notice={categoryBombRecoveryNotice}
    onBack={() => { appStore.getState().setActiveGame(null); setView('home') }}
    onCreate={(name) => { setCategoryBombRecoveryNotice(''); createCategoryBombSession(name); setCategoryBombDraft(null); setView('category-bomb') }}
    onContinue={(sessionId) => {
      continueCategoryBombSession(sessionId)
      const session = categoryBombStore.getState().sessionsById[sessionId]
      if (!session) {
        setCategoryBombRecoveryNotice('That Category Bomb session is no longer available on this browser.')
        return
      }
      setCategoryBombRecoveryNotice('')
      if (!session?.currentRound) {
        setCategoryBombDraft(session ? {
          playerNames: session.players.map((player) => player.name),
          turnPolicy: session.setup.turnPolicy,
          passTimeBonusEnabled: session.setup.passTimeBonusEnabled,
          passTimeBonusMinSeconds: session.setup.passTimeBonusMinMs / 1_000,
          passTimeBonusMaxSeconds: session.setup.passTimeBonusMaxMs / 1_000,
        } : null)
        setView('category-bomb')
      } else {
        appStore.getState().setActiveGame('category-bomb')
      }
    }}
  />
  if (view === 'category-bomb') return <CategoryBombSetupScreen
    initialPlayerNames={categoryBombDraft?.playerNames ?? activeCategoryBombSession?.players.map((player) => player.name)}
    initialTurnPolicy={categoryBombDraft?.turnPolicy ?? activeCategoryBombSession?.setup.turnPolicy}
    initialPassTimeBonusEnabled={categoryBombDraft?.passTimeBonusEnabled ?? activeCategoryBombSession?.setup.passTimeBonusEnabled}
    initialPassTimeBonusMinSeconds={categoryBombDraft?.passTimeBonusMinSeconds ?? (activeCategoryBombSession ? activeCategoryBombSession.setup.passTimeBonusMinMs / 1_000 : undefined)}
    initialPassTimeBonusMaxSeconds={categoryBombDraft?.passTimeBonusMaxSeconds ?? (activeCategoryBombSession ? activeCategoryBombSession.setup.passTimeBonusMaxMs / 1_000 : undefined)}
    rosterLocked={Boolean(activeCategoryBombSession)}
    onBack={() => {
      categoryBombStore.setState({ round: null, activeSessionId: null, pendingSessionName: null })
      appStore.getState().setActiveGame(null)
      setCategoryBombDraft(null)
      setView('category-bomb-sessions')
    }}
  />

  return (
    <main className="app-shell">
      <header className="brand-lockup">
        <span className="eyebrow">Offline party games for suspicious friends</span>
        <h1>MoldyParty</h1>
        <p>Pick a game, pass the device, and make your own fun anywhere.</p>
      </header>

      <section className="game-card" aria-labelledby="impostor-title">
        <div className="game-card__art" aria-hidden="true">
          <span className="spore spore--one" />
          <span className="spore spore--two" />
          <span className="game-card__eye">◉</span>
        </div>
        <div className="game-card__content">
          <span className="pill">Launch game</span>
          <h2 id="impostor-title">Impostor</h2>
          <p>Find the impostors before they blend in.</p>
          <button type="button" onClick={() => { appStore.getState().setActiveGame('impostor'); setView('sessions') }}>Open Impostor <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section className="game-card game-card--charades" aria-labelledby="charades-title">
        <div className="game-card__art" aria-hidden="true"><span className="game-card__eye">↕</span></div>
        <div className="game-card__content">
          <span className="pill">New game</span>
          <h2 id="charades-title">Forehead Charades</h2>
          <p>Tilt, tap, guess, and pass through four party-ready modes.</p>
          <button type="button" onClick={() => { appStore.getState().setActiveGame('charades'); setView('charades-sessions') }}>Open Forehead Charades <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section className="game-card game-card--category-bomb" aria-labelledby="category-bomb-title">
        <div className="game-card__art" aria-hidden="true"><span className="game-card__eye">💣</span></div>
        <div className="game-card__content">
          <span className="pill">New game</span>
          <h2 id="category-bomb-title">Category Bomb</h2>
          <p>Name it, tap it, and pass before the hidden timer explodes.</p>
          <button type="button" onClick={() => { setCategoryBombDraft(null); appStore.getState().setActiveGame('category-bomb'); setView('category-bomb-sessions') }}>Open Category Bomb <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section className="game-card game-card--roulette" aria-labelledby="roulette-title">
        <div className="game-card__art" aria-hidden="true"><span className="game-card__eye">◌</span></div>
        <div className="game-card__content">
          <span className="pill">Quick picker</span>
          <h2 id="roulette-title">Name Roulette</h2>
          <p>Add names or borrow a saved session, then let the wheel choose.</p>
          <button type="button" onClick={() => setView('roulette')}>Open Name Roulette <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <footer>Built for pass-the-device parties</footer>
    </main>
  )
}

function App() {
  return <><AppContent /><InstallPrompt /><UpdatePrompt /></>
}

export default App
