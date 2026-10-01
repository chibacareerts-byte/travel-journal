// 1. HOME / 日本地図
// 都道府県をタップ → ポップアップ（PrefecturePopup）→「記録を見る」で都道府県ページへ。
// 地図の背景は、訪問済みの数に応じて左から淡い藍色に染まります。
// 地図の上の年の選択（All / 2026 / 2025 …）で、その年に訪れた県だけを表示できます（表示だけの絞り込み。データは変えない）。
//   選んだ年は URL（/?year=2026）に置くので、県のページから戻っても同じ年のまま。All のときは今まで通り。
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ChoiceRow from '../components/ChoiceRow'
import JapanMap from '../components/JapanMap'
import PrefecturePopup from '../components/PrefecturePopup'
import SelectedPrefectureLabel from '../components/SelectedPrefectureLabel'
import { PREFECTURES } from '../data/prefectures'
import { LoadError } from '../components/RecordsGate'
import { useRecords } from '../lib/RecordsContext'
import { getVisitedIds, getYear } from '../lib/recordUtils'

const TOTAL = PREFECTURES.length // 47

export default function HomePage() {
  const { records, loading, error } = useRecords()
  const [selectedId, setSelectedId] = useState(null) // 地図で選んだ県（ポップアップを閉じても残す）
  const [popupId, setPopupId] = useState(null) // ポップアップで開いている県
  const [previewId, setPreviewId] = useState(null) // いま指・マウスが触れている県（触れていなければ null）
  const [searchParams, setSearchParams] = useSearchParams()

  // 記録のある年（新しい年から）。選んだ年が記録に無いとき（URL の打ち間違いなど）は All として扱う
  const years = useMemo(() => [...new Set(records.map(getYear))].sort((a, b) => b.localeCompare(a)), [records])
  const yearParam = searchParams.get('year')
  const year = yearParam && years.includes(yearParam) ? yearParam : 'all'
  const scoped = useMemo(() => (year === 'all' ? records : records.filter((r) => getYear(r) === year)), [records, year])
  const visitedIds = getVisitedIds(scoped)

  function chooseYear(y) {
    // 履歴を増やさない（戻るで HOME の前の画面へ戻れるように）
    setSearchParams(y === 'all' ? {} : { year: y }, { replace: true })
  }

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
        <h1 className="page-title">旅と日々の記憶</h1>
      </header>

      {years.length > 0 && (
        <ChoiceRow
          className="year-filter"
          optionClassName="year-filter__opt"
          ariaLabel="地図に表示する年"
          value={year}
          onChange={chooseYear}
          options={[{ value: 'all', label: 'すべての年' }, ...years.map((y) => ({ value: y, label: `${y}年` }))]}
          renderOption={(o) => (o.value === 'all' ? 'All' : o.value)}
        />
      )}

      <section
        className="home-map"
        style={mapStyle}
        aria-label={year === 'all' ? '訪問した都道府県' : `${year}年に訪問した都道府県`}
      >
        <JapanMap
          visitedLabel={year === 'all' ? '訪問済み' : `${year}年に訪問`}
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
          <span className="home-status__num">{loading || error ? '–' : visitedIds.length}</span>
          <span className="home-status__sep"> / {TOTAL}</span>
          <span className="home-status__unit">都道府県</span>
        </p>
        <p className="legend">
          <span className="legend__chip legend__chip--visited" />
          {year === 'all' ? '訪問済み' : `${year}年に訪問`}
          <span className="legend__chip" />未訪問
        </p>
      </section>

      {error && <LoadError tight />}

      <Link to="/prefectures" className="row-link">
        <span>都道府県一覧から探す</span>
        <span aria-hidden="true">→</span>
      </Link>

      {popupId !== null && (
        <PrefecturePopup prefectureId={popupId} year={year} onClose={() => setPopupId(null)} />
      )}
    </div>
  )
}
