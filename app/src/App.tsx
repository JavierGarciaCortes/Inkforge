import { useEffect, useState } from 'react'
import './App.css'
import { AppHeader } from './components/AppHeader'
import { DocumentWorkspace } from './components/DocumentWorkspace'
import { EditorPanel } from './components/EditorPanel'
import { Sidebar } from './components/Sidebar'

function App() {
  const [appInfo, setAppInfo] = useState<InkforgeAppInfo | null>(null)

  useEffect(() => {
    let isMounted = true

    if (window.inkforge) {
      window.inkforge.getAppInfo().then((info) => {
        if (isMounted) {
          setAppInfo(info)
        }
      })
    }

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="app-shell">
      <AppHeader appInfo={appInfo} />
      <div className="workspace-grid">
        <Sidebar />
        <DocumentWorkspace />
        <EditorPanel />
      </div>
    </div>
  )
}

export default App
