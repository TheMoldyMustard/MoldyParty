interface PassDeviceMaskProps {
  playerName: string
  eyebrow: string
  actionLabel: string
  onReady: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  round?: number
}

export default function PassDeviceMask({ playerName, eyebrow, actionLabel, onReady, secondaryActionLabel, onSecondaryAction, round }: PassDeviceMaskProps) {
  return (
    <main className="screen private-screen">
      <div className="private-screen__orb" aria-hidden="true">◉</div>
      {round && <span className="round-badge">Round {round}</span>}
      <span className="eyebrow">{eyebrow}</span>
      <h1>Pass to {playerName}</h1>
      <p>Keep the screen facing down until they have the device.</p>
      <button className="button button--hero" type="button" onClick={onReady}>{actionLabel}</button>
      {secondaryActionLabel && onSecondaryAction && <button className="button button--secondary" type="button" onClick={onSecondaryAction}>{secondaryActionLabel}</button>}
    </main>
  )
}
