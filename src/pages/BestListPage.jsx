// MY BEST の1つのリスト（/best/:listId）：自分で選んだ場所を、自分で決めた順番に並べる（自動ランキングではありません）。
// ランキングには「どのリストの、どの記録が何位か」だけを保存し、場所名・写真などは records のものをそのまま使います。
// 順位の変更・追加・削除は、Supabase への保存が成功してから画面に反映します（画面だけ変わった状態を確定させない）。
// タイトルの変更・リストの削除もここ。リストを削除しても、旅行記録（records）は削除されません。

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BackBar from '../components/BackBar'
import Photo from '../components/Photo'
import RecordsGate from '../components/RecordsGate'
import { useRecords } from '../lib/RecordsContext'
import {
  BEST_MAX,
  TITLE_MAX,
  addRanking,
  deleteList,
  fetchList,
  fetchRankings,
  removeRanking,
  renameList,
  reorderRankings,
} from '../lib/rankingApi'
import { getPrefecture } from '../data/prefectures'
import { formatDate } from '../lib/recordUtils'

const pad2 = (n) => String(n).padStart(2, '0')

export default function BestListPage() {
  const { listId } = useParams()
  return (
    <div className="page page--best">
      <BackBar fallback="/best" label="MY BEST" />
      <RecordsGate>
        <BestListView key={listId} listId={listId} />
      </RecordsGate>
    </div>
  )
}

