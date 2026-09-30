// 写真の縮小（長辺 2000px 以下・JPEG・品質 0.85）を、写真を選んだ時点から裏で進めておく仕組み。
// 保存ボタンを押したときには、縮小が済んだ画像をそのまま使えるので、待ち時間が短くなる。
//
//   prepareResize(file) … 選んだ写真の縮小を予約する（画面が写真を持っている間、結果を取っておく）
//   releaseResize(file) … 写真を外した・画面を離れた。まだ始まっていない縮小は取り消し、済んだ画像も手放す
//   resizedJpeg(file)   … 保存のときに呼ぶ。済んでいればその画像、途中なら終わるまで待つ、未予約なら今から縮小
//
// 守っていること：
//   ・縮小は、アプリ全体で同時に1枚だけ（大きな写真の展開はメモリを使うので。先行の縮小も保存時の縮小も同じ順番待ち）
//   ・同じ写真（同じ File）は2回縮小しない。保存に失敗してもう一度保存するときも、済んだ画像を使い回す
//   ・縮小に失敗した写真だけは、保存のときにもう一度だけ試す（失敗したときの画面の表示は、これまでと同じ）
//   ・保存の途中で写真を外したり画面を離れたりしても、保存に使っている縮小は取り消さない
// 画面側は usePhotoPrep（写真の並びを渡すだけ）から使う。

const MAX_EDGE = 2000 // 長辺の最大px。これより小さい写真は拡大しない
const JPEG_QUALITY = 0.85
const RESIZE_CONCURRENCY = 1 // 同時に縮小する枚数（メモリのため1枚ずつ）

// 同時に動かす数を max に制限する順番待ちの仕組み（先に頼んだものから順に動く）
function createLimiter(max) {
  let active = 0
  const queue = []
  function next() {
    if (active >= max || queue.length === 0) return
    active += 1
    const { fn, resolve, reject } = queue.shift()
    Promise.resolve()
      .then(fn) // fn が同期的に値を返しても、例外を投げても、順番待ちが止まらないように
      .then(resolve, reject)
      .finally(() => {
        active -= 1
        next()
      })
  }
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject })
      next()
    })
}

// 写真を「長辺 2000px 以下・JPEG・品質 0.85」に変換する（縦横比は維持）。
// imageOrientation: 'from-image' で、スマホ写真の向き情報（EXIF）を反映してから描く。
export async function resizeToJpeg(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // 古いブラウザ向け：img 要素で読み込む（向きはブラウザが反映する）
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      bitmap = await createImageBitmap(img)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff' // 透明な PNG などが黒くならないように
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob) throw new Error('画像を変換できませんでした')
    canvas.width = 0 // 使い終わった描画領域のメモリをすぐ手放す（スマホで何枚も続けて縮小するとき用）
    canvas.height = 0
    return blob
  } finally {
    bitmap.close()
  }
}

const limitResize = createLimiter(RESIZE_CONCURRENCY)

// File → 縮小の予約 { file, holders（画面が持っている数）, needed（保存に使う）, status, promise }
//   status: 'queued'（順番待ち）| 'running'（縮小中）| 'done' | 'failed'
const jobs = new Map()

class Cancelled extends Error {}

// 使う人がいなくなった予約を忘れる（縮小済みの画像も一緒に手放す）
function forgetIfUnused(job) {
  if (job.holders === 0 && jobs.get(job.file) === job) jobs.delete(job.file)
}

function start(job) {
  job.status = 'queued'
  job.promise = limitResize(() => {
    // 順番が来たときに、もう誰も必要としていなければ縮小しない（写真を外した・画面を離れた）
    if (job.holders === 0 && !job.needed) throw new Cancelled()
    job.status = 'running'
    return resizeToJpeg(job.file)
  }).then(
    (blob) => {
      job.status = 'done'
      forgetIfUnused(job)
      return blob
    },
    (error) => {
      job.status = 'failed'
      forgetIfUnused(job)
      throw error
    },
  )
  job.promise.catch(() => {}) // だれも待っていない失敗・取り消しを、未処理のエラーにしない
}

export function prepareResize(file) {
  const job = jobs.get(file)
  if (job) {
    job.holders += 1 // すでに予約済み（まだ順番待ちなら、取り消しにならずにそのまま縮小される）
    return
  }
  const created = { file, holders: 1, needed: false, status: null, promise: null }
  jobs.set(file, created)
  start(created)
}

export function releaseResize(file) {
  const job = jobs.get(file)
  if (!job) return
  job.holders = Math.max(0, job.holders - 1)
  if (job.holders > 0) return
  // 済んだ・失敗した予約は、すぐに手放す。順番待ちは順番が来たときに取り消され、縮小中は終わったあとで手放す
  if (job.status === 'done' || job.status === 'failed') forgetIfUnused(job)
}

// 保存のときに呼ぶ：縮小済みの画像（Blob）を返す
export function resizedJpeg(file) {
  let job = jobs.get(file)
  if (!job) {
    job = { file, holders: 0, needed: true, status: null, promise: null }
    jobs.set(file, job)
    start(job)
    return job.promise
  }
  job.needed = true // 保存に使うので、途中で写真を外されても取り消さない
  if (job.status === 'failed') start(job) // 先に試して失敗していた写真は、もう一度だけ試す
  return job.promise
}
