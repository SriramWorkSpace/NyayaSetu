import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyTheme, resolveInitialTheme } from './lib/theme'
import './styles/tokens.css'

// Resolve the theme to an explicit attribute before first paint, so the toggle
// can always win over the system preference and there is no unstyled flash.
applyTheme(resolveInitialTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
