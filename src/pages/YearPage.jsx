// 年別の記録一覧（例：2025年）
import { useParams } from 'react-router-dom'
import BackBar from '../components/BackBar'
import RecordEntry from '../components/RecordEntry'
import { useRecords } from '../lib/RecordsContext'
import { getYear } from '../lib/recordUtils'

export default function YearPage() {
  const { year } = useParams()
  const { records } = useRecords()
  const list = records.filter((r) => getYear(r) === year)

  return (
    <div className="page">
      <BackBar fallback="/years" label="年別" />
      <header className="page-head">
        <p className="eyebrow">{list.length}件の記録</p>
        <h1 className="page-title">{year}</h1>
      </header>

      {list.length === 0 ? (
        <p className="empty">この年の記録はありません。</p>
      ) : (
        <div className="entry-list">
          {list.map((r) => (
            <RecordEntry key={r.id} record={r} />
          ))}
        </div>
      )}
    </div>
  )
}
