// ログイン状態（Supabase Auth）を、アプリ全体で共有するための入れ物です。
// 使う側は  const { session, loading, signIn } = useAuth()  と書くだけで使えます。
// ログイン状態は Supabase が自動で保存・更新してくれるので、ここでは「今どうなっているか」を受け取るだけです。

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true) // 保存済みのログイン状態を確認している間は true

  useEffect(() => {
    // 起動時：保存されているログイン状態を読み込む
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // ログイン・ログアウト・トークン更新があるたびに、状態を反映する
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // 成功すると null、失敗すると画面に出す日本語のメッセージを返す
  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return null
    return 'メールアドレスまたはパスワードが正しくありません'
  }

  const value = { session, user: session ? session.user : null, loading, signIn }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
