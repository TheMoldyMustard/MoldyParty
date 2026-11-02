function App() {
  return (
    <main className="app-shell">
      <header className="brand-lockup">
        <span className="eyebrow">Pass it. Bluff it. Find them.</span>
        <h1>MoldyParty</h1>
        <p>Offline party games made for one shared screen.</p>
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
          <button type="button">Set up a round <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <footer>Built for 3+ suspicious friends</footer>
    </main>
  )
}

export default App
