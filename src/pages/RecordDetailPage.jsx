// 3. 記録詳細。1枚目の写真を大きく、その下に情報、最後にギャラリー。
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Photo from '../components/Photo'
import TagList from '../components/TagList'
import Lightbox from '../components/Lightbox'
import { getPrefecture } from '../data/prefectures'
import { useRecords } from '../lib/RecordsContext'
import { formatDate } from '../lib/recordUtils'

export default function RecordDetailPage() {
  const { id } = useParams()
  const { records, loading } = useRecords()
  const navigate = useNavigate()
  const [viewerIndex, setViewerIndex] = useState(null) // null = 拡大していない

  const record = records.find((r) => r.id === id)

  function goBack() {
    if (window.history.state && window.history.state.idx > 0) navigate(-1)
    else navigate('/records')
  }

  if (!record) {
    return (
      <div className="page">
        <p className="empty">{loading ? '' : '記録が見つかりません。'}</p>
      </div>
    )
  }

  const pref = getPrefecture(record.prefectureId)
  const photos = record.photos.length > 0 ? record.photos : [{ id: 'none', src: null, tone: 5 }]
  const gallery = photos.slice(1)

  return (
    <article className="detail">
      {/* 1枚目の写真：タップで拡大 */}
      <div className="detail__hero">
        <button type="button" className="detail__hero-btn" onClick={() => setViewerIndex(0)} aria-label="写真を拡大">
          <Photo photo={photos[0]} ratio="4 / 5" className="detail__hero-photo" />
        </button>
        <button type="button" className="detail__back" onClick={goBack} aria-label="戻る">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </button>
      </div>

      <div className="detail__body">
        <h1 className="detail__title">{record.placeName}</h1>

        <dl className="facts">
          <div className="facts__row">
            <dt>都道府県</dt>
            <dd>
              <Link to={`/prefecture/${pref.id}`}>{pref.name}</Link>
            </dd>
          </div>
          <div className="facts__row">
            <dt>訪問日</dt>
            <dd>{formatDate(record.visitedOn)}</dd>
          </div>
          {record.tags.length > 0 && (
            <div className="facts__row">
              <dt>タグ</dt>
              <dd>
                <TagList tags={record.tags} />
              </dd>
            </div>
          )}
        </dl>

        {record.memo && (
          <section className="memo">
            <h2 className="section-label">メモ</h2>
            <p className="memo__text">{record.memo}</p>
          </section>
        )}
      </div>

      {gallery.length > 0 && (
        <section className="gallery">
          <h2 className="section-label gallery__label">
            Gallery <span>{photos.length}枚</span>
          </h2>
          <div className="gallery__grid">
            {gallery.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className="gallery__item"
                onClick={() => setViewerIndex(i + 1)}
                aria-label={`${i + 2}枚目の写真を拡大`}
              >
                <Photo photo={p} ratio="1 / 1" />
              </button>
            ))}
          </div>
        </section>
      )}

      {viewerIndex !== null && (
        <Lightbox
          photos={photos}
          index={viewerIndex}
          onChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </article>
  )
}
