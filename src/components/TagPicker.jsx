// タグを複数選べる部品。「新規記録」と「検索」で共通して使います。
// allowAdd=true のときは、新しいタグをその場で追加できます。

import { useState } from 'react'
import { useRecords } from '../lib/RecordsContext'

export default function TagPicker({ selected, onChange, allowAdd = false }) {
  const { tags, addTag } = useRecords()
  const [draft, setDraft] = useState('')

  function toggle(tag) {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag])
  }

  async function handleAdd() {
    const name = await addTag(draft)
    setDraft('')
    if (name && !selected.includes(name)) onChange([...selected, name])
  }

  return (
    <div>
      <div className="taglist taglist--pick">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            className={selected.includes(t) ? 'tag tag--button is-on' : 'tag tag--button'}
            aria-pressed={selected.includes(t)}
            onClick={() => toggle(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {allowAdd && (
        <div className="tag-add">
          <input
            className="input"
            value={draft}
            maxLength={12}
            placeholder="新しいタグ"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
          />
          <button type="button" className="btn-line" onClick={handleAdd} disabled={!draft.trim()}>
            追加
          </button>
        </div>
      )}
    </div>
  )
}
