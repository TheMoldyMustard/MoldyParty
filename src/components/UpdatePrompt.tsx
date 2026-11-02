import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <aside className="pwa-toast" aria-label="App update available">
      <div><strong>A fresh batch is ready</strong><span>Update when no round is in progress.</span></div>
      <button className="button" type="button" onClick={() => void updateServiceWorker(true)}>Update</button>
      <button className="icon-button" type="button" aria-label="Dismiss update" onClick={() => setNeedRefresh(false)}>×</button>
    </aside>
  )
}
