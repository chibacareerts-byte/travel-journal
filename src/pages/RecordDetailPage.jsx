// 3. 記録詳細：1ページの小さな写真集として。
//   代表写真（Hero）→ 場所名 → 情報（都道府県・訪問日・旅・タグ）→ メモ → Photographs（2枚目以降）
// 写真は切り取らずに本来の縦横比で出す。一度読み込んだ写真の比率は覚えておき（photoAspect）、最初から正しい高さの枠で出す
// （読み込み後に画面がずれない）。比率を知らない代表写真だけは、今まで通り画面の約60%の高さの枠で出す。
// 写真をタップすると拡大表示（Lightbox）。
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Photo from '../components/Photo'
import TagList from '../components/TagList'
import Lightbox from '../components/Lightbox'
import BackBar from '../components/BackBar'
import RecordsGate from '../components/RecordsGate'
import { getPrefecture } from '../data/prefectures'
import { PREFECTURE_EN } from '../data/prefectureNames'
import { aspectOf } from '../lib/photoAspect'
import { useRecords } from '../lib/RecordsContext'
import { formatDate } from '../lib/recordUtils'

const pad2 = (n) => String(n).padStart(2, '0')

// 代表写真：比率を覚えていれば、その比率の枠（極端に縦長・横長な写真だけ少し切る）。知らなければ今まで通りの枠
function DetailHero({ photo, onOpen }) {
  const [ratio] = useState(() => {
    const r = aspectOf(photo)
    return r ? Math.min(2, Math.max(0.62, r)) : null
  })
  return (
    <button type="button" className="detail__hero-btn" onClick={onOpen} aria-label="写真を拡大">
      {ratio ? (
        <Photo photo={photo} ratio={String(ratio)} className="detail__hero-photo is-natural" fade priority />
      ) : (
        <Photo photo={photo} ratio="4 / 5" className="detail__hero-photo" fade priority />
      )}
    </button>
  )
}

