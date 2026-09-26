// 記録一覧の1件分。写真を大きく、その下に小さく文字を添えます（カードの枠はなし）。
// compact=true のときは、2列並びの小さい表示（検索結果用）。

import { Link } from 'react-router-dom'
import Photo from './Photo'
import TagList from './TagList'
import { getPrefecture } from '../data/prefectures'
import { formatDate } from '../lib/recordUtils'

export default function RecordEntry({ record, showPrefecture = true, compact = false }) {
  const pref = getPrefecture(record.prefectureId)
  const meta = showPrefecture
    ? `${pref.name}　${formatDate(record.visitedOn)}`
    : formatDate(record.visitedOn)

  return (
    <Link to={`/record/${record.id}`} className={compact ? 'entry entry--compact' : 'entry'}>
      <Photo photo={record.photos[0]} ratio={compact ? '1 / 1' : '3 / 2'} />
      <div className="entry__caption">
        <h3 className="entry__title">{record.placeName}</h3>
        <p className="entry__meta">{meta}</p>
        {!compact && <TagList tags={record.tags} />}
      </div>
    </Link>
  )
}
