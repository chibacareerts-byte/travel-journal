// 「記録」タブ：すべての記録を、旅ごとにまとめて1列のカードで。
//   TRIP / 京都旅行 / 2026.09.18 — 09.20 の見出しの下に、その旅の記録が続く。
//   旅に入っていない記録も、今まで通り日付の位置に並ぶ（見出しなし）。
// 並べ替え（新しい順・古い順）と旅のまとめは、取得済みの records・trips をブラウザ側で並べるだけ。
// Supabase への追加通信は行わない。旅の機能が使えない（trips.sql 未実行）ときは、すべて見出しなしで並ぶ。
//
// 背景：写真が浮かび上がるよう、このページだけ深い藍（Deep Ink 系）にする（色は index.css の「18.」）。
//   開発中（npm run dev）だけ、/records?ink=a・b・c で背景色の候補を切り替えて見比べられる（本番では常に仮採用の色）。
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DateSortToggle from '../components/DateSortToggle'
import RecordCard from '../components/RecordCard'
import RecordsGate, { EmptyRecords } from '../components/RecordsGate'
import { useRecords } from '../lib/RecordsContext'
import { buildRecordSections, formatTripRange } from '../lib/tripUtils'

const NO_TRIPS = []

export default function RecordsPage() {
  const { records, trips, tripsReady, loading, error } = useRecords()
  const [order, setOrder] = useState('newest') // 'newest' | 'oldest'（初期は新しい順）
  const [searchParams] = useSearchParams()
  const inkParam = import.meta.env.DEV ? searchParams.get('ink') : null
  const ink = inkParam === 'a' || inkParam === 'b' || inkParam === 'c' ? inkParam : undefined

  // スマホのブラウザのアドレスバーの色も、このページの背景に合わせる（ほかのページへ移ったら元に戻す）
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return undefined
    const before = meta.getAttribute('content')
    meta.setAttribute('content', getComputedStyle(document.body).backgroundColor)
    return () => meta.setAttribute('content', before)
  }, [ink])

  // records はもともと新しい順（RecordsContext）。旅ごとにまとめ、旅・旅の中の記録を order の向きに並べる
  // （安定ソートなので、同じ訪問日どうしはいまの表示順のまま）。records・trips・order が変わったときだけ計算し直す
  const sections = useMemo(
    () => buildRecordSections(records, tripsReady ? trips : NO_TRIPS, order),
    [records, trips, tripsReady, order],
  )

  // 一覧でいちばん上にある、写真のある記録（最初に見える写真を、先に読み込む）
  const firstId = useMemo(() => {
    for (const s of sections) {
      const hit = s.records.find((r) => r.photos.length > 0)
      if (hit) return hit.id
    }
    return null
  }, [sections])

  return (
    <div className="page page--records" data-ink={ink}>
      <header className="page-head">
        <p className="eyebrow">All Records</p>
        <h1 className="page-title">記録</h1>
        <p className="page-sub">{loading || error || records.length === 0 ? '' : `${records.length}件`}</p>
        <Link to="/best" className="head-link">
          MY BEST →
        </Link>
      </header>

      {!loading && !error && records.length > 0 && (
        <div className="sort-bar">
          <DateSortToggle order={order} onChange={setOrder} />
        </div>
      )}

      <RecordsGate>
        {records.length === 0 ? (
          <EmptyRecords />
        ) : (
          <div className="trip-feed">
            {sections.map((s) =>
              s.type === 'trip' ? (
                <section key={s.key} className="trip-group" aria-label={s.trip.title}>
                  <header className="trip-head">
                    <p className="trip-head__label">Trip</p>
                    <h2 className="trip-head__title">{s.trip.title}</h2>
                    <p className="trip-head__dates">{formatTripRange(s.start, s.end)}</p>
                  </header>
                  <div className="card-list">
                    {s.records.map((r) => (
                      <RecordCard key={r.id} record={r} priority={r.id === firstId} />
                    ))}
                  </div>
                </section>
              ) : (
                <div key={s.key} className="card-list">
                  {s.records.map((r) => (
                    <RecordCard key={r.id} record={r} priority={r.id === firstId} />
                  ))}
                </div>
              ),
            )}
          </div>
        )}
      </RecordsGate>
    </div>
  )
}