export default function RecordDetailPage() {
  const { id } = useParams()
  const { records, removeRecord, trips, tripsReady } = useRecords()
  const navigate = useNavigate()
  const [viewerIndex, setViewerIndex] = useState(null) // null = 拡大していない

  // 削除の確認ポップアップ
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false) // 削除の処理中（成功して移動するまで true のまま）
  const [deleteError, setDeleteError] = useState('')
  const [photoWarning, setPhotoWarning] = useState(false) // 記録は消えたが、写真の一部が残った

  // 削除が成功すると records から記録が消えるので、移動するまでの間は、最後に見ていた記録を表示し続ける
  const found = records.find((r) => r.id === id)
  const lastRecord = useRef(null)
  if (found) lastRecord.current = found
  const record = found || (busy ? lastRecord.current : null)

  function closeConfirm() {
    if (busy) return // 削除の処理が始まったら閉じない
    setConfirming(false)
    setDeleteError('')
  }

  // Esc で閉じる／ポップアップを開いている間は、背景をスクロールさせない
  useEffect(() => {
    if (!confirming) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) closeConfirm()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }) // closeConfirm は毎回作り直されるので、依存配列は付けずに毎回つけ直す

  async function handleDelete() {
    if (busy) return
    setBusy(true)
    setDeleteError('')
    try {
      const { failedPaths } = await removeRecord(record.id)
      if (failedPaths.length > 0) {
        // 記録は削除できたが、写真の一部が Storage に残った。お知らせを見せてから、一覧へ移動する
        setPhotoWarning(true)
        return
      }
      navigate('/records', { replace: true })
    } catch (error) {
      console.error('記録の削除に失敗しました', error)
      setDeleteError(error.userMessage || '削除できませんでした。もう一度お試しください。')
      setBusy(false) // 記録は消えていないので、そのまま再試行できる
    }
  }

  function goBack() {
    if (window.history.state && window.history.state.idx > 0) navigate(-1)
    else navigate('/records')
  }

  if (!record) {
    return (
      <div className="page">
        <BackBar fallback="/records" />
        <RecordsGate>
          <p className="empty">記録が見つかりません。</p>
        </RecordsGate>
      </div>
    )
  }

  const pref = getPrefecture(record.prefectureId)
  // 写真が0枚の記録は、ヒーロー・ギャラリー・拡大表示を出さず、戻るバーと場所名から始める。
  // （写真のデータはあるが src が取れないときは、0枚ではないので、これまでどおり Photo を通る）
  const hasPhotos = record.photos.length > 0
  const photos = hasPhotos ? record.photos : []
  const gallery = photos.slice(1)
  const trip = tripsReady && record.tripId ? trips.find((t) => t.id === record.tripId) : null

  return (
    <article className={hasPhotos ? 'detail' : 'detail detail--plain'}>
      {!hasPhotos && <BackBar fallback="/records" />}

      {/* 1枚目の写真：タップで拡大 */}
      {hasPhotos && (
      <div className="detail__hero">
        <DetailHero key={photos[0].id} photo={photos[0]} onOpen={() => setViewerIndex(0)} />
        <button type="button" className="detail__back" onClick={goBack} aria-label="戻る">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </button>
      </div>
      )}

      <div className="detail__body">
        <p className="detail__kicker">{PREFECTURE_EN[pref.id]}</p>
        <h1 className="detail__title">{record.placeName}</h1>

        <dl className="facts">
          <div className="facts__row">
            <dt>都道府県</dt>
            <dd>
              <Link to={`/prefecture/${pref.id}`}>{pref.name}</Link>
            </dd>
          </div>
          <div className="facts__row">
            <dt>訪問日</dt>
            <dd className="facts__date">{formatDate(record.visitedOn)}</dd>
          </div>
          {trip && (
            <div className="facts__row">
              <dt>旅</dt>
              <dd>
                <Link to={`/trips/${trip.id}`}>{trip.title}</Link>
              </dd>
            </div>
          )}
          {record.tags.length > 0 && (
            <div className="facts__row">
              <dt>タグ</dt>
              <dd>
                <TagList tags={record.tags} />
              </dd>
            </div>
          )}
        </dl>

        {record.memo && (
          <section className="memo">
            <h2 className="section-label">メモ</h2>
            <p className="memo__text">{record.memo}</p>
          </section>
        )}
      </div>

      {gallery.length > 0 && (
        <section className="plates" aria-labelledby="plates-title">
          <h2 className="plates__head" id="plates-title">
            <span className="plates__label">Photographs</span>
            <span className="plates__count">{pad2(photos.length)}</span>
          </h2>
          <ol className="plates__list">
            {gallery.map((p, i) => (
              <li key={p.id} className="plate">
                <button
                  type="button"
                  className="plate__btn"
                  onClick={() => setViewerIndex(i + 1)}
                  aria-label={`${i + 2}枚目の写真を拡大`}
                >
                  <Photo photo={p} ratio="4 / 3" natural fade />
                </button>
                <p className="plate__no" aria-hidden="true">
                  {pad2(i + 2)}
                  <span className="plate__of"> / {pad2(photos.length)}</span>
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="detail__actions">
        <Link to={`/record/${record.id}/edit`} state={{ fromDetail: true }} className="btn-line detail__edit">
          編集
        </Link>
        <button type="button" className="btn-line detail__remove" onClick={() => setConfirming(true)}>
          削除
        </button>
      </div>

      {confirming && (
        <div className="confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="confirm__backdrop" onClick={closeConfirm} />
          <div className="confirm__panel">
            {photoWarning ? (
              <>
                <p className="confirm__title" id="confirm-title">記録を削除しました</p>
                <p className="confirm__text">
                  一部の写真を削除できませんでした。残った写真は、あとから管理画面で削除できます。
                </p>
                <div className="confirm__actions">
                  <button type="button" className="btn-line" onClick={() => navigate('/records', { replace: true })}>
                    記録一覧へ
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="confirm__title" id="confirm-title">この記録を削除しますか？</p>
                <p className="confirm__text">写真も削除され、元に戻せません。</p>
                {deleteError && <p className="notice" role="alert">{deleteError}</p>}
                <div className="confirm__actions">
                  <button type="button" className="btn-line" onClick={closeConfirm} disabled={busy} autoFocus>
                    キャンセル
                  </button>
                  <button type="button" className="btn-line confirm__delete" onClick={handleDelete} disabled={busy}>
                    {busy ? '削除中…' : '削除する'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {hasPhotos && viewerIndex !== null && (
        <Lightbox
          photos={photos}
          index={viewerIndex}
          onChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          title={record.placeName}
        />
      )}
    </article>
  )
}
