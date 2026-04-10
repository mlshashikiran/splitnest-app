import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller)

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.update().catch(() => undefined)

        if (!hadController) {
          return
        }

        let refreshing = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) {
            return
          }

          refreshing = true
          window.location.reload()
        })
      })
      .catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
