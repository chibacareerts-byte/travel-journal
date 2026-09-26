// 「記録」タブ：すべての記録を、新しい順に大きな写真で。
import RecordEntry from '../components/RecordEntry'
import RecordsGate, { EmptyRecords } from '../components/RecordsGate'
import { useRecords } from '../lib/RecordsContext'

export default function RecordsPage() {
  const { records, loading, error } = useRecords()

  return (
    <div className="page page--records">
      <header className="page-head">
        <p className="eyebrow">All Records</p>
        <h1 className="page-title">記録</h1>
        <p className="page-sub">{loading || error || records.length === 0 ? '' : `${records.length}件`}</p>
      </header>

      <RecordsGate>
        {records.length === 0 ? (
          <EmptyRecords />
        ) : (
          <div className="entry-list">
            {records.map((r) => (
              <RecordEntry key={r.id} record={r} />
            ))}
          </div>
        )}
      </RecordsGate>
    </div>
  )
}
