// 2. 都道府県ページ（例：京都府）。訪れた場所を写真中心で一覧表示。
import { Link, useParams } from 'react-router-dom'
import BackBar from '../components/BackBar'
import RecordEntry from '../components/RecordEntry'
import { getPrefecture } from '../data/prefectures'
import { useRecords } from '../lib/RecordsContext'

export default function PrefecturePage() {
  const { id } = useParams()
  const { records } = useRecords()
  const pref = getPrefecture(id)

  if (!pref) {
    return (
      <div className="page">
        <BackBar fallback="/" />
        <p className="empty">都道府県が見つかりません。</p>
      </div>
    )
  }

  const list = records.filter((r) => r.prefectureId === pref.id)

  return (
    <div className="page">
      <BackBar fallback="/" label="地図" />
      <header className="page-head">
        <p className="eyebrow">{pref.region}</p>
        <h1 className="page-title">{pref.name}</h1>
        <p className="page-sub">{list.length > 0 ? `${list.length}件の記録` : ''}</p>
      </header>

      {list.length === 0 ? (
        <div className="empty">
          <p>まだ記録がありません。</p>
          <Link to={`/new?prefecture=${pref.id}`} className="btn-line">
            {pref.name}の記録をつける
          </Link>
        </div>
      ) : (
        <div className="entry-list">
          {list.map((r) => (
            <RecordEntry key={r.id} record={r} showPrefecture={false} />
          ))}
        </div>
      )}
    </div>
  )
}
