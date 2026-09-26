// 検索用：タグを複数選べるドロップダウン。
// 選んだタグはドロップダウンの下に小さな四角い枠で表示し、× で1つずつ解除できます。

import { useEffect, useRef, useState } from 'react'
import { useRecords } from '../lib/RecordsContext'

export default function TagDropdown({ selected, onChange }) {
  const { tags } = useRecords()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  // 外側をタップ、または Esc キーで閉じる
  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle(tag) {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag])
  }

  return (
    <div>
      <div className="dropdown" ref={rootRef}>
        <button
          type="button"
          className={open ? 'dropdown__button is-open' : 'dropdown__button'}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {selected.length > 0 ? (
            <span>{selected.length}個のタグを選択中</span>
          ) : (
            <span className="dropdown__placeholder">タグを選ぶ</span>
          )}
          <svg className="dropdown__chevron" width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="#1E4B7A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m1 1.5 5 5 5-5" />
          </svg>
        </button>

        {open && (
          <div className="dropdown__panel" role="listbox" aria-multiselectable="true">
            {tags.map((t) => {
              const on = selected.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={on ? 'dropdown__option is-on' : 'dropdown__option'}
                  onClick={() => toggle(t)}
                >
                  <span className="dropdown__check" aria-hidden="true">
                    {on && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 5 5 9-10" />
                      </svg>
                    )}
                  </span>
                  {t}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <ul className="taglist dropdown__selected">
          {selected.map((t) => (
            <li key={t} className="tag tag--removable">
              {t}
              <button type="button" className="tag__x" onClick={() => toggle(t)} aria-label={`${t}を解除`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
