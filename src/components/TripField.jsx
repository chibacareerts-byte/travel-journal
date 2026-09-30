// 新規記録・編集画面の「旅」欄。
//   旅
//   [ 京都旅行（2026.09.18 — 09.20） ▼ ]   ← 「旅に入れない」も選べる
//   ＋ 新しい旅を作る                         ← その場で名前を入力。記録を保存するときに旅も作られる
//
// value    : { tripId: '3' | null, newTitle: null | '入力中の名前' }（newTitle が null でないときは「新しい旅を作る」入力中）
// onChange : 新しい value を渡す
// 旅の機能が使えない（trips.sql 未実行など）ときは、この欄自体を出さない（親が tripsReady を見て判断する）。

import { useMemo } from 'react'
import { useRecords } from '../lib/RecordsContext'
import { TRIP_TITLE_MAX, cleanTripTitle, formatTripRange, sortTripsForPicker, tripDateRanges } from '../lib/tripUtils'

export default function TripField({ value, onChange }) {
  const { trips, records } = useRecords()
  const options = useMemo(() => {
    const ranges = tripDateRanges(records)
    return sortTripsForPicker(trips, ranges).map((t) => ({ ...t, range: ranges.get(t.id) }))
  }, [trips, records])

  const creating = value.newTitle !== null
  const clean = creating ? cleanTripTitle(value.newTitle) : ''
  const sameName = creating && clean ? trips.find((t) => t.title === clean) : null

  return (
    <div className="field trip-field">
      <label className="field__label" htmlFor="trip">旅</label>

      {!creating ? (
        <>
          <select
            id="trip"
            className="input input--select"
            value={value.tripId ?? ''}
            onChange={(e) => onChange({ tripId: e.target.value || null, newTitle: null })}
          >
            <option value="">旅に入れない</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.range ? `${t.title}（${formatTripRange(t.range.start, t.range.end)}）` : t.title}
              </option>
            ))}
          </select>
          <button type="button" className="trip-field__new" onClick={() => onChange({ tripId: value.tripId, newTitle: '' })}>
            ＋ 新しい旅を作る
          </button>
        </>
      ) : (
        <>
          <div className="trip-field__create">
            <input
              id="trip"
              className="input"
              value={value.newTitle}
              maxLength={TRIP_TITLE_MAX}
              placeholder="例：京都旅行"
              aria-label="新しい旅の名前"
              enterKeyHint="done"
              autoFocus
              onChange={(e) => onChange({ tripId: value.tripId, newTitle: e.target.value })}
              onKeyDown={(e) => {
                // Enter で記録のフォーム全体が送信（保存）されないようにする
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.preventDefault()
              }}
            />
            <button type="button" className="btn-line" onClick={() => onChange({ tripId: value.tripId, newTitle: null })}>
              やめる
            </button>
          </div>
          <p className="field__hint">
            {sameName ? `「${sameName.title}」はすでにあります。記録をその旅に入れます。` : '記録を保存すると、この旅も作られます。'}
          </p>
        </>
      )}
    </div>
  )
}

