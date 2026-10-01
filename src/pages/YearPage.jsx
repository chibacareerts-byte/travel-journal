// 年別詳細（例：2026年）。その年の旅を、1月 → 12月 の流れで静かに振り返るページ。
//   上：年号（年別一覧と同じ書体）と、記録数・訪れた都道府県数
//   月の選択：「すべての月」＋ 01〜12 の大きな月数字（英語の月名と、その月の記録数）。記録の無い月は淡く、選べない
//   下：月ごとの見出し ＋ その月の記録（訪問日の古い順、すべて1列）。月を選ぶと、その月だけ
// 選んだ月は URL（/years/2026?month=9）に置く。直接開いても、記録詳細から戻っても同じ月のまま。
// 月を選び直しても履歴は増やさない（戻るで年別の一覧へ戻れる）。
import { useParams, useSearchParams } from 'react-router-dom'
import BackBar from '../components/BackBar'
import ChoiceRow from '../components/ChoiceRow'
import RecordEntry from '../components/RecordEntry'
import RecordsGate from '../components/RecordsGate'
import { useRecords } from '../lib/RecordsContext'
import { getYear, groupByMonth, getYearSummary, MONTH_EN } from '../lib/recordUtils'

const pad2 = (n) => String(n).padStart(2, '0')
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function YearPage() {
  const { year } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { records, loading, error } = useRecords()
  const list = records.filter((r) => getYear(r) === year)
  const months = groupByMonth(list)
  const { count, prefectureCount } = getYearSummary(list)
  // 読み込み中・失敗中は、「0件」などの要約を出さない
  const showSummary = !loading && !error && count > 0

  const counts = new Map(months.map((m) => [m.month, m.records.length]))
  const monthParam = Number(searchParams.get('month'))
  const month = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : null // null はすべての月
  const shown = month ? months.filter((m) => m.month === month) : months

  function chooseMonth(value) {
    setSearchParams(value === 'all' ? {} : { month: String(value) }, { replace: true })
  }

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
          <>
            <ChoiceRow
              className="month-picker"
              optionClassName="month-pick"
              ariaLabel={`${year}年の月を選ぶ`}
              columns={6}
              value={month ?? 'all'}
              onChange={chooseMonth}
              options={[
                { value: 'all', label: `すべての月、${count}件` },
                ...MONTHS.map((m) => {
                  const n = counts.get(m) || 0
                  return { value: m, label: n > 0 ? `${m}月、${n}件` : `${m}月、記録なし`, disabled: n === 0 && m !== month }
                }),
              ]}
              renderOption={(o) =>
                o.value === 'all' ? (
                  <>
                    <span className="month-pick__all">すべての月</span>
                    <span className="month-pick__count">{count}</span>
                  </>
                ) : (
                  <>
                    <span className="month-pick__num">{pad2(o.value)}</span>
                    <span className="month-pick__en">{MONTH_EN[o.value - 1].slice(0, 3)}</span>
                    <span className="month-pick__count">{counts.get(o.value) || '–'}</span>
                  </>
                )
              }
            />

            <div className="month-view" key={month ?? 'all'}>
              {shown.length === 0 ? (
                <p className="empty">{month}月の記録はありません。</p>
              ) : (
                shown.map(({ month: m, records: items }) => (
                  <section key={m} className="month">
                    <h2 className="month__title" aria-label={`${m}月`}>
                      <span className="month__num" aria-hidden="true">{pad2(m)}</span>
                      <span className="month__name" aria-hidden="true">{MONTH_EN[m - 1]}</span>
                    </h2>
                    <div className="entry-list">
                      {items.map((r) => (
                        <RecordEntry key={r.id} record={r} variant="year" />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </>
        )}
      </RecordsGate>
    </div>
  )
}
