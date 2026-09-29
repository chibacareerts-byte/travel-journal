// シンプルな日本地図。訪問済みの都道府県だけ藍色、それ以外は淡いグレー。
// 都道府県を選ぶと onSelect(id) が呼ばれます。
// 形のデータは src/data/japanPaths.js（自動生成）にあります。
//
// 「今、どの県に触れているか」は onPreview(id) で親に知らせます（触れていないときは null）。
// 親（HOME）が、左上の県名表示をその県に切り替えます。地図の上には文字を出しません。
//   スマホ：指を置いて少し待ってから動かすと、指の下の県を追いかける → 離した場所の県を選ぶ
//           （すばやく縦になぞったときは、ページのスクロールを優先して何もしません）
//   PC    ：マウスを乗せると、その県を知らせる → クリックで選ぶ

import { useEffect, useRef } from 'react'
import { PREFECTURES } from '../data/prefectures'
import { MAP_PATHS, MAP_VIEWBOX } from '../data/japanPaths'

const LABEL_SHOW_DELAY_MS = 60 // すばやいスクロール操作のとき、県名が一瞬ちらつかないための待ち時間
const ARM_MS = 220 // これ以上、指を置いたままにしてから動かすと「県を探る操作」とみなす
const SLOP_PX = 10 // これ以上すぐに動いたら「ページのスクロール」とみなす

// 小さい・細長い県（境界のすき間や海上に近い部分）でも選びやすいよう、
// ちょうどその座標に無ければ、ごく近く（数px四方）だけ探して拾う。
const NEAR_PX = 5
const NEAR_OFFSETS = [
  [0, 0],
  [NEAR_PX, 0], [-NEAR_PX, 0], [0, NEAR_PX], [0, -NEAR_PX],
  [NEAR_PX, NEAR_PX], [-NEAR_PX, NEAR_PX], [NEAR_PX, -NEAR_PX], [-NEAR_PX, -NEAR_PX],
]

// 画面上の座標(x, y)にある都道府県の番号を返す（なければ null）
function prefectureAt(x, y) {
  for (const [dx, dy] of NEAR_OFFSETS) {
    const el = document.elementFromPoint(x + dx, y + dy)
    const hit = el && el.closest('[data-pref]')
    if (hit) return Number(hit.dataset.pref)
  }
  return null
}

