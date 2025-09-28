import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme } from '@aws-amplify/ui-react'
import App from './App'
import './i18n'
import './styles/tokens.css'
import './styles/tokens.generated.css'
import './styles/global.css'

const theme = createTheme({
  name: 'app-red-theme',
  tokens: {
    colors: {
      brand: {
        primary: {
          10: '#fff0f0',
          20: '#ffd9d9',
          40: '#ff8f8f',
          60: '#ff3b3b',
          80: '#c91616',
          90: '#990f0f',
        },
      },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