function BestListView({ listId }) {
  const { records } = useRecords()
  const navigate = useNavigate()
  const [list, setList] = useState(null) // { id, title }
  const [items, setItems] = useState(null) // [{ recordId, position }]。null は読み込み中
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false) // 保存の通信中は、ほかの操作を受け付けない
  const [notice, setNotice] = useState('')
  const [picking, setPicking] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(() => {
    setLoadError(false)
    if (!/^\d+$/.test(listId)) {
      setNotFound(true)
      return Promise.resolve()
    }
    return Promise.all([fetchList(listId), fetchRankings(listId)])
      .then(([found, rankings]) => {
        if (!found) {
          setNotFound(true)
          return
        }
        setList(found)
        setItems(rankings)
      })
      .catch((err) => {
        console.error('MY BESTを取得できませんでした', err)
        setLoadError(true)
      })
  }, [listId])

  useEffect(() => {
    load()
  }, [load])

  // 削除の確認を開いている間：Esc で閉じる／背景をスクロールさせない
  useEffect(() => {
    if (!confirming) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) setConfirming(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [confirming, busy])

  if (notFound) {
    return (
      <div className="empty" role="alert">
        <p>このリストは見つかりませんでした。</p>
        <Link to="/best" className="btn-line">
          MY BEST へ
        </Link>
      </div>
    )
  }
  if (loadError) {
    return (
      <div className="empty" role="alert">
        <p>MY BESTを読み込めませんでした。</p>
        <button type="button" className="btn-line" onClick={load}>
          再読み込み
        </button>
      </div>
    )
  }
  if (items === null || list === null) return <p className="empty" role="status">読み込み中…</p>

  const byId = new Map(records.map((r) => [r.id, r]))
  // 記録が見つからないランキング（表示できない行）は、画面に出さない。順位の保存では、全件を渡す
  const visible = items.filter((it) => byId.has(it.recordId))
  const addable = records.filter((r) => !items.some((it) => it.recordId === r.id))

  // 保存を実行し、成功したときだけ画面を更新する
  async function run(action, onSuccess) {
    if (busy) return
    setBusy(true)
    setNotice('')
    try {
      await action()
      onSuccess()
    } catch (err) {
      console.error('MY BESTの更新に失敗しました', err)
      setNotice(err.userMessage || '保存できませんでした。もう一度お試しください。')
      if (err.limit || err.code === '23505' || (err.cause && err.cause.code === '23505')) await load() // 別の画面で追加済み → 最新にそろえる
    } finally {
      setBusy(false)
    }
  }

  function move(index, dir) {
    const a = items.findIndex((it) => it.recordId === visible[index].recordId)
    const b = items.findIndex((it) => it.recordId === visible[index + dir].recordId)
    const next = [...items]
    ;[next[a], next[b]] = [next[b], next[a]]
    const renumbered = next.map((it, i) => ({ ...it, position: i + 1 }))
    run(
      () => reorderRankings(listId, renumbered.map((it) => it.recordId)),
      () => setItems(renumbered),
    )
  }

  function remove(recordId) {
    run(
      () => removeRanking(listId, recordId),
      () => setItems((prev) => prev.filter((it) => it.recordId !== recordId)),
    )
  }

  function add(recordId) {
    if (items.length >= BEST_MAX) return
    let fresh = items
    run(
      async () => {
        await addRanking(listId, recordId)
        fresh = await fetchRankings(listId) // 追加は最後尾。DB が順位を詰め直すので、保存後の並びを取り直す
      },
      () => setItems(fresh),
    )
  }

  function startRename() {
    setDraftTitle(list.title)
    setNotice('')
    setRenaming(true)
  }

  function saveTitle(e) {
    e.preventDefault()
    let nextTitle = ''
    run(
      async () => {
        nextTitle = await renameList(listId, draftTitle)
      },
      () => {
        setList((prev) => ({ ...prev, title: nextTitle }))
        setRenaming(false)
      },
    )
  }

  function handleDeleteList() {
    run(
      () => deleteList(listId),
      () => navigate('/best', { replace: true }),
    )
  }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">My Best</p>
        <h1 className="page-title">{list.title}</h1>
        <p className="page-sub">BEST {items.length} / {BEST_MAX}</p>
        {renaming ? (
          <form className="best-form" onSubmit={saveTitle}>
            <input
              className="input"
              value={draftTitle}
              maxLength={TITLE_MAX}
              onChange={(e) => setDraftTitle(e.target.value)}
              aria-label="リストのタイトル"
              autoFocus
            />
            <div className="best-form__actions">
              <button type="submit" className="btn-line" disabled={busy || draftTitle.trim() === ''}>
                保存
              </button>
              <button type="button" className="btn-line" disabled={busy} onClick={() => setRenaming(false)}>
                キャンセル
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="best-manage" onClick={startRename}>
            名前を変える
          </button>
        )}
      </header>

      {visible.length === 0 ? (
        <p className="best__empty">まだ選んでいません。</p>
      ) : (
        <ol className="best-list">
          {visible.map((it, i) => {
            const record = byId.get(it.recordId)
            const hasPhotos = record.photos.length > 0 // 0枚だけを「写真なし」とする（src が取れない写真は Photo を通す）
            const pref = getPrefecture(record.prefectureId)
            return (
              <li key={it.recordId} className={hasPhotos ? 'best-item' : 'best-item best-item--text'}>
                <span className="best-item__rank">{pad2(i + 1)}</span>
                {hasPhotos && (
                  <Link to={`/record/${record.id}`} className="best-item__thumb" aria-label={record.placeName}>
                    <Photo photo={record.photos[0]} ratio="1 / 1" />
                  </Link>
                )}
                <div className="best-item__body">
                  <Link to={`/record/${record.id}`} className="best-item__title">
                    {record.placeName}
                  </Link>
                  <p className="best-item__meta">{pref.name}</p>
                  <p className="best-item__meta">{formatDate(record.visitedOn)}</p>
                  <button type="button" className="best-item__remove" disabled={busy} onClick={() => remove(record.id)}>
                    外す
                  </button>
                </div>
                <div className="best-item__move">
                  <button
                    type="button"
                    aria-label={`${record.placeName}を1つ上げる`}
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`${record.placeName}を1つ下げる`}
                    disabled={busy || i === visible.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {notice && !confirming && (
        <p className="notice best__notice" role="alert">
          {notice}
        </p>
      )}

      {items.length >= BEST_MAX ? (
        <p className="best__done">
          BEST {BEST_MAX}が完成しました
          {items.length > BEST_MAX && <span>（{BEST_MAX}件を超えています。外して調整できます）</span>}
        </p>
      ) : (
        <div className="best__add">
          <button type="button" className="btn-line" aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
            {picking ? '閉じる' : '＋ 場所を追加'}
          </button>
        </div>
      )}

      {picking && items.length < BEST_MAX && (
        <section className="best-pick" aria-label="保存済みの記録から選ぶ">
          <p className="section-label">保存済みの記録から選ぶ</p>
          {addable.length === 0 ? (
            <p className="best__empty">追加できる記録はありません。</p>
          ) : (
            <ul className="best-pick__list">
              {addable.map((r) => (
                <li key={r.id}>
                  <button type="button" className="best-pick__row" disabled={busy} onClick={() => add(r.id)}>
                    <span className="best-pick__name">{r.placeName}</span>
                    <span className="best-pick__meta">
                      {getPrefecture(r.prefectureId).name}　{formatDate(r.visitedOn)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="best__delete">
        <button type="button" className="best-manage best-manage--quiet" onClick={() => setConfirming(true)}>
          このリストを削除
        </button>
      </div>

      {confirming && (
        <div className="confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="confirm__backdrop" onClick={() => !busy && setConfirming(false)} />
          <div className="confirm__panel">
            <p className="confirm__title" id="confirm-title">このリストを削除しますか？</p>
            <p className="confirm__text">「{list.title}」の順位だけが削除されます。旅行記録は削除されません。</p>
            {notice && <p className="notice" role="alert">{notice}</p>}
            <div className="confirm__actions">
              <button type="button" className="btn-line" onClick={() => setConfirming(false)} disabled={busy} autoFocus>
                キャンセル
              </button>
              <button type="button" className="btn-line confirm__delete" onClick={handleDeleteList} disabled={busy}>
                {busy ? '削除中…' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
