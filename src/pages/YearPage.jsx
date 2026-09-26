// 年別詳細（例：2026年）。その年の旅を、1月 → 12月 の流れで静かに振り返るページ。
//   上：年号（年別一覧と同じ書体）と、記録数・訪れた都道府県数
//   下：月ごとの見出し ＋ その月の記録（訪問日の古い順、すべて1列）
import { useParams } from 'react-router-dom'
import BackBar from '../components/BackBar'
import RecordEntry from '../components/RecordEntry'
import RecordsGate from '../components/RecordsGate'
import { useRecords } from '../lib/RecordsContext'
import { getYear, groupByMonth, getYearSummary, MONTH_EN } from '../lib/recordUtils'

export default function YearPage() {
  const { year } = useParams()
  const { records, loading, error } = useRecords()
  const list = records.filter((r) => getYear(r) === year)
  const months = groupByMonth(list)
  const { count, prefectureCount } = getYearSummary(list)
  // 読み込み中・失敗中は、「0件」などの要約を出さない
  const showSummary = !loading && !error && count > 0

  return (
    <div className="page">
      <BackBar fallback="/years" label="年別" />
      <header className="page-head year-head">
        <p className="eyebrow">By Year</p>
        <h1 className="year-head__num">{year}</h1>
        {showSummary && <p className="year-head__sum">{count}件の記録・{prefectureCount}都道府県</p>}
      </header>

      <RecordsGate>
        {list.length === 0 ? (
          <p className="empty">この年の記録はありません。</p>
        ) : (
          months.map(({ month, records: items }) => (
            <section key={month} className="month">
              <h2 className="month__title" aria-label={`${month}月`}>
                <span className="month__num" aria-hidden="true">{String(month).padStart(2, '0')}</span>
                <span className="month__name" aria-hidden="true">{MONTH_EN[month - 1]}</span>
              </h2>
              <div className="entry-list">
                {items.map((r) => (
                  <RecordEntry key={r.id} record={r} variant="year" />
                ))}
              </div>
            </section>
          ))
        )}
      </RecordsGate>
    </div>
  )
}
