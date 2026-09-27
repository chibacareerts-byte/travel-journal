// MY BEST の一覧（/best）：自分で作ったベストリストの一覧。ここからリストを新しく作り、各リスト（/best/:listId）へ進む。
// 同じ旅行記録を、複数のリストに入れることができます。

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackBar from '../components/BackBar'
import { BEST_MAX, TITLE_MAX, createList, fetchLists } from '../lib/rankingApi'

export default function BestPage() {
  const navigate = useNavigate()
  const [lists, setLists] = useState(null) // null は読み込み中
  const [loadError, setLoadError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    setLoadError(false)
    return fetchLists()
      .then(setLists)
      .catch((err) => {
        console.error('MY BESTのリストを取得できませんでした', err)
        setLoadError(true)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setNotice('')
    try {
      const created = await createList(title)
      navigate(`/best/${created.id}`) // 作ったら、そのまま場所を追加できるリストのページへ
    } catch (err) {
      console.error('リストを作れませんでした', err)
      setNotice(err.userMessage || 'リストを作れませんでした。もう一度お試しください。')
      setBusy(false)
    }
  }

  return (
    <div className="page page--best">
      <BackBar fallback="/records" label="記録" />
      <header className="page-head">
        <p className="eyebrow">My Best</p>
        <h1 className="page-title">MY BEST</h1>
        <p className="page-sub">自分だけのベストリスト</p>
      </header>

      {loadError ? (
        <div className="empty" role="alert">
          <p>MY BESTを読み込めませんでした。</p>
          <button type="button" className="btn-line" onClick={load}>
            再読み込み
          </button>
        </div>
      ) : lists === null ? (
        <p className="empty" role="status">読み込み中…</p>
      ) : (
        <>
          {lists.length === 0 ? (
            <p className="best__empty">まだMY BESTがありません。</p>
          ) : (
            <ul className="best-lists">
              {lists.map((l) => (
                <li key={l.id}>
                  <Link to={`/best/${l.id}`} className="best-lists__row">
                    <span className="best-lists__text">
                      <span className="best-lists__title">{l.title}</span>
                      <span className="best-lists__count">BEST {l.count} / {BEST_MAX}</span>
                    </span>
                    <span className="best-lists__arrow" aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="best__add">
            {creating ? (
              <form className="best-form best-form--create" onSubmit={handleCreate}>
                <label className="field__label" htmlFor="best-new-title">
                  新しいMY BESTのタイトル
                </label>
                <input
                  id="best-new-title"
                  className="input"
                  value={title}
                  maxLength={TITLE_MAX}
                  placeholder="例：禅寺 BEST"
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
                {notice && <p className="notice" role="alert">{notice}</p>}
                <div className="best-form__actions">
                  <button type="submit" className="btn-line" disabled={busy || title.trim() === ''}>
                    作る
                  </button>
                  <button
                    type="button"
                    className="btn-line"
                    disabled={busy}
                    onClick={() => {
                      setCreating(false)
                      setTitle('')
                      setNotice('')
                    }}
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="btn-line" onClick={() => setCreating(true)}>
                ＋ 新しいMY BESTを作る
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
