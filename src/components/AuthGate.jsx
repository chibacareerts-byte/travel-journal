// ログインしているときだけ、中身（アプリ本体）を表示します。
// 未ログインならログイン画面を表示します。
// App.jsx のルーティングとは別にここで切り替えるので、既存の画面には手を入れずに済みます。

import LoginPage from '../pages/LoginPage'
import { useAuth } from '../lib/AuthContext'

export default function AuthGate({ children }) {
  const { session, loading } = useAuth()

  if (loading) return null // ログイン状態を確認している間は何も出さない（ログイン画面が一瞬ちらつかないように）
  if (!session) return <LoginPage />
  return children
}
