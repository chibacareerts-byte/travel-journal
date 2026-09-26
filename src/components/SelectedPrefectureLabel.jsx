// HOME の地図の余白に置く、選択中の都道府県の表示（コード / 英語名 / 日本語名）。
// 枠や背景はなく、文字だけを直接置きます。都道府県コードは順位ではなく、ただの番号です。
// 県を切り替えると、key が変わって作り直され、静かにフェードインします。

import { getPrefecture } from '../data/prefectures'
import { PREFECTURE_EN } from '../data/prefectureNames'

export default function SelectedPrefectureLabel({ prefectureId }) {
  if (prefectureId === null) return null // 何も選んでいないときは、何も表示しない
  const pref = getPrefecture(prefectureId)

  return (
    <div className="map-label" key={prefectureId}>
      <p className="map-label__code">{String(pref.id).padStart(2, '0')}</p>
      <p className="map-label__en">{PREFECTURE_EN[pref.id]}</p>
      <p className="map-label__ja">{pref.name}</p>
    </div>
  )
}
