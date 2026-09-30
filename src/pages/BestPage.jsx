// MY BEST の一覧（/best）：自分で作ったベストリストを、写真集の目次のように並べる。
//   01  禅寺 BEST          ［表紙写真］
//       BEST 3 / 5
//       永平寺、大徳寺、萬福寺
// ここからリストを新しく作り、各リスト（/best/:listId）へ進む。いちばん下に「旅の記録」への入口。
// 同じ旅行記録を、複数のリストに入れることができます。
// 表紙写真と場所名は、各リストの1位から順に探す（順位はまとめて1回で取得。取得できなくても一覧はそのまま出す）。

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackBar from '../components/BackBar'
import Photo from '../components/Photo'
import { useRecords } from '../lib/RecordsContext'
import { BEST_MAX, TITLE_MAX, createList, fetchAllRankings, fetchLists } from '../lib/rankingApi'

const pad2 = (n) => String(n).padStart(2, '0')

export default function BestPage() {
  const navigate = useNavigate()
  const { records } = useRecords()
  const [lists, setLists] = useState(null) // null は読み込み中
  const [rankings, setRankings] = useState([]) // 表紙用（取得できなければ空のまま）
  const [loadError, setLoadError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    setLoadError(false)
    fetchAllRankings()
      .then(setRankings)
      .catch((err) => console.warn('MY BESTの表紙を取得できませんでした（一覧はそのまま表示します）', err))
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

  // リスト → { cover（1位から探した最初の写真）, names（上位の場所名） }
  const covers = useMemo(() => {
    const byId = new Map(records.map((r) => [r.id, r]))
    const map = new Map()
    for (const rk of rankings) {
      const record = byId.get(rk.recordId)
      if (!record) continue
      const cur = map.get(rk.listId) || { cover: null, names: [] }
      if (!cur.cover && record.photos.length > 0) cur.cover = record.photos[0]
      cur.names.push(record.placeName)
      map.set(rk.listId, cur)
    }
    return map
  }, [records, rankings])

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
            <ol className="best-lists">
              {lists.map((l, i) => {
                const info = covers.get(l.id)
                return (
                  <li key={l.id}>
                    <Link to={`/best/${l.id}`} className="best-lists__row">
                      <span className="best-lists__no">{pad2(i + 1)}</span>
                      <span className="best-lists__text">
                        <span className="best-lists__title">{l.title}</span>
                        <span className="best-lists__count">BEST {l.count} / {BEST_MAX}</span>
                        {info && info.names.length > 0 && (
                          <span className="best-lists__names">{info.names.slice(0, 3).join('、')}</span>
                        )}
                      </span>
                      <span className="best-lists__cover" aria-hidden="true">
                        {info && info.cover && <Photo photo={info.cover} ratio="4 / 5" fade />}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
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
              <button type="button" className="best-manage" onClick={() => setCreating(true)}>
                ＋ 新しいMY BESTを作る
              </button>
            )}
          </div>
        </>
      )}

      {/* 旅の記録への入口（旅ごとに振り返る） */}
      <Link to="/trips" className="journeys-link">
        <span className="journeys-link__label">Journeys</span>
        <span className="journeys-link__row">
          <span className="journeys-link__title">旅の記録</span>
          <span aria-hidden="true">→</span>
        </span>
        <span className="journeys-link__sub">旅ごとに記憶を振り返る</span>
      </Link>
    </div>
  )
}