export default function JapanMap({ visitedIds, onSelect, onPreview, selectedId = null, previewId = null }) {
  const wrapRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onPreviewRef = useRef(onPreview)
  onPreviewRef.current = onPreview
  const preview = (id) => onPreviewRef.current && onPreviewRef.current(id)

  // ---- スマホ（タッチ操作）----
  // スクロールを奪わないよう、次のルールで動かします。
  //   1. 触れた直後は「様子見」。少し待って県名を出す
  //   2. すぐに大きく動いた → ページのスクロール。県名を消して、何もしない
  //   3. 指を置いたまま ARM_MS 以上たってから動かした → 県を探る操作。この間だけスクロールを止める
  //   4. 指を離した場所の県を選ぶ（2 のときは選ばない）
  useEffect(() => {
    const wrap = wrapRef.current
    let mode = 'idle' // idle / pending / explore / scroll
    let startX = 0
    let startY = 0
    let startTime = 0
    let showTimer = null

    function stop() {
      clearTimeout(showTimer)
      mode = 'idle'
      preview(null)
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1) {
        mode = 'scroll' // 2本指（ピンチなど）は何もしない
        clearTimeout(showTimer)
        preview(null)
        return
      }
      const t = e.touches[0]
      mode = 'pending'
      startX = t.clientX
      startY = t.clientY
      startTime = Date.now()
      clearTimeout(showTimer)
      showTimer = setTimeout(() => {
        const id = prefectureAt(startX, startY)
        if (mode === 'pending' && id !== null) preview(id)
      }, LABEL_SHOW_DELAY_MS)
    }

    function onTouchMove(e) {
      if (mode === 'idle' || mode === 'scroll') return
      const t = e.touches[0]

      if (mode === 'pending') {
        const moved = Math.hypot(t.clientX - startX, t.clientY - startY)
        if (Date.now() - startTime < ARM_MS) {
          if (moved > SLOP_PX) {
            // すぐに動いた = ページをスクロールしたい操作。邪魔をしない
            mode = 'scroll'
            clearTimeout(showTimer)
            preview(null)
          }
          return
        }
        mode = 'explore'
      }

      // 探る操作中：スクロールを止めて、指の下の県名を追いかける
      if (!e.cancelable) {
        // すでにブラウザがスクロールを始めていた場合は、あきらめる
        mode = 'scroll'
        preview(null)
        return
      }
      e.preventDefault()
      const id = prefectureAt(t.clientX, t.clientY)
      preview(id)
    }

    function onTouchEnd(e) {
      const wasActive = mode === 'pending' || mode === 'explore'
      const t = e.changedTouches[0]
      clearTimeout(showTimer)
      mode = 'idle'
      preview(null)
      if (!wasActive) return
      // 離した場所の県を選ぶ。ブラウザが後から出す「クリック」と二重にならないよう止める
      if (e.cancelable) e.preventDefault()
      const id = prefectureAt(t.clientX, t.clientY)
      if (id !== null) onSelectRef.current(id)
    }

    wrap.addEventListener('touchstart', onTouchStart, { passive: true })
    wrap.addEventListener('touchmove', onTouchMove, { passive: false })
    wrap.addEventListener('touchend', onTouchEnd, { passive: false })
    wrap.addEventListener('touchcancel', stop)
    return () => {
      clearTimeout(showTimer)
      wrap.removeEventListener('touchstart', onTouchStart)
      wrap.removeEventListener('touchmove', onTouchMove)
      wrap.removeEventListener('touchend', onTouchEnd)
      wrap.removeEventListener('touchcancel', stop)
    }
  }, [])

  // ---- PC（マウス）：乗せたら県名、クリックで選ぶ ----
  function onPointerMove(e) {
    if (e.pointerType === 'touch') return // タッチは上で処理している
    const id = prefectureAt(e.clientX, e.clientY)
    preview(id)
  }

  function select(id) {
    preview(null)
    onSelect(id)
  }

  const visitedSet = new Set(visitedIds)

  return (
    <div className="japan-map-wrap" ref={wrapRef} onPointerMove={onPointerMove} onPointerLeave={() => preview(null)}>
      <svg
        className="japan-map"
        viewBox={MAP_VIEWBOX}
        role="group"
        aria-label="日本地図"
        shapeRendering="geometricPrecision"
      >
        {/* 沖縄のための小さな枠 */}
        <rect x="3" y="3" width="94" height="74" className="japan-map__inset" />

        {PREFECTURES.map((p) => {
          const visited = visitedSet.has(p.id)
          return (
            <path
              key={p.id}
              d={MAP_PATHS[p.id]}
              data-pref={p.id}
              className={(visited ? 'pref pref--visited' : 'pref') + (p.id === 47 ? ' pref--inset' : '')}
              role="button"
              tabIndex={0}
              aria-label={`${p.name}${visited ? '（訪問済み）' : ''}`}
              onClick={() => select(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  select(p.id)
                }
              }}
            />
          )
        })}

        {/* 触れているだけの県には、ごく控えめな線だけを重ねる（塗り色は変えない） */}
        {previewId !== null && previewId !== selectedId && (
          <path d={MAP_PATHS[previewId]} className="pref-outline pref-outline--preview" aria-hidden="true" />
        )}

        {/* 選択中の県の細いアウトライン。ほかの県の線に隠れないよう、いちばん上に重ねる */}
        {selectedId !== null && (
          <path d={MAP_PATHS[selectedId]} className="pref-outline" aria-hidden="true" />
        )}
      </svg>
    </div>
  )
}
