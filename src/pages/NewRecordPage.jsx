// 4. 新規記録。入力項目は「場所名・都道府県・訪問日・写真・メモ・タグ」だけ。
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import TagPicker from '../components/TagPicker'
import { REGIONS, PREFECTURES } from '../data/prefectures'
import { useRecords } from '../lib/RecordsContext'

const MAX_PHOTOS = 10

// メモ欄：文字が増えたら、高さを中身に合わせて広げる
function autoGrow(el) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`
}

// 今日の日付を 'YYYY-MM-DD'（日本時間などの端末の時刻）で返す
const today = () => new Date().toLocaleDateString('sv-SE')

export default function NewRecordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addRecord } = useRecords()

  const [placeName, setPlaceName] = useState('')
  // ポップアップの「この県の記録をつける」から来たときだけ、URL に ?prefecture=番号 が付く
  const prefectureParam = searchParams.get('prefecture') || ''
  const [prefectureId, setPrefectureId] = useState(prefectureParam)
  const [visitedOn, setVisitedOn] = useState(today())
  const [photos, setPhotos] = useState([]) // { id, src }
  const [memo, setMemo] = useState('')
  const [tags, setTags] = useState([])
  const [saving, setSaving] = useState(false)

  // 同じ画面のまま URL が変わったとき（例：ポップアップ経由で開いたあと、下の「＋」を押して /new に戻した）は、
  // 都道府県を URL に合わせ直す。/new なら未選択に戻る
  useEffect(() => {
    setPrefectureId(prefectureParam)
  }, [prefectureParam])

  const canSave = placeName.trim() !== '' && prefectureId !== '' && !saving

  function handleFiles(e) {
    const files = Array.from(e.target.files).slice(0, MAX_PHOTOS - photos.length)
    const added = files.map((file, i) => ({
      id: `new-${Date.now()}-${i}`,
      src: URL.createObjectURL(file), // 画面に表示するための一時的なURL
    }))
    setPhotos((prev) => [...prev, ...added])
    e.target.value = '' // 同じ写真をもう一度選べるように
  }

  function removePhoto(id) {
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    const created = await addRecord({
      placeName: placeName.trim(),
      prefectureId: Number(prefectureId),
      visitedOn,
      photos,
      memo: memo.trim(),
      tags,
    })
    navigate(`/record/${created.id}`, { replace: true })
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">New Record</p>
        <h1 className="page-title">新規記録</h1>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field__label" htmlFor="placeName">場所名</label>
          <input
            id="placeName"
            className="input"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="prefecture">都道府県</label>
          <select
            id="prefecture"
            className="input input--select"
            value={prefectureId}
            onChange={(e) => setPrefectureId(e.target.value)}
          >
            <option value="">選択してください</option>
            {REGIONS.map((region) => (
              <optgroup key={region} label={region}>
                {PREFECTURES.filter((p) => p.region === region).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="visitedOn">訪問日</label>
          <input
            id="visitedOn"
            type="date"
            className="input"
            value={visitedOn}
            max={today()}
            onChange={(e) => setVisitedOn(e.target.value)}
          />
        </div>

        <div className="field">
          <div className="field__label field__label--row">
            <span>写真</span>
            <span className="field__count">{photos.length} / {MAX_PHOTOS}</span>
          </div>
          <div className="photo-picker">
            {photos.map((p, i) => (
              <div key={p.id} className="photo-picker__item">
                <img src={p.src} alt="" />
                {i === 0 && <span className="photo-picker__cover">表紙</span>}
                <button
                  type="button"
                  className="photo-picker__remove"
                  onClick={() => removePhoto(p.id)}
                  aria-label="この写真を外す"
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="photo-picker__add">
                <input type="file" accept="image/*" multiple onChange={handleFiles} />
                <span className="photo-picker__plus">＋</span>
                <span>写真を選ぶ</span>
              </label>
            )}
          </div>
          <p className="field__hint">1枚目が記録の表紙になります。</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="memo">メモ</label>
          <textarea
            id="memo"
            className="input input--area"
            rows={1}
            value={memo}
            onChange={(e) => {
              setMemo(e.target.value)
              autoGrow(e.target)
            }}
          />
        </div>

        <div className="field">
          <span className="field__label">タグ</span>
          <TagPicker selected={tags} onChange={setTags} allowAdd />
        </div>

        <div className="form__submit">
          <button type="submit" className="btn-primary" disabled={!canSave}>
            記録する
          </button>
          {!canSave && !saving && <p className="field__hint">場所名と都道府県を入力すると保存できます。</p>}
        </div>
      </form>
    </div>
  )
}
