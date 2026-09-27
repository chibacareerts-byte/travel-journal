// 記録の編集画面の「MY BEST」欄：この記録が入っているMY BESTを選び直す（複数選択できる）。
//   useRecordBest(recordId) … 一覧の取得・選択・新規作成・保存をまとめたもの（編集画面が持つ）
//   BestListsField          … 見た目（タップしやすい選択行）
// 保存は、編集画面の［保存する］で、記録の保存が終わったあとに行う（新しく選んだリストへ追加／外したリストから外す）。
// MY BESTから外しても、記録本体・写真・タグ・メモには触れません（ランキングの行だけが変わります）。
// 各MY BESTは最大5件。すでにこの記録が入っているリストは、満員でも外せる。入っていない満員のリストは、新しく選べない。

import { useCallback, useEffect, useState } from 'react'
import { BEST_MAX, TITLE_MAX, createList, fetchLists, fetchRecordListIds, setRecordLists } from '../lib/rankingApi'

export function useRecordBest(recordId) {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [lists, setLists] = useState([]) // [{ id, title, count }]（count は、いま DB に入っている件数）
  const [member, setMember] = useState(() => new Set()) // 開いた時点で、この記録が入っているリスト
  const [selected, setSelected] = useState(() => new Set())

  const load = useCallback(() => {
    setStatus('loading')
    return Promise.all([fetchLists(), fetchRecordListIds(recordId)])
      .then(([all, ids]) => {
        setLists(all)
        setMember(new Set(ids))
        setSelected(new Set(ids)) // 所属済みのリストは、最初から選択状態
        setStatus('ready')
      })
      .catch((err) => {
        console.error('MY BESTを取得できませんでした', err)
        setStatus('error')
      })
  }, [recordId])

  useEffect(() => {
    load()
  }, [load])

  const adds = [...selected].filter((id) => !member.has(id))
  const removes = [...member].filter((id) => !selected.has(id))

  function toggle(listId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(listId)) next.delete(listId)
      else next.add(listId)
      return next
    })
  }

  // 編集画面を離れずに新しいリストを作り、この記録を選択済みにする（リストはすぐに作られる）
  async function createNew(title) {
    const created = await createList(title)
    setLists((prev) => [...prev, created])
    setSelected((prev) => new Set(prev).add(created.id))
  }

  // 追加・取り外しをまとめて1回で保存する。変更がなければ何もしない。失敗したら、日本語のメッセージ付きで投げる
  async function save() {
    if (status !== 'ready' || (adds.length === 0 && removes.length === 0)) return
    try {
      await setRecordLists(recordId, adds, removes)
    } catch (err) {
      if (err.limit) {
        const full = lists.find((l) => l.id === err.fullListId)
        err.userMessage = `${full ? `「${full.title}」` : 'MY BEST'}は${BEST_MAX}件で満員のため、追加できませんでした。`
      }
      throw err
    }
    setLists((prev) =>
      prev.map((l) => ({ ...l, count: l.count + (adds.includes(l.id) ? 1 : 0) - (removes.includes(l.id) ? 1 : 0) })),
    )
    setMember(new Set(selected))
  }

  return { status, lists, member, selected, toggle, createNew, save, reload: load }
}

export default function BestListsField({ best }) {
  const { status, lists, member, selected, toggle, createNew, reload } = best
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function handleCreate() {
    if (busy || title.trim() === '') return
    setBusy(true)
    setNotice('')
    try {
      await createNew(title)
      setCreating(false)
      setTitle('')
    } catch (err) {
      console.error('リストを作れませんでした', err)
      setNotice(err.userMessage || 'リストを作れませんでした。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field best-field">
      <p className="field__label" id="best-field-label">MY BEST</p>

      {status === 'loading' && <p className="field__hint" role="status">読み込み中…</p>}
      {status === 'error' && (
        <p className="field__hint" role="alert">
          MY BESTを読み込めませんでした。
          <button type="button" className="text-btn" onClick={reload}>
            再読み込み
          </button>
        </p>
      )}

      {status === 'ready' && (
        <>
          {lists.length === 0 && <p className="field__hint">まだMY BESTがありません。</p>}
          <ul className="best-check-list" aria-labelledby="best-field-label">
            {lists.map((l) => {
              const on = selected.has(l.id)
              const isMember = member.has(l.id)
              const full = l.count >= BEST_MAX && !isMember // 入っていない満員のリストは、新しく選べない
              const shown = l.count + (on && !isMember ? 1 : 0) - (!on && isMember ? 1 : 0)
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={full}
                    className={on ? 'best-check is-on' : 'best-check'}
                    onClick={() => toggle(l.id)}
                  >
                    <span className="best-check__box" aria-hidden="true">{on ? '✓' : ''}</span>
                    <span className="best-check__title">{l.title}</span>
                    <span className="best-check__count">{full ? `${BEST_MAX} / ${BEST_MAX}` : `${shown} / ${BEST_MAX}`}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {creating ? (
            <div className="best-form best-form--inline">
              <input
                className="input"
                value={title}
                maxLength={TITLE_MAX}
                placeholder="例：禅寺 BEST"
                aria-label="新しいMY BESTのタイトル"
                enterKeyHint="done"
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  // Enter で、記録のフォーム全体が送信（保存）されないようにする。リストの作成だけを行う
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    handleCreate()
                  }
                }}
                autoFocus
              />
              {notice && <p className="notice" role="alert">{notice}</p>}
              <div className="best-form__actions">
                <button type="button" className="btn-line" disabled={busy || title.trim() === ''} onClick={handleCreate}>
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
            </div>
          ) : (
            <button type="button" className="best-manage" onClick={() => setCreating(true)}>
              ＋ 新しいMY BESTを作る
            </button>
          )}
        </>
      )}
    </div>
  )
}
