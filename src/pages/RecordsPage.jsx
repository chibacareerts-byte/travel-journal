// 「記録」タブ：すべての記録を、新しい順に大きな写真で。
// 並べ替え（新しい順・古い順）は、取得済みの records をブラウザ側で並べ替えるだけ。
// Supabase への追加通信は行わない。
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DateSortToggle from '../components/DateSortToggle'
import RecordEntry from '../components/RecordEntry'
import RecordsGate, { EmptyRecords } from '../components/RecordsGate'
import { useRecords } from '../lib/RecordsContext'
import { sortOldestFirst } from '../lib/recordUtils'

export default function RecordsPage() {
  const { records, loading, error } = useRecords()
  const [order, setOrder] = useState('newest') // 'newest' | 'oldest'（初期は新しい順）

  // records はもともと新しい順（RecordsContext）。古い順のときだけ並べ替える
  // （sort は安定ソートなので、同じ訪問日どうしはいまの表示順のまま）。
  const sortedRecords = useMemo(
    () => (order === 'oldest' ? sortOldestFirst(records) : records),
    [records, order],
  )

  return (
    <div className="page page--records">
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
          <div className="entry-list">
            {sortedRecords.map((r) => (
              <RecordEntry key={r.id} record={r} />
            ))}
          </div>
        )}
      </RecordsGate>
    </div>
  )
}
