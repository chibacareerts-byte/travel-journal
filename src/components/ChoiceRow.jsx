// 1つだけ選べる、静かな選択肢の並び（HOME の年・年別ページの月で使う）。
//   ・role="radiogroup" / role="radio"：選んでいるものを読み上げで伝える
//   ・Tab で入ると選択中の項目へ。← → ↑ ↓ / Home / End で移動して、そのまま選ぶ（選べない項目は飛ばす）
//   ・見た目（並べ方・大きさ）は呼び出し側の className と renderOption に任せる
//
// options : [{ value, label（読み上げ用）, disabled? }]
// columns : 上下キーで何個ずつ動くか（格子に並べるとき。1列の横並びなら省略）

import { useEffect, useRef } from 'react'

export default function ChoiceRow({ options, value, onChange, ariaLabel, className, optionClassName, renderOption, columns = 0 }) {
  const refs = useRef([])

  function moveFrom(index, step) {
    const n = options.length
    for (let k = 1; k <= n; k++) {
      const i = (index + step * k + n * n) % n
      if (!options[i].disabled) return i
    }
    return index
  }

  function onKeyDown(e, index) {
    let next = null
    if (e.key === 'ArrowRight') next = moveFrom(index, 1)
    else if (e.key === 'ArrowLeft') next = moveFrom(index, -1)
    else if (e.key === 'ArrowDown') next = columns ? nearest(index + columns, 1) : moveFrom(index, 1)
    else if (e.key === 'ArrowUp') next = columns ? nearest(index - columns, -1) : moveFrom(index, -1)
    else if (e.key === 'Home') next = moveFrom(-1, 1)
    else if (e.key === 'End') next = moveFrom(options.length, -1)
    if (next === null) return
    e.preventDefault()
    if (next !== index) {
      onChange(options[next].value)
      refs.current[next]?.focus()
    }
  }

  // 上下キー：同じ列の1つ上・下。選べない項目なら、その先で最初に選べる項目
  function nearest(i, dir) {
    if (i < 0 || i >= options.length) return null
    if (!options[i].disabled) return i
    return moveFrom(i, dir)
  }

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))

  // 横にスクロールする並び（年がたくさんあるとき）：選んでいる項目が見える位置まで、並びだけを横に動かす（ページは動かさない）
  useEffect(() => {
    const el = refs.current[selectedIndex]
    const box = el && el.parentElement
    if (!box || box.scrollWidth <= box.clientWidth) return
    const left = el.offsetLeft - box.offsetLeft
    if (left < box.scrollLeft) box.scrollLeft = Math.max(0, left - 16)
    else if (left + el.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = left + el.offsetWidth - box.clientWidth + 16
  }, [selectedIndex])

  return (
    <div className={className} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o, i) => {
        const checked = i === selectedIndex
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.label}
            tabIndex={checked ? 0 : -1}
            disabled={o.disabled}
            className={`${optionClassName}${checked ? ' is-on' : ''}`}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {renderOption(o, checked)}
          </button>
        )
      })}
    </div>
  )
}
