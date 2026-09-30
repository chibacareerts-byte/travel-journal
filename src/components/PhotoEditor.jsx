// 記録の編集画面で使う、写真の追加・削除・並べ替え。
// 写真をタップして選ぶと、下の操作バーで「前へ」「次へ」「削除」ができます（ドラッグ操作は使いません）。
// 先頭の写真が、その記録の代表写真（表紙）です。代表写真を変えたいときは、写真を「前へ」で先頭まで動かします。
//
// items: [{ key, kind: 'existing', id, path, src } | { key, kind: 'new', file, src(blob URL) }]
// ここでは画面上の並びを変えるだけです。Storage への保存・削除は、「保存する」を押したあと recordsApi.js が行います。
//
// dates    : Map(写真の key → 撮影日)。今回追加した写真のうち、撮影日が取れたものだけ写真の下に表示する
// children : 写真欄の最後に差し込むもの（撮影日を訪問日に設定する欄）

import { useState } from 'react'
import { formatDotDate } from '../lib/recordUtils'

export const MAX_PHOTOS = 10

export default function PhotoEditor({ items, onChange, dates, children }) {
  const [selectedKey, setSelectedKey] = useState(null)
  const index = items.findIndex((item) => item.key === selectedKey)
  const hasSelection = index !== -1
  const dateOf = (item) => (dates && dates.get(item.key)) || null
  const anyDate = items.some((item) => dateOf(item))

  function handleFiles(e) {
    const room = MAX_PHOTOS - items.length
    const added = Array.from(e.target.files)
      .slice(0, Math.max(room, 0))
      .map((file, i) => ({
        key: `new-${Date.now()}-${i}`,
        kind: 'new',
        file, // 保存するときに縮小して Storage へ送る、選んだ元の画像
        src: URL.createObjectURL(file), // 画面に表示するための一時的なURL
      }))
    onChange([...items, ...added])
    e.target.value = '' // 同じ写真をもう一度選べるように
  }

  function move(delta) {
    const next = [...items]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function remove() {
    const item = items[index]
    if (item.kind === 'new') URL.revokeObjectURL(item.src)
    onChange(items.filter((_, i) => i !== index)) // まだ Storage からは消さない（保存したあとで消す）
    setSelectedKey(null)
  }

  return (
    <div className="field">
      <div className="field__label field__label--row">
        <span>写真</span>
        <span className="field__count">{items.length} / {MAX_PHOTOS}</span>
      </div>

      <div className={anyDate ? 'photo-picker photo-picker--dated' : 'photo-picker'}>
        {items.map((item, i) => (
          <div key={item.key} className="photo-picker__cell">
            <button
              type="button"
              className={item.key === selectedKey ? 'photo-picker__item photo-picker__select is-selected' : 'photo-picker__item photo-picker__select'}
              onClick={() => setSelectedKey(item.key === selectedKey ? null : item.key)}
              aria-pressed={item.key === selectedKey}
              aria-label={`${i + 1}枚目の写真${item.key === selectedKey ? '（選択中）' : ''}`}
            >
              <img src={item.src} alt="" />
              {i === 0 && <span className="photo-picker__cover">表紙</span>}
            </button>
            {dateOf(item) && <span className="photo-picker__date">{formatDotDate(dateOf(item))}</span>}
          </div>
        ))}
        {items.length < MAX_PHOTOS && (
          <label className="photo-picker__add">
            <input type="file" accept="image/*" multiple onChange={handleFiles} />
            <span className="photo-picker__plus">＋</span>
            <span>写真を選ぶ</span>
          </label>
        )}
      </div>

      <div className="photo-actions">
        <button type="button" className="btn-line" onClick={() => move(-1)} disabled={!hasSelection || index === 0}>
          ← 前へ
        </button>
        <button type="button" className="btn-line" onClick={() => move(1)} disabled={!hasSelection || index === items.length - 1}>
          次へ →
        </button>
        <button type="button" className="btn-line photo-actions__remove" onClick={remove} disabled={!hasSelection}>
          削除
        </button>
      </div>
      <p className="field__hint">先頭の写真が表紙になります。写真をタップして選ぶと、並べ替えや削除ができます。</p>
      {children}
    </div>
  )
}
