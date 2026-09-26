// 6. 年別の振り返り。年ごとに「代表写真」と「記録件数」を表示。
// 代表写真は、その年でいちばん新しい記録の1枚目です（あとで自由に選べるようにできます）。
import { Link } from 'react-router-dom'
import Photo from '../components/Photo'
import { useRecords } from '../lib/RecordsContext'
import { groupByYear } from '../lib/recordUtils'

export default function YearsPage() {
  const { records } = useRecords()
  const years = groupByYear(records)

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">By Year</p>
        <h1 className="page-title">年別</h1>
      </header>

      <div className="entry-list year-list">
        {years.map(({ year, records: list }) => (
          <Link key={year} to={`/years/${year}`} className="year-entry">
            <div className="year-entry__media">
              <Photo photo={list[0].photos[0]} ratio="16 / 10" />
              <div className="year-entry__label">
                <span className="year-entry__year">{year}</span>
                <span className="year-entry__count">{list.length}件の記録</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
