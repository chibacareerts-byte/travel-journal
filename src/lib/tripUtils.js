// 「旅」の表示のための、画面に依存しない小さな関数集（Supabase への通信はしない）。
// 旅の開始日・終了日は DB に持たず、旅に入っている記録の訪問日の最小・最大から、ここで計算する。

import { formatDotDate, sortOldestFirst } from './recordUtils'

export const TRIP_TITLE_MAX = 60 // supabase/trips.sql の check 制約と同じ

// 旅の名前：前後の空白を取り、続く空白は1つにして、60文字まで
export function cleanTripTitle(title) {
  return String(title ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TRIP_TITLE_MAX)
}

// 「新しい旅を作る」の入力中で、名前が空のまま（保存できない）かどうか
export function tripDraftIsEmpty(value) {
  return value.newTitle !== null && cleanTripTitle(value.newTitle) === ''
}

// 旅の期間の表示
//   同じ日          → '2026.09.18'
//   同じ年          → '2026.09.18 — 09.20'
//   年をまたぐ      → '2025.12.30 — 2026.01.02'
export function formatTripRange(start, end) {
  if (!start) return ''
  if (!end || start === end) return formatDotDate(start)
  if (start.slice(0, 4) === end.slice(0, 4)) return `${formatDotDate(start)} — ${formatDotDate(end.slice(5))}`
  return `${formatDotDate(start)} — ${formatDotDate(end)}`
}

// 旅ごとの期間 → Map(tripId → { start, end, count })。旅に入っていない記録は数えない
export function tripDateRanges(records) {
  const map = new Map()
  for (const r of records) {
    if (!r.tripId) continue
    const cur = map.get(r.tripId)
    if (!cur) {
      map.set(r.tripId, { start: r.visitedOn, end: r.visitedOn, count: 1 })
    } else {
      if (r.visitedOn < cur.start) cur.start = r.visitedOn
      if (r.visitedOn > cur.end) cur.end = r.visitedOn
      cur.count += 1
    }
  }
  return map
}

// 旅の選択肢の並び：最近の旅ほど上（旅の最後の訪問日。記録がまだ無い旅は、作った日）
export function sortTripsForPicker(trips, ranges) {
  const keyOf = (t) => (ranges.get(t.id) ? ranges.get(t.id).end : String(t.createdAt || '').slice(0, 10))
  return [...trips].sort((a, b) => keyOf(b).localeCompare(keyOf(a)))
}

// 記録一覧の並び（旅ごと＋旅に入っていない記録）を作る。
//   records : 新しい順に並んだ記録（RecordsContext の records。そのまま渡す。書き換えない）
//   trips   : 旅の一覧（旅の機能が使えないときは []）
//   order   : 'newest' | 'oldest'
// 戻り値：[{ type: 'trip', key, trip, start, end, records } | { type: 'loose', key, records }]
//   ・旅は、新しい順ならその旅で最も新しい訪問日、古い順なら最も古い訪問日で並べる
//   ・旅の中の記録も、同じ向きで並べる
//   ・旅に入っていない記録は、自分の訪問日で旅と一緒に並ぶ。続けて並んだものは1つのまとまり（loose）にする
//   ・並べ替えは安定ソート：同じ日付どうしは、いまの表示順（records の順）のまま
//   ・旅の一覧に無い trip_id（削除済みなど）の記録は、旅に入っていない記録として表示する
export function buildRecordSections(records, trips, order) {
  const tripById = new Map(trips.map((t) => [t.id, t]))
  const sections = []
  const tripSections = new Map()

  for (const r of records) {
    const trip = r.tripId ? tripById.get(r.tripId) : undefined
    if (!trip) {
      sections.push({ type: 'record', key: `record-${r.id}`, start: r.visitedOn, end: r.visitedOn, record: r })
      continue
    }
    let s = tripSections.get(trip.id)
    if (!s) {
      s = { type: 'trip', key: `trip-${trip.id}`, trip, start: r.visitedOn, end: r.visitedOn, records: [] }
      tripSections.set(trip.id, s)
      sections.push(s)
    }
    s.records.push(r)
    if (r.visitedOn < s.start) s.start = r.visitedOn
    if (r.visitedOn > s.end) s.end = r.visitedOn
  }

  const oldest = order === 'oldest'
  if (oldest) {
    for (const s of tripSections.values()) s.records = sortOldestFirst(s.records)
  }
  const sorted = [...sections].sort(
    oldest ? (a, b) => a.start.localeCompare(b.start) : (a, b) => b.end.localeCompare(a.end),
  )

  const out = []
  for (const s of sorted) {
    if (s.type === 'trip') {
      out.push(s)
      continue
    }
    const last = out[out.length - 1]
    if (last && last.type === 'loose') last.records.push(s.record)
    else out.push({ type: 'loose', key: s.key, records: [s.record] })
  }
  return out
}
