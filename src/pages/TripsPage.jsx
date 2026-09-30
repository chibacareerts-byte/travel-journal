// 旅の記録（/trips）：旅ごとに、代表写真・旅の名前・期間・記録の数を並べる目次。
// データは、すでに読み込んである旅（trips）と記録（records）だけを使う（Supabase への追加の通信はしない）。
// 旅に入っていない記録（trip_id が null）は、ここには出さない（消したり変えたりはしない。記録一覧にはそのまま出る）。

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import BackBar from '../components/BackBar'
import Photo from '../components/Photo'
import RecordsGate from '../components/RecordsGate'
import { useRecords } from '../lib/RecordsContext'
import { buildTripSummaries, formatTripRange } from '../lib/tripUtils'

const pad2 = (n) => String(n).padStart(2, '0')
const NO_TRIPS = []

export default function TripsPage() {
  const { records, trips, tripsReady } = useRecords()
  const summaries = useMemo(() => buildTripSummaries(records, tripsReady ? trips : NO_TRIPS), [records, trips, tripsReady])
  const firstCover = summaries.find((s) => s.cover)
  const dated = summaries.filter((s) => s.start).length // 記録のある旅だけに、古い順の通し番号（No. 01 が最初の旅）を付ける

  return (
    <div className="page page--trips">
      <BackBar fallback="/best" label="MY BEST" />
      <header className="page-head">
        <p className="eyebrow">Journeys</p>
        <h1 className="page-title">旅の記録</h1>
        <p className="page-sub">{summaries.length > 0 ? `${summaries.length}の旅` : ''}</p>
      </header>

      <RecordsGate>
        {summaries.length === 0 ? (
          <div className="empty">
            <p>まだ旅はありません。</p>
            <p className="empty__note">記録をつけるときに「旅」を選ぶと、ここに旅ごとにまとまります。</p>
          </div>
        ) : (
          <ol className="journeys">
            {summaries.map((s, i) => (
              <li key={s.trip.id}>
                <Link to={`/trips/${s.trip.id}`} className={s.cover ? 'journey' : 'journey journey--text'}>
                  {s.cover && <Photo photo={s.cover} ratio="3 / 2" className="journey__photo" fade priority={s === firstCover} />}
                  <div className="journey__caption">
                    {s.start && (
                      <p className="journey__no">
                        <span>No.</span> {pad2(dated - i)}
                      </p>
                    )}
                    <h2 className="journey__title">{s.trip.title}</h2>
                    <p className="journey__meta">
                      {s.start ? formatTripRange(s.start, s.end) : 'まだ記録がありません'}
                      {s.records.length > 0 && <span className="journey__count">{s.records.length}件の記録</span>}
                    </p>
                    {s.places.length > 0 && (
                      <p className="journey__places">
                        {s.places.slice(0, 4).join('、')}
                        {s.places.length > 4 && ' ほか'}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </RecordsGate>
    </div>
  )
}
