// 選んだ写真の撮影日を、画面を止めずに読む。
//   items : 写真の並び（[{ id または key, file }]）。file の無い写真（保存済みの写真）は読まない
//   戻り値：Map(写真の id/key → 'YYYY-MM-DD' | null)。まだ読んでいる途中の写真は Map に入っていない
//
// ・読むのはファイルの先頭など必要な範囲だけ（画像はデコードしない）→ exifDate.js
// ・同じファイルは1回だけ読む。新しく選んだ写真だけを、まとめて読んで1回だけ state を更新する
// ・読めなくてもエラーにしない（その写真は null＝撮影日なし）。保存の処理とは無関係

import { useEffect, useState } from 'react'
import { shotDateOf } from './exifDate'

const keyOf = (item) => item.key ?? item.id

export function useShotDates(items) {
  const [dates, setDates] = useState(() => new Map())

  useEffect(() => {
    const pending = items.filter((item) => item.file && !dates.has(keyOf(item)))
    if (pending.length === 0) return undefined
    let alive = true
    Promise.all(pending.map((item) => shotDateOf(item.file))).then((results) => {
      if (!alive) return
      setDates((prev) => {
        const next = new Map(prev)
        pending.forEach((item, i) => next.set(keyOf(item), results[i]))
        return next
      })
    })
    return () => {
      alive = false
    }
  }, [items, dates])

  return dates
}
