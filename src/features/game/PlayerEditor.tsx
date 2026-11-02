interface PlayerEditorProps {
  names: string[]
  onChange: (names: string[]) => void
}

export default function PlayerEditor({ names, onChange }: PlayerEditorProps) {
  return (
    <section className="setup-section" aria-labelledby="players-title">
      <div className="section-heading">
        <div><span className="step-number">01</span><h2 id="players-title">Who’s playing?</h2></div>
        <span className="muted">3 minimum</span>
      </div>
      <div className="player-list">
        {names.map((name, index) => (
          <div className="player-input" key={index}>
            <span className="player-number" aria-hidden="true">{index + 1}</span>
            <label className="sr-only" htmlFor={`player-${index}`}>Player {index + 1} name</label>
            <input
              id={`player-${index}`}
              value={name}
              placeholder={`Player ${index + 1}`}
              autoComplete="off"
              onChange={(event) => onChange(names.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
            />
            {names.length > 3 && (
              <button
                className="icon-button"
                type="button"
                aria-label={`Remove player ${index + 1}`}
                onClick={() => onChange(names.filter((_, itemIndex) => itemIndex !== index))}
              >×</button>
            )}
          </div>
        ))}
      </div>
      <button className="button button--secondary button--wide" type="button" onClick={() => onChange([...names, ''])}>
        <span aria-hidden="true">＋</span> Add player
      </button>
    </section>
  )
}
