// 選んだ写真の縮小を、保存ボタンを押す前から裏で進めておく（→ photoPrep.js）。
//   items : 写真の並び（[{ file, ... }]）。file の無い写真（保存済みの写真）は対象外
// 新しく選んだ写真は縮小を予約し、外した写真は予約を取り消す（済んだ画像も手放す）。画面を離れたら、すべて手放す。
// 画面には何も返さない（保存のときに recordsApi.js が、済んだ画像を受け取る）。

import { useEffect, useRef } from 'react'
import { prepareResize, releaseResize } from './photoPrep'

export function usePhotoPrep(items) {
  const held = useRef(new Set()) // いま予約している File

  useEffect(() => {
    const next = new Set(items.map((item) => item.file).filter(Boolean))
    next.forEach((file) => {
      if (!held.current.has(file)) prepareResize(file)
    })
    held.current.forEach((file) => {
      if (!next.has(file)) releaseResize(file)
    })
    held.current = next
  }, [items])

  useEffect(
    () => () => {
      held.current.forEach((file) => releaseResize(file))
      held.current = new Set()
    },
    [],
  )
}
