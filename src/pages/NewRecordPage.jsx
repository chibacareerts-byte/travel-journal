// 4. 新規記録。入力項目は「場所名・都道府県・訪問日・写真・メモ・タグ」だけ。
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import RecordFields, { today } from '../components/RecordFields'
import { useRecords } from '../lib/RecordsContext'

const MAX_PHOTOS = 10

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
  const [saveError, setSaveError] = useState('')

  // 同じ画面のまま URL が変わったとき（例：ポップアップ経由で開いたあと、下の「＋」を押して /new に戻した）は、
  // 都道府県を URL に合わせ直す。/new なら未選択に戻る
  useEffect(() => {
    setPrefectureId(prefectureParam)
  }, [prefectureParam])

  const canSave = placeName.trim() !== '' && prefectureId !== '' && !saving

  // 共通の入力欄（RecordFields）から届いた変更を、それぞれの state に反映する
  const fieldSetters = { placeName: setPlaceName, prefectureId: setPrefectureId, visitedOn: setVisitedOn, memo: setMemo, tags: setTags }

  function handleFiles(e) {
    const files = Array.from(e.target.files).slice(0, MAX_PHOTOS - photos.length)
    const added = files.map((file, i) => ({
      id: `new-${Date.now()}-${i}`,
      src: URL.createObjectURL(file), // 画面に表示するための一時的なURL
      file, // 保存するときに Storage へ送る、選んだ元の画像
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
    setSaveError('')
    try {
      const created = await addRecord({
        placeName: placeName.trim(),
        prefectureId: Number(prefectureId),
        visitedOn,
        photos,
        memo: memo.trim(),
        tags,
      })
      navigate(`/record/${created.id}`, { replace: true })
    } catch (error) {
      console.error('記録の保存に失敗しました', error)
      // 写真の保存で失敗したときは、何が起きたか（成功・失敗・取り消し）が分かるメッセージを出す
      setSaveError(error.userMessage || '保存できませんでした。もう一度お試しください。')
      setSaving(false) // 保存中のままにならないよう、ボタンを押せる状態に戻す
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">New Record</p>
        <h1 className="page-title">新規記録</h1>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <RecordFields
          placeName={placeName}
          prefectureId={prefectureId}
          visitedOn={visitedOn}
          memo={memo}
          tags={tags}
          onChange={(field, value) => fieldSetters[field](value)}
        >
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
        </RecordFields>

        <div className="form__submit">
          <button type="submit" className="btn-primary" disabled={!canSave}>
            {saving ? '保存中…' : '記録する'}
          </button>
          {saving && photos.length > 0 && <p className="field__hint" role="status">写真を保存しています</p>}
          {!canSave && !saving && <p className="field__hint">場所名と都道府県を入力すると保存できます。</p>}
          {saveError && <p className="notice" role="alert">{saveError}</p>}
        </div>
      </form>
    </div>
  )
}
