// 記録一覧の1件分。写真を大きく、その下に小さく文字を添えます（カードの枠はなし）。
// compact=true のときは、2列並びの小さい表示（検索結果用）。
// variant="year" のときは、年別ページ用の表示：日付は年を省き、タグは出しません。
// 写真が0枚の記録は、どの画面でも、写真の枠（プレースホルダー）を出さず、文字だけで表示します
//   （場所名・都道府県と日付・タグ）。写真が1枚以上ある記録の表示は変わりません。

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

  // 写真が0枚の記録だけ、文字だけで表示する。
  // 判定は photos.length === 0 のみ：写真のデータはあるが src が取れないとき（読み込み失敗など）は、
  // 写真なしとは扱わず、下の通常の表示（Photo）を通す。
  if (record.photos.length === 0) {
    return (
      <Link to={`/record/${record.id}`} className={compact ? 'entry entry--text entry--compact' : 'entry entry--text'}>
        <div className="entry__caption">
          <h3 className="entry__title">{record.placeName}</h3>
          <p className="entry__meta">{meta}</p>
          {!compact && !isYear && <TagList tags={record.tags} />}
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
