// 記録の編集。場所名・都道府県・訪問日・写真・メモ・タグを編集できます。
// 写真は「保存する」を押したときに、はじめて Storage へ保存・削除されます（キャンセルしたら何も変わりません）。
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BackBar from '../components/BackBar'
import PhotoEditor from '../components/PhotoEditor'
import RecordFields from '../components/RecordFields'
import RecordsGate from '../components/RecordsGate'
import { useRecords } from '../lib/RecordsContext'

export default function EditRecordPage() {
  const { id } = useParams()
  const { records } = useRecords()
  const record = records.find((r) => r.id === id)

  if (!record) {
    return (
      <div className="page">
        <BackBar fallback="/records" />
        <RecordsGate>
          <p className="empty">記録が見つかりません。</p>
        </RecordsGate>
      </div>
    )
  }

  // 記録が読み込まれてから入力欄を出すので、最初の値（初期値）に、いまの内容をそのまま入れられる
  return <EditForm key={record.id} record={record} />
}

function EditForm({ record }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { updateRecord } = useRecords()

  const [values, setValues] = useState({
    placeName: record.placeName,
    prefectureId: String(record.prefectureId), // select の value は文字列
    visitedOn: record.visitedOn,
    memo: record.memo,
    tags: record.tags,
  })
  // 写真の並び（先頭が代表写真）。保存済みの写真は kind: 'existing'、今回追加した写真は kind: 'new'
  const [photoItems, setPhotoItems] = useState(() =>
    record.photos.map((p) => ({ key: p.id, kind: 'existing', id: p.id, path: p.path, src: p.src })),
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const canSave = values.placeName.trim() !== '' && values.prefectureId !== '' && !saving

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSave) return // 保存中の二重送信もここで止まる
    setSaving(true)
    setSaveError('')
    // 写真を変えたときだけ、写真も更新する（変えていなければ、写真には一切触れない）
    const photosChanged =
      photoItems.some((item) => item.kind === 'new') ||
      photoItems.length !== record.photos.length ||
      photoItems.some((item, i) => item.id !== record.photos[i].id)
    try {
      await updateRecord(record.id, {
        placeName: values.placeName.trim(),
        prefectureId: Number(values.prefectureId),
        visitedOn: values.visitedOn,
        memo: values.memo.trim(),
        tags: values.tags,
        photos: photosChanged
          ? photoItems.map((item) =>
              item.kind === 'new' ? { kind: 'new', file: item.file } : { kind: 'existing', id: item.id, path: item.path },
            )
          : undefined,
      })
      // 詳細画面の［編集］から来たときは、履歴の1つ前が、その記録の詳細画面。
      // そこへ1つ戻る（replace で詳細を重ねると、「戻る」で同じ詳細がもう一度出てしまう）。
      // ［編集］の印（location.state）は再読み込みしても履歴に残るので、再読み込み後も同じ扱いになる。
      // URL を直接開いたときなど、印がない・戻れる履歴がないときは、編集画面を詳細画面に置き換える。
      if (location.state && location.state.fromDetail && window.history.state && window.history.state.idx > 0) {
        navigate(-1)
      } else {
        navigate(`/record/${record.id}`, { replace: true })
      }
    } catch (error) {
      console.error('記録の更新に失敗しました', error)
      setSaveError(error.userMessage || '保存できませんでした。もう一度お試しください。')
      setSaving(false) // 入力内容は残したまま、もう一度保存できる状態に戻す
    }
  }

  return (
    <div className="page">
      <BackBar fallback={`/record/${record.id}`} />
      <header className="page-head">
        <p className="eyebrow">Edit Record</p>
        <h1 className="page-title">記録を編集</h1>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <RecordFields
          {...values}
          onChange={(field, value) => setValues((prev) => ({ ...prev, [field]: value }))}
        >
          <PhotoEditor items={photoItems} onChange={setPhotoItems} />
        </RecordFields>

        <div className="form__submit">
          <button type="submit" className="btn-primary" disabled={!canSave}>
            {saving ? '保存中…' : '保存する'}
          </button>
          {!canSave && !saving && <p className="field__hint">場所名と都道府県を入力すると保存できます。</p>}
          {saveError && <p className="notice" role="alert">{saveError}</p>}
        </div>
      </form>
    </div>
  )
}
