import { useMemo, useState } from 'react'
import { buildAiPackPrompt } from './aiPrompt'

export default function AiPromptHelper() {
  const [topic, setTopic] = useState('')
  const [game, setGame] = useState<'impostor' | 'charades'>('impostor')
  const [charadesMode, setCharadesMode] = useState<'classic' | 'henyo' | 'one-word' | 'team-relay'>('classic')
  const [copied, setCopied] = useState(false)
  const prompt = useMemo(
    () => buildAiPackPrompt(topic, { game, mode: game === 'charades' ? charadesMode : undefined }),
    [charadesMode, game, topic],
  )

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2400)
  }

  return (
    <aside className="ai-helper" aria-labelledby="ai-helper-title">
      <div>
        <span className="eyebrow">Bring your own AI</span>
        <h3 id="ai-helper-title">Generate a ready-to-import pack</h3>
        <p>Copy a precise prompt for ChatGPT, Gemini, or Claude.</p>
      </div>
      <label>Game format<select aria-label="Game format" value={game} onChange={(event) => { setGame(event.target.value as 'impostor' | 'charades'); setCopied(false) }}>
        <option value="impostor">Impostor</option>
        <option value="charades">Forehead Charades</option>
      </select></label>
      {game === 'charades' && <label>Charades mode<select aria-label="Charades mode" value={charadesMode} onChange={(event) => { setCharadesMode(event.target.value as typeof charadesMode); setCopied(false) }}>
        <option value="classic">Classic</option>
        <option value="henyo">Henyo</option>
        <option value="one-word">One-Word</option>
        <option value="team-relay">Team Relay</option>
      </select></label>}
      <label>Pack topic<input aria-label="Pack topic" value={topic} placeholder="e.g. Valorant Agents" onChange={(event) => { setTopic(event.target.value); setCopied(false) }} /></label>
      <button className="button" type="button" onClick={() => void copyPrompt()}>Copy AI prompt</button>
      {copied && <span className="copy-status" role="status">Prompt copied</span>}
    </aside>
  )
}
