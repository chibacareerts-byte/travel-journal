// 旅の詳細（/trips/:tripId）：1つの旅を、訪れた順（訪問日の古い順）に静かにたどる。
//   複数の日にまたがる旅は、DAY 01 / 2026.09.18（金）の見出しで日ごとに区切る（1日だけの旅は区切らない）。
//   各記録から、今まで通り記録詳細（/record/:id）へ進める。
// データは読み込み済みの trips・records だけを使う（Supabase への追加の通信はしない）。

import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import BackBar from '../components/BackBar'
import Photo from '../components/Photo'
import RecordsGate from '../components/RecordsGate'
import { getPrefecture } from '../data/prefectures'
import { useRecords } from '../lib/RecordsContext'
import { formatDotDate } from '../lib/recordUtils'
import { buildTripSummaries, formatTripRange, groupTripDays, weekdayOf } from '../lib/tripUtils'

const pad2 = (n) => String(n).padStart(2, '0')

export default function TripDetailPage() {
  const { tripId } = useParams()
  return (
    <div className="page page--trip">
      <BackBar fallback="/trips" label="旅の記録" />
      <RecordsGate>
        <TripView tripId={tripId} />
      </RecordsGate>
    </div>
  )
}

function TripView({ tripId }) {
  const { records, trips, tripsReady } = useRecords()
  const summary = useMemo(() => {
    const trip = tripsReady ? trips.find((t) => t.id === tripId) : null
    return trip ? buildTripSummaries(records, [trip])[0] : null
  }, [records, trips, tripsReady, tripId])

  if (!summary) {
    return (
      <div className="empty" role="alert">
        <p>この旅は見つかりませんでした。</p>
        <Link to="/trips" className="btn-line">
          旅の記録へ
        </Link>
      </div>
    )
  }

  const days = summary.start ? groupTripDays(summary.records, summary.start) : []
  const multiDay = days.length > 1
  const firstPhotoId = (summary.records.find((r) => r.photos.length > 0) || {}).id

  return (
    <>
      <header className="page-head trip-cover">
        <p className="eyebrow">Trip</p>
        <h1 className="page-title">{summary.trip.title}</h1>
        {summary.start && <p className="trip-cover__dates">{formatTripRange(summary.start, summary.end)}</p>}
        {summary.records.length > 0 && (
          <p className="trip-cover__facts">
            <span>{summary.records.length}件の記録</span>
            {summary.days > 1 && <span>{summary.days}日間</span>}
            {summary.photoCount > 0 && <span>写真 {summary.photoCount}枚</span>}
          </p>
        )}
      </header>

      {summary.records.length === 0 ? (
        <p className="empty">この旅には、まだ記録がありません。</p>
      ) : (
        <div className="trip-days">
          {days.map((d) => (
            <section key={d.date} className="trip-day" aria-label={multiDay ? `DAY ${pad2(d.day)}` : undefined}>
              {multiDay && (
                <h2 className="trip-day__head">
                  <span className="trip-day__no">DAY {pad2(d.day)}</span>
                  <span className="trip-day__date">
                    {formatDotDate(d.date)}（{weekdayOf(d.date)}）
                  </span>
                </h2>
              )}
              <ol className="trip-stops">
                {d.records.map((r) => (
                  <li key={r.id}>
                    <TripStop record={r} priority={r.id === firstPhotoId} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

// 旅の中の1つの記録：写真（3:2）＋場所名・都道府県。写真の無い記録は文字だけ（枠を出さない）
function TripStop({ record, priority }) {
  const pref = getPrefecture(record.prefectureId)
  const hasPhoto = record.photos.length > 0
  return (
    <Link to={`/record/${record.id}`} className={hasPhoto ? 'stop' : 'stop stop--text'}>
      {hasPhoto && <Photo photo={record.photos[0]} ratio="3 / 2" className="stop__photo" fade priority={priority} />}
      <div className="stop__caption">
        <h3 className="stop__title">{record.placeName}</h3>
        <p className="stop__meta">
          {pref.name}
          {record.photos.length > 1 && <span className="stop__count">{record.photos.length}枚</span>}
        </p>
      </div>
    </Link>
  )
}
