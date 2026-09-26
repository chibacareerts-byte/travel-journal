// 都道府県ひとつ分の「実際の輪郭」を大きく描く部品。
// 形は日本地図と同じデータ（japanPaths.js）から取り出します。
// 描いたあとに輪郭の大きさを測り（getBBox）、その範囲にぴったり合わせて拡大します。

import { useLayoutEffect, useRef, useState } from 'react'
import { MAP_PATHS, MAP_VIEWBOX } from '../data/japanPaths'

export default function PrefectureSilhouette({ prefectureId, visited }) {
  const pathRef = useRef(null)
  const [viewBox, setViewBox] = useState(MAP_VIEWBOX)

  useLayoutEffect(() => {
    const box = pathRef.current.getBBox()
    const pad = Math.max(box.width, box.height) * 0.06 // 少しだけ余白
    setViewBox(`${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`)
  }, [prefectureId])

  return (
    <svg className="silhouette" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path
        ref={pathRef}
        d={MAP_PATHS[prefectureId]}
        className={visited ? 'silhouette__shape is-visited' : 'silhouette__shape'}
      />
    </svg>
  )
}
