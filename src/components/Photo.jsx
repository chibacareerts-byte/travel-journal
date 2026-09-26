// 写真1枚を表示する部品。
// src があれば本物の写真、なければ藍色系のプレースホルダーを表示します。
// ratio は縦横比（例: '4 / 3'）。contain=true で写真を切り取らずに全体表示します。

export default function Photo({ photo, ratio, contain = false, className = '' }) {
  const style = ratio ? { aspectRatio: ratio } : undefined

  if (photo && photo.src) {
    return (
      <div className={`photo ${className}`} style={style}>
        <img src={photo.src} alt="" loading="lazy" className={contain ? 'is-contain' : ''} />
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
