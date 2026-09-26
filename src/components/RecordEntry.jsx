// 記録一覧の1件分。写真を大きく、その下に小さく文字を添えます（カードの枠はなし）。
// compact=true のときは、2列並びの小さい表示（検索結果用）。
// variant="year" のときは、年別ページ用の表示：日付は年を省き、タグは出さず、
//   写真がない記録は、写真の枠なしの文字だけで表示します（variant を指定しない画面は、今までと同じ表示）。

import { Link } from 'react-router-dom'
import Photo from './Photo'
import TagList from './TagList'
import { getPrefecture } from '../data/prefectures'
import { formatDate, formatMonthDay } from '../lib/recordUtils'

export default function RecordEntry({ record, showPrefecture = true, compact = false, variant }) {
  const pref = getPrefecture(record.prefectureId)
  const isYear = variant === 'year'
  const date = isYear ? formatMonthDay(record.visitedOn) : formatDate(record.visitedOn)
  const meta = showPrefecture ? `${pref.name}　${date}` : date

  // 年別ページで写真がない記録：「Photo」の枠は出さず、文字だけ
  if (isYear && record.photos.length === 0) {
    return (
      <Link to={`/record/${record.id}`} className="entry entry--text">
        <div className="entry__caption">
          <h3 className="entry__title">{record.placeName}</h3>
          <p className="entry__meta">{meta}</p>
        </div>
      </Link>
    )
  }

  return (
    <Link to={`/record/${record.id}`} className={compact ? 'entry entry--compact' : 'entry'}>
      <Photo photo={record.photos[0]} ratio={compact ? '1 / 1' : '3 / 2'} />
      <div className="entry__caption">
        <h3 className="entry__title">{record.placeName}</h3>
        <p className="entry__meta">{meta}</p>
        {!compact && !isYear && <TagList tags={record.tags} />}
      </div>
    </Link>
  )
}
