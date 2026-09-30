// 写真1枚を表示する部品。
// src があれば本物の写真、なければ藍色系のプレースホルダーを表示します。
// ratio は縦横比（例: '4 / 3'）。contain=true で写真を切り取らずに全体表示します。
//
// 次の3つは、指定したときだけ働きます（初期値はすべて off。指定しない画面の表示は今までと同じ）：
//   fade     … 読み込みが終わった写真を、短く静かにフェードインする（すでに読み込み済みの写真は、そのまま出す）
//   priority … 画面を開いてすぐ見える大事な写真。遅延読み込みをやめ、ほかの写真より先に読み込む
//   natural  … 写真の本来の縦横比の枠で、切り取らずに出す。比率を覚えている写真（photoAspect）は最初から正しい高さ、
//              知らない写真は ratio の枠で始め、読み込めたら本来の比率にする
// fade / priority / natural のどれかを指定した写真は、読み込めたときに縦横比を覚える（記録詳細でずれずに出すため）。

import { useLayoutEffect, useRef, useState } from 'react'
import { aspectOf, rememberAspect } from '../lib/photoAspect'

// この画面（タブ）で一度表示した写真の URL。一覧 ⇄ 詳細を行き来したとき、同じ写真を何度もフェードさせない
const shown = new Set()
const SHOWN_MAX = 2000 // 表示用 URL は1時間ごとに作り直されるので、増えすぎたら一度空にする

function FadeImg({ src, contain, fade, priority, onSize }) {
  const ref = useRef(null)
  const [loaded, setLoaded] = useState(() => !fade || shown.has(src))

  // 描く前から読み込みが終わっている写真（ブラウザのキャッシュ）も、フェードさせずにそのまま出す
  useLayoutEffect(() => {
    const img = ref.current
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true)
      onSize(img.naturalWidth, img.naturalHeight)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleLoad(e) {
    if (shown.size >= SHOWN_MAX) shown.clear()
    shown.add(src)
    setLoaded(true)
    onSize(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
  }

  const classes = [contain ? 'is-contain' : '', fade ? 'photo__img--fade' : '', fade && loaded ? 'is-loaded' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <img
      ref={ref}
      src={src}
      alt=""
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={classes || undefined}
      // 表示用 URL が作り直されて src が変わっても、loaded は戻さない（写真が一瞬消えないように）
      onLoad={handleLoad}
      onError={() => setLoaded(true)}
    />
  )
}

export default function Photo({
  photo,
  ratio,
  contain = false,
  className = '',
  fade = false,
  priority = false,
  natural = false,
}) {
  // natural：覚えている比率があれば最初からそれ。なければ ratio の枠で始めて、読み込めたら本来の比率へ
  const [naturalRatio, setNaturalRatio] = useState(() => (natural ? aspectOf(photo) : null))
  const shownRatio = natural && naturalRatio ? String(naturalRatio) : ratio
  const style = shownRatio ? { aspectRatio: shownRatio } : undefined

  function handleSize(width, height) {
    rememberAspect(photo, width, height)
    if (natural && !naturalRatio && width > 0 && height > 0) setNaturalRatio(width / height)
  }

  if (photo && photo.src) {
    return (
      <div className={`photo ${className}`} style={style}>
        {fade || priority || natural ? (
          <FadeImg src={photo.src} contain={contain} fade={fade} priority={priority} onSize={handleSize} />
        ) : (
          <img src={photo.src} alt="" loading="lazy" className={contain ? 'is-contain' : ''} />
        )}
      </div>
    )
  }

  const tone = photo && photo.tone !== undefined ? photo.tone : 5
  return (
    <div className={`photo photo--placeholder tone-${tone} ${className}`} style={style}>
      <span className="photo__label">Photo</span>
    </div>
  )
}
