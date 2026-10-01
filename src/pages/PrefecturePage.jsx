// 2. 都道府県ページ（例：京都府）。訪れた場所を写真中心で一覧表示。
// HOME の地図で年を選んでから来たとき（/prefecture/26?year=2026）は、その年の記録だけを表示し、
// 「すべての年を見る」で、いつもの全部の一覧に戻れる。
import { Link, useParams, useSearchParams } from 'react-router-dom'
import BackBar from '../components/BackBar'
import RecordEntry from '../components/RecordEntry'
import { getPrefecture } from '../data/prefectures'
import RecordsGate from '../components/RecordsGate'
import { useRecords } from '../lib/RecordsContext'
import { getYear } from '../lib/recordUtils'

export default function PrefecturePage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { records, loading, error } = useRecords()
  const pref = getPrefecture(id)

  if (!pref) {
    return (
      <div className="page">
        <BackBar fallback="/" />
        <p className="empty">都道府県が見つかりません。</p>
      </div>
    )
  }

  const yearParam = searchParams.get('year')
  const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : null
  const all = records.filter((r) => r.prefectureId === pref.id)
  const list = year ? all.filter((r) => getYear(r) === year) : all
  const firstPhotoId = (list.find((r) => r.photos.length > 0) || {}).id // 最初に見える写真を、先に読み込む

  return (
    <div className="page">
      <BackBar fallback={year ? `/?year=${year}` : '/'} label="地図" />
      <header className="page-head">
        <p className="eyebrow">{pref.region}</p>
        <h1 className="page-title">{pref.name}</h1>
        <p className="page-sub">{!loading && !error && list.length > 0 ? `${list.length}件の記録` : ''}</p>
        {year && !loading && !error && (
          <p className="scope-note">
            <span className="scope-note__label">
              <span className="scope-note__year">{year}</span>年の記録
            </span>
            {all.length > list.length && list.length > 0 && (
              <Link to={`/prefecture/${pref.id}`} className="scope-note__link" replace>
                すべての年を見る（{all.length}件）
              </Link>
            )}
          </p>
        )}
      </header>

      <RecordsGate>
        {list.length === 0 ? (
          all.length > 0 ? (
            <div className="empty">
              <p>{year}年の記録はありません。</p>
              <Link to={`/prefecture/${pref.id}`} className="btn-line" replace>
                すべての年の記録を見る
              </Link>
            </div>
          ) : (
            <div className="empty">
              <p>まだ記録がありません。</p>
              <Link to={`/new?prefecture=${pref.id}`} className="btn-line">
                {pref.name}の記録をつける
              </Link>
            </div>
          )
        ) : (
          <div className="entry-list">
            {list.map((r) => (
              <RecordEntry key={r.id} record={r} showPrefecture={false} priority={r.id === firstPhotoId} />
            ))}
          </div>
        )}
      </RecordsGate>
    </div>
  )
}
