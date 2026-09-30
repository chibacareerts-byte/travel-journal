// 写真の縦横比（幅 ÷ 高さ）を覚えておく小さな仕組み。
// 一覧などで一度読み込んだ写真の比率を覚えておき、記録詳細で「写真を切り取らずに、最初から正しい高さの枠」で出すために使う
// （読み込み後に高さが変わって画面がずれる＝レイアウトシフトを防ぐ）。
//
//   aspectOf(photo)            … 覚えている比率（例 1.5）。知らなければ null
//   rememberAspect(photo, w, h) … 読み込めた写真の大きさを覚える
//
// 覚えるのは「写真のファイル名（UUID.jpg）→ 比率」だけ。ユーザーの id や URL は保存しない。
// この端末のブラウザ（localStorage）に保存し、使えないとき（プライベートブラウズなど）は、このタブの間だけ覚える。

const STORAGE_KEY = 'tj:photo-aspect:v1'
const MAX = 1500 // これを超えたら古いものから忘れる

const keyOf = (photo) => {
  if (!photo || !photo.path) return null
  const name = String(photo.path).split('/').pop()
  return name || null
}

let map = null
function load() {
  if (map) return map
  map = new Map()
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    if (Array.isArray(saved)) saved.forEach(([k, v]) => typeof v === 'number' && v > 0 && map.set(k, v))
  } catch {
    // 保存が使えない・壊れているときは、空から始める
  }
  return map
}

let timer = null
function scheduleSave() {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...load()]))
    } catch {
      // 容量不足・プライベートブラウズなど：このタブの間だけ覚えておく
    }
  }, 1000)
}

export function aspectOf(photo) {
  const key = keyOf(photo)
  return key ? load().get(key) ?? null : null
}

export function rememberAspect(photo, width, height) {
  const key = keyOf(photo)
  if (!key || !(width > 0) || !(height > 0)) return
  const ratio = Math.round((width / height) * 1000) / 1000
  const m = load()
  if (m.get(key) === ratio) return
  m.delete(key)
  m.set(key, ratio)
  while (m.size > MAX) m.delete(m.keys().next().value)
  scheduleSave()
}
