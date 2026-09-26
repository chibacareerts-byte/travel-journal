// 写真を拡大して見る画面。左右スワイプ（PCは矢印キー）で前後の写真へ。

import { useEffect, useRef } from 'react'
import Photo from './Photo'

export default function Lightbox({ photos, index, onChange, onClose }) {
  const touchStartX = useRef(null)
  const last = photos.length - 1

  const prev = () => onChange(index > 0 ? index - 1 : last)
  const next = () => onChange(index < last ? index + 1 : 0)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden' // 後ろの画面が動かないように
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  })

  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (dx > 50) prev()
    else if (dx < -50) next()
  }

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="写真の拡大表示">
      <div className="lightbox__top">
        <span className="lightbox__count">
          {index + 1} / {photos.length}
        </span>
        <button type="button" className="lightbox__close" onClick={onClose} aria-label="閉じる">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div
        className="lightbox__stage"
        onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
        onTouchEnd={onTouchEnd}
        onClick={onClose}
      >
        <div className="lightbox__photo" onClick={(e) => e.stopPropagation()}>
          <Photo photo={photos[index]} ratio="4 / 5" contain />
        </div>
      </div>

      {photos.length > 1 && (
        <div className="lightbox__arrows">
          <button type="button" onClick={prev} aria-label="前の写真">‹</button>
          <button type="button" onClick={next} aria-label="次の写真">›</button>
        </div>
      )}
    </div>
  )
}
