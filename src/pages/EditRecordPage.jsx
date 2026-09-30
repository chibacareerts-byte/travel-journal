// 記録の編集。場所名・都道府県・訪問日・写真・旅・メモ・タグを編集できます。
// 追加した写真の撮影日（EXIF）が取れたら表示し、その日を訪問日に設定できます（自動では設定しません）。
// 旅は、trips.sql を実行して旅の機能が使えるときだけ表示します。
// 写真は「保存する」を押したときに、はじめて Storage へ保存・削除されます（キャンセルしたら何も変わりません）。
// 追加した写真の縮小だけは、選んだ時点から裏で始めておきます（usePhotoPrep。Storage には何も送りません）。
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BackBar from '../components/BackBar'
import BestListsField, { useRecordBest } from '../components/BestListsField'
import PhotoEditor from '../components/PhotoEditor'
import RecordFields from '../components/RecordFields'
import RecordsGate from '../components/RecordsGate'
import SaveProgress from '../components/SaveProgress'
import ShotDatePicker from '../components/ShotDatePicker'
import TripField from '../components/TripField'
import { useRecords } from '../lib/RecordsContext'
import { tripDraftIsEmpty } from '../lib/tripUtils'
import { usePhotoPrep } from '../lib/usePhotoPrep'
import { useShotDates } from '../lib/useShotDates'

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
  const { updateRecord, tripsReady, ensureTrip } = useRecords()

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
  const [progress, setProgress] = useState(null) // 保存中の、追加した写真の進み具合 { done, total }（追加なしは null）
  const [recordSaved, setRecordSaved] = useState(false) // 記録の保存が済んだあと、MY BESTだけ失敗したとき true（再試行では記録を保存し直さない）
  const best = useRecordBest(record.id)
  const [trip, setTrip] = useState({ tripId: record.tripId ?? null, newTitle: null }) // 旅（TripField の値）
  const shotDates = useShotDates(photoItems) // 今回追加した写真の key → 撮影日
  const photoDates = photoItems.map((item) => shotDates.get(item.key)).filter(Boolean)
  usePhotoPrep(photoItems) // 追加した写真の縮小を、保存を押す前から裏で進める（外した写真は取り消す）

  const tripBlocked = tripsReady && tripDraftIsEmpty(trip) // 新しい旅の名前が空のまま
  const canSave = values.placeName.trim() !== '' && values.prefectureId !== '' && !tripBlocked && !saving

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSave) return // 保存中の二重送信もここで止まる
    setSaving(true)
    setSaveError('')
    setProgress(null) // 写真を追加しているときだけ、下で「0 / n」から表示する（MY BESTだけの再保存では出さない）
    try {
      if (!recordSaved) {
        // 旅：機能が使えないときは undefined（trip_id に一切触れない）。新しい旅は、ここで作る（同じ名前があればそれを使う）
        let tripId
        if (tripsReady) {
          tripId = trip.tripId
          if (trip.newTitle !== null) {
            const made = await ensureTrip(trip.newTitle)
            tripId = made.id
            setTrip({ tripId: made.id, newTitle: null }) // もう一度保存するときは、作った旅をそのまま使う
          }
        }
        // 写真を変えたときだけ、写真も更新する（変えていなければ、写真には一切触れない）
        const photosChanged =
          photoItems.some((item) => item.kind === 'new') ||
          photoItems.length !== record.photos.length ||
          photoItems.some((item, i) => item.id !== record.photos[i].id)
        const newCount = photoItems.filter((item) => item.kind === 'new').length
        setProgress(newCount > 0 ? { done: 0, total: newCount } : null)
        await updateRecord(record.id, {
          placeName: values.placeName.trim(),
          prefectureId: Number(values.prefectureId),
          visitedOn: values.visitedOn,
          memo: values.memo.trim(),
          tags: values.tags,
          tripId,
          photos: photosChanged
            ? photoItems.map((item) =>
                item.kind === 'new' ? { kind: 'new', file: item.file } : { kind: 'existing', id: item.id, path: item.path },
              )
            : undefined,
          onProgress: (done, total) => setProgress({ done, total }),
        })
        setRecordSaved(true)
      }
    } catch (error) {
      console.error('記録の更新に失敗しました', error)
      setSaveError(error.userMessage || '保存できませんでした。もう一度お試しください。')
      setSaving(false) // 入力内容は残したまま、もう一度保存できる状態に戻す
      return
    }

    // MY BEST の更新（記録の保存が成功したあと）。失敗しても、記録は保存済みなので、何が成功し何が失敗したかを伝える
    try {
      await best.save()
    } catch (error) {
      console.error('MY BESTの更新に失敗しました', error)
      setSaveError(
        `記録は保存しました。MY BESTは更新できませんでした（変更は反映されていません）。${error.userMessage || ''}` +
          '［保存する］を押すと、MY BESTだけをもう一度保存します。',
      )
      setSaving(false)
      return
    }

    try {
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
          <PhotoEditor items={photoItems} onChange={setPhotoItems} dates={shotDates}>
            <ShotDatePicker
              dates={photoDates}
              visitedOn={values.visitedOn}
              onPick={(d) => setValues((prev) => ({ ...prev, visitedOn: d }))}
            />
          </PhotoEditor>
          {tripsReady && <TripField value={trip} onChange={setTrip} />}
        </RecordFields>

        <BestListsField best={best} />

        <div className="form__submit">
          <button type="submit" className="btn-primary" disabled={!canSave}>
            {saving ? '保存中…' : '保存する'}
          </button>
          {saving && progress && <SaveProgress done={progress.done} total={progress.total} />}
          {!canSave && !saving && (
            <p className="field__hint">
              {values.placeName.trim() !== '' && values.prefectureId !== '' && tripBlocked
                ? '新しい旅の名前を入力するか、「やめる」を押してください。'
                : '場所名と都道府県を入力すると保存できます。'}
            </p>
          )}
          {saveError && <p className="notice" role="alert">{saveError}</p>}
        </div>
      </form>
    </div>
  )
}
