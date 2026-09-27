// 未ログインのときに表示するログイン画面。メールアドレスとパスワードだけのシンプルな作りです。
import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = email.trim() !== '' && password !== '' && !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    const message = await signIn(email.trim(), password)
    // 成功すると AuthGate が自動でアプリ本体に切り替えるので、ここでは何もしなくてよい
    if (message) {
      setError(message)
      setSubmitting(false)
    }
  }

  return (
    <div className="login">
      <header className="login__head">
        <p className="eyebrow">Travel Journal</p>
        <h1 className="page-title">旅の記録</h1>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field__label" htmlFor="email">メールアドレス</label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="password">パスワード</label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="form__submit">
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            ログイン
          </button>
          {error && <p className="notice" role="alert">{error}</p>}
        </div>
      </form>
    </div>
  )
}
