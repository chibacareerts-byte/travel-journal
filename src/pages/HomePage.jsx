// 1. HOME / 日本地図
// 都道府県をタップ → ポップアップ（PrefecturePopup）→「記録を見る」で都道府県ページへ。
// 地図の背景は、訪問済みの数に応じて左から淡い藍色に染まります。
import { useState } from 'react'
import { Link } from 'react-router-dom'
import JapanMap from '../components/JapanMap'
import PrefecturePopup from '../components/PrefecturePopup'
import SelectedPrefectureLabel from '../components/SelectedPrefectureLabel'
import { PREFECTURES } from '../data/prefectures'
import { useRecords } from '../lib/RecordsContext'
import { getVisitedIds } from '../lib/recordUtils'

const TOTAL = PREFECTURES.length // 47

export default function HomePage() {
  const { records, loading } = useRecords()
  const [selectedId, setSelectedId] = useState(null) // 地図で選んだ県（ポップアップを閉じても残す）
  const [popupId, setPopupId] = useState(null) // ポップアップで開いている県
  const [previewId, setPreviewId] = useState(null) // いま指・マウスが触れている県（触れていなければ null）
  const visitedIds = getVisitedIds(records)

  // 進捗の計算：訪問数 ÷ 47。例) 10 ÷ 47 ≒ 21%
  const ratio = visitedIds.length / TOTAL
  const mapStyle = {
    '--progress': `${ratio * 100}%`, // 染まる範囲（左から何%か）
    '--feather': `${14 * (1 - ratio)}%`, // 染まりの境目をぼかす幅。100%に近づくほど 0 になる
    '--tint': visitedIds.length > 0 ? 'rgba(78, 127, 182, 0.10)' : 'rgba(78, 127, 182, 0)',
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Travel Journal</p>
        <h1 className="page-title">旅の記録</h1>
      </header>

      <section className="home-map" style={mapStyle} aria-label="訪問した都道府県">
        <JapanMap
          visitedIds={visitedIds}
          selectedId={selectedId}
          previewId={previewId}
          onPreview={setPreviewId}
          onSelect={(id) => {
            setSelectedId(id)
            setPopupId(id)
          }}
        />
        {/* 触れている県があればその県、なければ最後に選んだ県 */}
        <SelectedPrefectureLabel prefectureId={previewId ?? selectedId} />
      </section>

      <section className="home-status">
        <p className="home-status__count">
          <span className="home-status__num">{loading ? '–' : visitedIds.length}</span>
          <span className="home-status__sep"> / {TOTAL}</span>
          <span className="home-status__unit">都道府県</span>
        </p>
        <p className="legend">
          <span className="legend__chip legend__chip--visited" />訪問済み
          <span className="legend__chip" />未訪問
        </p>
      </section>

      <Link to="/prefectures" className="row-link">
        <span>都道府県一覧から探す</span>
        <span aria-hidden="true">→</span>
      </Link>

      {popupId !== null && (
        <PrefecturePopup prefectureId={popupId} onClose={() => setPopupId(null)} />
      )}
    </div>
  )
}
