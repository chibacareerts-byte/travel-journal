// 地図で都道府県をタップしたときに開く、都道府県のポップアップ。
// 四角いダイアログではなく、県の輪郭そのものを主役にした全画面の表示です。
//   閉じ方：背景タップ / ×ボタン / Esc キー
//   「記録を見る」で都道府県ページへ進みます。

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PrefectureSilhouette from './PrefectureSilhouette'
import Photo from './Photo'
import { getPrefecture } from '../data/prefectures'
import { PREFECTURE_EN } from '../data/prefectureNames'
import { useRecords } from '../lib/RecordsContext'
import { formatDate, getPrefectureSummary } from '../lib/recordUtils'

const CLOSE_MS = 160 // 閉じるアニメーションの長さ（CSS と合わせる）

export default function PrefecturePopup({ prefectureId, onClose }) {
  const { records, loading, error } = useRecords()
  const pref = getPrefecture(prefectureId)
  const { count, representative } = getPrefectureSummary(records, prefectureId)
  // 読み込み中・失敗中は、「まだ記録はありません」とは言わない
  const pending = loading || error
  const visited = !pending && count > 0

  const [closing, setClosing] = useState(false)
  const closeBtn = useRef(null)
  const timer = useRef(null)

  function requestClose() {
    if (timer.current) return
    setClosing(true)
    timer.current = setTimeout(onClose, CLOSE_MS)
  }

  useEffect(() => {
    const opener = document.activeElement // 閉じたら、開く前の場所にフォーカスを戻す
    closeBtn.current.focus()
    document.body.style.overflow = 'hidden' // 後ろの画面が動かないように

    function onKey(e) {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      clearTimeout(timer.current)
      if (opener && opener.focus) opener.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // data-keep が付いた場所（輪郭・写真・ボタン）以外をタップしたら閉じる
  function onBackgroundClick(e) {
    if (!e.target.closest('[data-keep]')) requestClose()
  }

  return (
    <div
      className={closing ? 'pop is-closing' : 'pop'}
      role="dialog"
      aria-modal="true"
      aria-label={`${pref.name}`}
      onClick={onBackgroundClick}
    >
      <div className="pop__backdrop" />

      <div className="pop__panel">
        <button ref={closeBtn} type="button" className="pop__close" onClick={requestClose} aria-label="閉じる" data-keep>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <header className="pop__head">
          <p className="pop__en">{PREFECTURE_EN[pref.id]}</p>
          <h2 className="pop__name">{pref.name}</h2>
          {/* 訪問件数は表示しない。訪問済みのときは、県名だけでこのまま下の写真・リンクへ続く */}
          {!visited && (
            <p className="pop__status pop__status--none">
              {loading ? '読み込み中…' : error ? '記録を読み込めませんでした' : 'まだ記録はありません'}
            </p>
          )}
        </header>

        <div className="pop__stage">
          <div className="pop__shape" data-keep>
            <PrefectureSilhouette prefectureId={pref.id} visited={visited} />
          </div>
        </div>

        {!pending && !visited && (
          <footer className="pop__foot">
            {/* 選んでいた県を、新規記録画面の「都道府県」欄に最初から入れて開く */}
            <Link to={`/new?prefecture=${pref.id}`} className="pop__cta" data-keep>
              <span>＋ この県の記録をつける</span>
            </Link>
          </footer>
        )}

        {visited && (
          <footer className="pop__foot">
            {representative && (
              <div className="pop__plate" data-keep>
                <Photo photo={representative.photo} ratio="4 / 3" className="pop__plate-photo" />
                <div>
                  <p className="pop__plate-label">Featured</p>
                  <p className="pop__plate-title">{representative.record.placeName}</p>
                  <p className="pop__plate-date">{formatDate(representative.record.visitedOn)}</p>
                </div>
              </div>
            )}
            <Link to={`/prefecture/${pref.id}`} className="pop__cta" data-keep>
              <span>記録を見る</span>
              <span aria-hidden="true">→</span>
            </Link>
          </footer>
        )}
      </div>
    </div>
  )
}
