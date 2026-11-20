import { useState, type ReactNode } from 'react'
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
import { appStore, resolveActiveGame, useAppStore } from './store/appStore'
import { useCharadesStore } from './store/charadesStore'
import CategoryBombSetupScreen from './features/category-bomb/CategoryBombSetupScreen'
import CategoryBombGame from './features/category-bomb/CategoryBombGame'
import { categoryBombStore, useCategoryBombStore } from './store/categoryBombStore'
import type { CategoryBombTurnPolicy } from './domain/categoryBomb'

type AppView = 'home' | 'sessions' | 'lobby' | 'packs' | 'charades' | 'charades-packs' | 'category-bomb'
type CategoryBombDraft = { playerNames: string[]; turnPolicy: CategoryBombTurnPolicy }

function AppContent() {
  const [view, setView] = useState<AppView>('home')
  const [lobbyDraft, setLobbyDraft] = useState<LobbyDraft | null>(null)
  const [preferredPackId, setPreferredPackId] = useState<string | null>(null)
  const [preferredCharadesPackId, setPreferredCharadesPackId] = useState<string | null>(null)
  const [lobbyNotice, setLobbyNotice] = useState('')
  const [categoryBombDraft, setCategoryBombDraft] = useState<CategoryBombDraft | null>(null)
  const game = useGameStore((state) => state.game)
  const changeCategory = useGameStore((state) => state.changeCategory)
  const returnToLobby = useGameStore((state) => state.returnToLobby)
  const abortGame = useGameStore((state) => state.abortGame)
  const createSession = useGameStore((state) => state.createSession)
  const continueSession = useGameStore((state) => state.continueSession)
  const activeSessionId = useGameStore((state) => state.activeSessionId)
  const charadesSession = useCharadesStore((state) => state.session)
  const categoryBombRound = useCategoryBombStore((state) => state.round)
  const explicitActiveGame = useAppStore((state) => state.activeGameId)
  const activeGame = resolveActiveGame(explicitActiveGame, game !== null, charadesSession !== null, categoryBombRound !== null)

  if (activeGame === 'charades' && charadesSession) return <CharadesGame onExit={() => setView('home')} />
  if (activeGame === 'category-bomb' && categoryBombRound) return <CategoryBombGame
    onExit={() => { categoryBombStore.getState().reset(); appStore.getState().setActiveGame(null); setCategoryBombDraft(null); setView('home') }}
    onSetup={() => {
      const round = categoryBombStore.getState().round
      if (round) setCategoryBombDraft({ playerNames: round.settings.players.map((player) => player.name), turnPolicy: round.settings.turnPolicy })
      categoryBombStore.getState().reset()
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
  if (view === 'charades') return <CharadesSetupScreen preferredPackId={preferredCharadesPackId} onBack={() => { appStore.getState().setActiveGame(null); setView('home') }} onManagePacks={() => setView('charades-packs')} />
  if (view === 'charades-packs') return <main className="screen"><nav className="topbar"><button className="text-button" onClick={() => setView('charades')}>← Back to Charades</button></nav><PackManager onImported={(packId) => { setPreferredCharadesPackId(packId); setView('charades') }} /></main>
  if (view === 'category-bomb') return <CategoryBombSetupScreen
    initialPlayerNames={categoryBombDraft?.playerNames}
    initialTurnPolicy={categoryBombDraft?.turnPolicy}
    onBack={() => { appStore.getState().setActiveGame(null); setCategoryBombDraft(null); setView('home') }}
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
          <button type="button" onClick={() => { appStore.getState().setActiveGame('charades'); setView('charades') }}>Open Forehead Charades <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section className="game-card game-card--category-bomb" aria-labelledby="category-bomb-title">
        <div className="game-card__art" aria-hidden="true"><span className="game-card__eye">💣</span></div>
        <div className="game-card__content">
          <span className="pill">New game</span>
          <h2 id="category-bomb-title">Category Bomb</h2>
          <p>Name it, tap it, and pass before the hidden timer explodes.</p>
          <button type="button" onClick={() => { setCategoryBombDraft(null); appStore.getState().setActiveGame('category-bomb'); setView('category-bomb') }}>Open Category Bomb <span aria-hidden="true">→</span></button>
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
