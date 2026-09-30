// 写真を拡大して見る画面（記録詳細から開く）。
//   ・左右スワイプ：指に合わせて写真が動き、一定以上動かすか素早く払うと前後の写真へ。足りなければ元に戻る
//   ・前後ボタン・← → キー・Esc で閉じる・写真番号「3 / 8」
//   ・前後の写真は画面の外に置いておく（先に読み込まれ、めくったときにすぐ出る）
//   ・開いている間は、後ろの画面（#root）を操作できないようにする（inert）。Tab はこの画面の中だけを回る
//   ・閉じたら、開く前に押していた写真（ボタン）へフォーカスを戻す
//   ・写真は切り取らずに、縦・横どちらも画面に収まる大きさで出す
//   ・動きを減らす設定では、めくり・開閉の動きを出さない
//   ・ピンチでの拡大は、ブラウザ標準の拡大に任せる（拡大している間は、スワイプでめくらない）
// photos は records の写真そのまま（src は署名付き URL。作り直されたら、そのまま新しい URL で表示される）。

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Photo from './Photo'

const SWIPE_RATIO = 0.18 // 画面幅のこの割合より動かしたら、めくる
const FLICK_SPEED = 0.45 // px/ms：これより速く払ったら、少しの移動でもめくる
const SLIDE_MS = 240
const CLOSE_MS = 160

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Lightbox({ photos, index, onChange, onClose, title = '' }) {
  const n = photos.length
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const stageRef = useRef(null)
  const touch = useRef(null) // { x, y, t, axis }
  const movedRef = useRef(false) // 指で動かした直後のクリックで、閉じてしまわないように
  const [offset, setOffset] = useState(0) // 指に合わせたずれ（px）
  const [slide, setSlide] = useState(0) // めくっている途中の向き（-1 前へ / 1 次へ / 0 なし）
  const [snapping, setSnapping] = useState(false) // めくらずに元の位置へ戻っている途中
  const [closing, setClosing] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const slideTimer = useRef(null)
  const closeTimer = useRef(null)

  const wrap = (i) => (i + n) % n
  const prevIndex = wrap(index - 1)
  const nextIndex = wrap(index + 1)

  // ---- めくる ----
  function finishSlide(dir) {
    clearTimeout(slideTimer.current)
    slideTimer.current = null
    setSlide(0)
    setOffset(0)
    onChange(wrap(index + dir))
  }

  function go(dir) {
    if (n < 2 || slide !== 0 || closing) return
    if (reducedMotion()) {
      setOffset(0)
      onChange(wrap(index + dir))
      return
    }
    setSlide(dir)
    slideTimer.current = setTimeout(() => finishSlide(dir), SLIDE_MS + 80) // transitionend が来なかったときの保険
  }

  function requestClose() {
    if (closeTimer.current) return
    if (reducedMotion()) {
      onClose()
      return
    }
    setClosing(true)
    closeTimer.current = setTimeout(onClose, CLOSE_MS)
  }

  // ---- 開いたとき：後ろの画面を止める・フォーカス・キー操作 ----
  useEffect(() => {
    const opener = document.activeElement
    const root = document.getElementById('root')
    const prevOverflow = document.body.style.overflow
    if (root) root.inert = true
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      if (root) root.inert = false
      document.body.style.overflow = prevOverflow
      clearTimeout(slideTimer.current)
      clearTimeout(closeTimer.current)
      if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'Tab') {
        // この画面の中のボタンだけを順に回る
        const items = [...dialogRef.current.querySelectorAll('button:not(:disabled)')]
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  // ブラウザ標準のピンチで拡大している間は、スワイプでめくらない
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return undefined
    const onResize = () => setZoomed(vv.scale > 1.02)
    onResize()
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  // ---- 指の動き ----
  function onTouchStart(e) {
    setSnapping(false)
    if (e.touches.length !== 1 || zoomed || slide !== 0 || n < 2) {
      touch.current = null
      return
    }
    const p = e.touches[0]
    touch.current = { x: p.clientX, y: p.clientY, t: performance.now(), axis: null }
    movedRef.current = false
  }

  function onTouchMove(e) {
    const t = touch.current
    if (!t || e.touches.length !== 1) return
    const p = e.touches[0]
    const dx = p.clientX - t.x
    const dy = p.clientY - t.y
    if (!t.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      t.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (t.axis !== 'x') return
    movedRef.current = true
    setOffset(dx)
  }

  function onTouchEnd(e) {
    const t = touch.current
    touch.current = null
    if (!t || t.axis !== 'x') return
    const dx = e.changedTouches[0].clientX - t.x
    const width = stageRef.current ? stageRef.current.clientWidth : window.innerWidth
    const speed = Math.abs(dx) / Math.max(1, performance.now() - t.t)
    const far = Math.abs(dx) > width * SWIPE_RATIO || (speed > FLICK_SPEED && Math.abs(dx) > 24)
    if (far) {
      go(dx < 0 ? 1 : -1)
    } else {
      // 足りなければ、元の位置へ静かに戻す
      setOffset(0)
      if (!reducedMotion() && dx !== 0) setSnapping(true)
    }
  }

  function onStageClick(e) {
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    if (!e.target.closest('.lightbox__img, .lightbox__slide .photo')) requestClose()
  }

  // ---- 表示 ----
  // 並べる写真：前・いま・次（1枚だけなら、いまだけ。2枚なら、動かす向きにもう1枚）
  const slides = [{ i: index, pos: 0 }]
  if (n >= 3) {
    slides.push({ i: prevIndex, pos: -1 }, { i: nextIndex, pos: 1 })
  } else if (n === 2) {
    const towardPrev = slide === -1 || (slide === 0 && offset > 0)
    slides.push({ i: nextIndex, pos: towardPrev ? -1 : 1 })
  }

  // 動き：指で動かしている間は指のまま・めくる／戻るときだけ短く動かす・それ以外は動かさない
  //（めくり終わって写真を入れ替える瞬間に、元の位置へ戻る動きが見えないように）
  const trackStyle = {
    transform: slide !== 0 ? `translateX(${-slide * 100}%)` : `translateX(${offset}px)`,
    transition:
      slide !== 0
        ? `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)`
        : snapping
          ? 'transform 200ms cubic-bezier(0.2, 0.7, 0.2, 1)'
          : 'none',
  }

  const label = title ? `${title}の写真` : '写真'

  return createPortal(
    <div
      ref={dialogRef}
      className={closing ? 'lightbox is-closing' : 'lightbox'}
      role="dialog"
      aria-modal="true"
      aria-label="写真の拡大表示"
    >
      <div className="lightbox__top">
        <p className="lightbox__count" aria-live="polite">
          <span className="lightbox__num">{index + 1}</span>
          <span className="lightbox__sep"> / </span>
          <span>{n}</span>
        </p>
        <button ref={closeRef} type="button" className="lightbox__close" onClick={requestClose} aria-label="閉じる">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div
        ref={stageRef}
        className={zoomed ? 'lightbox__stage is-zoomed' : 'lightbox__stage'}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          touch.current = null
          setOffset(0)
        }}
        onClick={onStageClick}
      >
        <div
          className="lightbox__track"
          style={trackStyle}
          onTransitionEnd={(e) => {
            if (e.target !== e.currentTarget) return
            if (slide !== 0) finishSlide(slide)
            else if (snapping) setSnapping(false)
          }}
        >
          {slides.map(({ i, pos }) => {
            const photo = photos[i]
            return (
              <div
                key={n === 2 ? `${i}-${pos}` : i}
                className="lightbox__slide"
                style={{ transform: `translateX(${pos * 100}%)` }}
                aria-hidden={pos !== 0}
              >
                {photo && photo.src ? (
                  <img className="lightbox__img" src={photo.src} alt={`${label}（${i + 1}枚目）`} decoding="async" draggable="false" />
                ) : (
                  <div className="lightbox__placeholder">
                    <Photo photo={photo} ratio="4 / 5" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="lightbox__bar">
        {n > 1 && (
          <>
            <button type="button" className="lightbox__nav" onClick={() => go(-1)} aria-label="前の写真">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 5-7 7 7 7" />
              </svg>
            </button>
            <button type="button" className="lightbox__nav" onClick={() => go(1)} aria-label="次の写真">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
