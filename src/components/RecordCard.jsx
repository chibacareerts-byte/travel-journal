// 記録一覧（/records）だけで使う、1列のカード。
//   ┌──────────────┐
//   │  写真（3:2）   │  ← 写真がある記録だけ。写真なしの記録にダミー画像は入れない
//   ├──────────────┤  ← 細い境界線
//   │ 清水寺         │
//   │ 京都府 2026.09.18│
//   │ #寺  #建築     │
//   └──────────────┘
// 検索・年別・都道府県ページは、今まで通り RecordEntry を使う（このカードは使わない）。
// memo：並べ替えで順番が変わるだけのときは、カードを描き直さない
// priority：一覧のいちばん上のカードだけ true（最初に見える写真を先に読み込む）。写真は読み込めたら静かにフェードイン

import { memo } from 'react'
import { Link } from 'react-router-dom'
import Photo from './Photo'
import { getPrefecture } from '../data/prefectures'
import { formatDotDate } from '../lib/recordUtils'

function RecordCard({ record, priority = false }) {
  const pref = getPrefecture(record.prefectureId)
  const hasPhoto = record.photos.length > 0 // 写真の判定は、今までと同じく photos.length だけ

  return (
    <Link to={`/record/${record.id}`} className={hasPhoto ? 'rcard' : 'rcard rcard--text'}>
      {hasPhoto && <Photo photo={record.photos[0]} ratio="3 / 2" className="rcard__photo" fade priority={priority} />}
      <div className="rcard__body">
        <h3 className="rcard__title">{record.placeName}</h3>
        <p className="rcard__meta">
          {pref.name}
          <span className="rcard__date">{formatDotDate(record.visitedOn)}</span>
        </p>
        {record.tags.length > 0 && (
          <p className="rcard__tags">
            {record.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </p>
        )}
      </div>
    </Link>
  )
}

export default memo(RecordCard)
