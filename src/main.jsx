import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import AuthGate from './components/AuthGate'
import { AuthProvider } from './lib/AuthContext'
import { RecordsProvider } from './lib/RecordsContext'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      {/* ログイン済みのときだけ、記録の読み込みとアプリ本体を表示する */}
      <AuthProvider>
        <AuthGate>
          <RecordsProvider>
            <App />
          </RecordsProvider>
        </AuthGate>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
