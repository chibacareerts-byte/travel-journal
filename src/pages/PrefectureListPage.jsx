// 都道府県一覧（地方ごと）。訪問済みは藍色で、記録件数つき。
import { Link } from 'react-router-dom'
import BackBar from '../components/BackBar'
import { PREFECTURES, REGIONS } from '../data/prefectures'
import { useRecords } from '../lib/RecordsContext'
import { countByPrefecture } from '../lib/recordUtils'
import { LoadError } from '../components/RecordsGate'

export default function PrefectureListPage() {
  const { records, loading, error } = useRecords()
  // 読み込み中・失敗中は、件数を出さない（「—」や未訪問の色にしない）
  const pending = loading || error
  const counts = pending ? {} : countByPrefecture(records)

  return (
    <div className="page">
      <BackBar fallback="/" />
      <header className="page-head">
        <p className="eyebrow">Index</p>
        <h1 className="page-title">都道府県一覧</h1>
      </header>

      {error && <LoadError tight />}

      {REGIONS.map((region) => (
        <section key={region} className="index-group">
          <h2 className="index-group__title">{region}</h2>
          <ul>
            {PREFECTURES.filter((p) => p.region === region).map((p) => (
              <li key={p.id}>
                <Link
                  to={`/prefecture/${p.id}`}
                  className={counts[p.id] ? 'index-row is-visited' : 'index-row'}
                >
                  <span>{p.name}</span>
                  <span className="index-row__count">{pending ? '' : counts[p.id] ? `${counts[p.id]}件` : '—'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
