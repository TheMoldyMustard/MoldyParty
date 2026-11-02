import { useMemo, useState } from 'react'
import { buildAiPackPrompt } from './aiPrompt'

export default function AiPromptHelper() {
  const [topic, setTopic] = useState('')
  const [copied, setCopied] = useState(false)
  const prompt = useMemo(() => buildAiPackPrompt(topic), [topic])

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
      <label>Pack topic<input aria-label="Pack topic" value={topic} placeholder="e.g. Valorant Agents" onChange={(event) => { setTopic(event.target.value); setCopied(false) }} /></label>
      <button className="button" type="button" onClick={() => void copyPrompt()}>Copy AI prompt</button>
      {copied && <span className="copy-status" role="status">Prompt copied</span>}
    </aside>
  )
}
