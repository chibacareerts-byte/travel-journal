// 記録の並べ替え・絞り込み・集計など、画面に依存しない小さな関数集。

export function sortNewestFirst(records) {
  return [...records].sort((a, b) => b.visitedOn.localeCompare(a.visitedOn))
}

// '2025-11-03' → '2025年11月3日'
export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export function getYear(record) {
  return record.visitedOn.slice(0, 4)
}

// 訪問済みの都道府県 id の一覧
export function getVisitedIds(records) {
  return [...new Set(records.map((r) => r.prefectureId))]
}

// 都道府県ごとの記録件数 { 26: 5, 29: 1, ... }
export function countByPrefecture(records) {
  const counts = {}
  records.forEach((r) => {
    counts[r.prefectureId] = (counts[r.prefectureId] || 0) + 1
  })
  return counts
}

// 年ごとにまとめる → [{ year: '2026', records: [...] }, ...] （新しい年が先頭）
export function groupByYear(records) {
  const map = {}
  sortNewestFirst(records).forEach((r) => {
    const y = getYear(r)
    if (!map[y]) map[y] = []
    map[y].push(r)
  })
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((year) => ({ year, records: map[year] }))
}

// 記録の一覧（新しい順）から、写真がある最新の記録の1枚目を返す。1枚もなければ null
export function getRepresentativePhoto(list) {
  const withPhoto = list.find((r) => r.photos.length > 0)
  return withPhoto ? withPhoto.photos[0] : null
}

// 検索条件で絞り込む。条件が空なら、その条件は無視します。
//   keyword      : 場所名に含まれる文字
//   prefectureId : '' or 番号
//   from / to    : 'YYYY-MM-DD'（期間）
//   tags         : 選んだタグ。すべて含む記録だけを残します
export function filterRecords(records, { keyword, prefectureId, from, to, tags }) {
  const kw = keyword.trim().toLowerCase()
  return records.filter((r) => {
    if (kw && !r.placeName.toLowerCase().includes(kw)) return false
    if (prefectureId && r.prefectureId !== Number(prefectureId)) return false
    if (from && r.visitedOn < from) return false
    if (to && r.visitedOn > to) return false
    if (tags.length && !tags.every((t) => r.tags.includes(t))) return false
    return true
  })
}

// 都道府県ごとのまとめ：記録の件数と、代表写真。
// 代表写真は今のところ「いちばん新しい記録の表紙（1枚目）」です。
// 将来「代表写真を指定する機能」を入れるときは、この関数の中だけを差し替えれば、
// ポップアップなど使う側は変更せずに済みます。
export function getPrefectureSummary(records, prefectureId) {
  const list = sortNewestFirst(records.filter((r) => r.prefectureId === Number(prefectureId)))
  const withPhoto = list.find((r) => r.photos.length > 0)
  return {
    count: list.length,
    representative: withPhoto ? { record: withPhoto, photo: withPhoto.photos[0] } : null,
  }
}
