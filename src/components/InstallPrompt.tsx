import { useEffect, useState } from 'react'
import { usePreferencesStore } from '../store/preferencesStore'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function InstallPrompt() {
  const dismissed = usePreferencesStore((state) => state.installPromptDismissed)
  const dismiss = usePreferencesStore((state) => state.dismissInstallPrompt)
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    function capture(installEvent: Event) {
      installEvent.preventDefault()
      setEvent(installEvent as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', capture)
    return () => window.removeEventListener('beforeinstallprompt', capture)
  }, [])

  if (!event || dismissed) return null

  async function install() {
    if (!event) return
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'accepted') setEvent(null)
  }

  return (
    <aside className="pwa-toast" aria-label="Install MoldyParty">
      <div><strong>Keep the party ready</strong><span>Install MoldyParty for instant offline play.</span></div>
      <button className="button" type="button" onClick={() => void install()}>Install</button>
      <button className="icon-button" type="button" aria-label="Dismiss install prompt" onClick={dismiss}>×</button>
    </aside>
  )
}
