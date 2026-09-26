// 記録の入力欄のうち、「新規記録」と「記録の編集」で共通の5項目：
//   場所名・都道府県・訪問日・メモ・タグ
// 写真欄は新規記録だけにあるので、この部品の中には含めず、children として
// 「訪問日」と「メモ」の間に差し込めるようにしています（項目の並び順を変えないため）。
//
// 値は親が持ちます。値を変えるときは onChange('placeName', 値) のように、項目名と新しい値を渡します。

import { useLayoutEffect, useRef } from 'react'
import TagPicker from './TagPicker'
import { REGIONS, PREFECTURES } from '../data/prefectures'

// 今日の日付を 'YYYY-MM-DD'（日本時間などの端末の時刻）で返す
export const today = () => new Date().toLocaleDateString('sv-SE')

// メモ欄：文字が増えたら、高さを中身に合わせて広げる
function autoGrow(el) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`
}

export default function RecordFields({ placeName, prefectureId, visitedOn, memo, tags, onChange, children }) {
  const memoRef = useRef(null)

  // 最初から文章が入っているとき（編集画面）も、高さを内容に合わせる。空のとき（新規記録）は何もしない
  useLayoutEffect(() => {
    if (memoRef.current && memoRef.current.value) autoGrow(memoRef.current)
  }, [])

  return (
    <>
      <div className="field">
        <label className="field__label" htmlFor="placeName">場所名</label>
        <input
          id="placeName"
          className="input"
          value={placeName}
          enterKeyHint="next"
          onKeyDown={(e) => {
            // Enter だけで、フォーム全体が送信（保存）されないようにする。次の欄（都道府県）へ進む。
            // 日本語入力の変換確定のEnter（isComposing）には触れない
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              document.getElementById('prefecture')?.focus()
            }
          }}
          onChange={(e) => onChange('placeName', e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="prefecture">都道府県</label>
        <select
          id="prefecture"
          className="input input--select"
          value={prefectureId}
          onChange={(e) => onChange('prefectureId', e.target.value)}
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
          onChange={(e) => onChange('visitedOn', e.target.value)}
        />
      </div>

      {children}

      <div className="field">
        <label className="field__label" htmlFor="memo">メモ</label>
        <textarea
          id="memo"
          ref={memoRef}
          className="input input--area"
          rows={1}
          value={memo}
          onChange={(e) => {
            onChange('memo', e.target.value)
            autoGrow(e.target)
          }}
        />
      </div>

      <div className="field">
        <span className="field__label">タグ</span>
        <TagPicker selected={tags} onChange={(next) => onChange('tags', next)} allowAdd />
      </div>
    </>
  )
}
