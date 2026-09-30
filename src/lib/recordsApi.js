// データの読み書きをここにまとめています（Supabase の records テーブルとのやり取り）。
// 画面側（pages / components）は、この変換済みの形だけを扱います。
//
// アプリ内の1件の形:
//   { id: '12', placeName, prefectureId: 13, visitedOn: '2026-05-04', photos: [{ id, src, tone }], memo, tags: [], tripId: '3' | null }
// records テーブルの1行:
//   { id: 12(int8), user_id, place_name, prefecture: '東京都', visited_date, memo, tags(jsonb), photos(jsonb), cover_photo, trip_id(int8 | null) }
//   trip_id は supabase/trips.sql で追加する列。まだ無い DB でも動く（tripId は null になる）
//
// 写真は Supabase Storage（Private バケット travel-photos）に保存します。
//   保存先   : <user_id>/<record_id>/<UUID>.jpg
//   DB の photos : [{ id: '<UUID>', path: '<user_id>/<record_id>/<UUID>.jpg' }]（署名付き URL や blob URL は保存しない）
//   表示     : 取得時に署名付き URL（有効1時間）を作って photo.src に入れる

import { supabase } from './supabase'
import { createPerf } from './perf'
import { PREFECTURES } from '../data/prefectures'
import { DEFAULT_TAGS } from '../data/tags'

// ---- 行 ⇄ 記録 の変換 ----

// 配列でなければ空配列にする（null などが入っていても画面が落ちないように）
const toArray = (value) => (Array.isArray(value) ? value : [])

// 写真1枚を { id, src, tone } の形にそろえる。src は署名付き URL（作れなかった写真は null → プレースホルダー表示）
function toPhoto(item, recordId, index, urlMap) {
  if (!item || typeof item !== 'object' || !item.path) return null
  return {
    id: item.id || `${recordId}-p${index + 1}`,
    path: item.path, // Storage 上の場所。編集画面で、どの写真かを特定するために持つ
    src: urlMap[item.path] || null,
    tone: item.tone ?? 5,
  }
}

// テーブルの1行 → アプリ内の記録。県名が分からない行は null（呼び出し側で除く）
function toRecord(row, urlMap = {}) {
  const prefecture = PREFECTURES.find((p) => p.name === row.prefecture)
  if (!prefecture) {
    console.warn(`records の id=${row.id} は、都道府県名「${row.prefecture}」が不明なため表示しません`)
    return null
  }
  const id = String(row.id) // URL の :id（文字列）と比べられるよう、文字列にそろえる
  return {
    id,
    placeName: row.place_name,
    prefectureId: prefecture.id,
    visitedOn: row.visited_date,
    photos: toArray(row.photos)
      .map((item, i) => toPhoto(item, id, i, urlMap))
      .filter(Boolean),
    memo: row.memo || '',
    tags: toArray(row.tags),
    tripId: toTripId(row.trip_id), // 旅に入っていない・trip_id の列がまだ無い（trips.sql 未実行）ときは null
  }
}

// trip_id（int8）→ アプリ内の旅の id（文字列）。無ければ null
function toTripId(value) {
  return value === null || value === undefined ? null : String(value)
}

// 旅（trip_id）を書き込むかどうか。
//   input.tripId === undefined … 旅の機能が使えない（trips.sql 未実行など）→ trip_id の列には一切触れない
//   null / '3' など          … その値を書き込む（null = 旅に入れない）
const hasTrip = (input) => input.tripId !== undefined
const tripColumn = (input) => (hasTrip(input) ? { trip_id: input.tripId === null ? null : Number(input.tripId) } : {})

// ---- 写真（Supabase Storage）----

const BUCKET = 'travel-photos'
const MAX_PHOTOS = 10
const MAX_EDGE = 2000 // 長辺の最大px。これより小さい写真は拡大しない
const JPEG_QUALITY = 0.85
const SIGNED_URL_SECONDS = 3600
// 保存の速さの調整（スマートフォン回線・メモリを考えた値）
const UPLOAD_CONCURRENCY = 3 // 同時に Storage へ送る枚数。10枚でも、同時には最大3枚まで
const RESIZE_CONCURRENCY = 1 // 同時に縮小する枚数。大きな写真の展開はメモリを使うので、1枚ずつ（前の写真を送っている間に、次を縮小する）

// 保存パスの一覧から、表示用の署名付き URL を「まとめて」作る → { path: url }
// 作れなかった写真は入れない（呼び出し側で src: null になり、プレースホルダーが出る）
// 署名付き URL を作る本体。API 自体が失敗したときは null を返す（一部の写真だけ作れなかったときは、作れたぶんだけの { path: url }）
async function requestSignedUrls(paths) {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
  if (error) {
    console.warn('写真の表示用URLを作れませんでした', error)
    return null
  }
  const map = {}
  data.forEach((item) => {
    if (item.signedUrl) map[item.path] = item.signedUrl
    else console.warn(`写真の表示用URLを作れませんでした: ${item.path}`, item.error)
  })
  return map
}

async function signPaths(paths) {
  return (await requestSignedUrls(paths)) ?? {}
}

// 表示中の写真の署名付き URL だけを作り直す（records・tags は取得しない。DB にも触れない）。
// 戻り値：{ path: 新しい URL }（重複した path は1つにまとめる）／通信などで API 自体が失敗したら null
export async function refreshPhotoUrls(paths) {
  return requestSignedUrls([...new Set(toArray(paths).filter(Boolean))])
}

const pathsOf = (rows) => rows.flatMap((row) => toArray(row.photos).map((item) => item && item.path).filter(Boolean))

// 写真を「長辺 2000px 以下・JPEG・品質 0.85」に変換する（縦横比は維持）。
// imageOrientation: 'from-image' で、スマホ写真の向き情報（EXIF）を反映してから描く。
async function resizeToJpeg(file) {
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

// 開発中だけ、コンソールで window.__saveUploadConcurrency = 1 と入れて「1枚ずつ送る」動きと比べられる
function uploadConcurrency() {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const n = Math.floor(Number(window.__saveUploadConcurrency))
    if (n >= 1) return Math.min(n, MAX_PHOTOS)
  }
  return UPLOAD_CONCURRENCY
}

// 写真を「縮小 → アップロード」する。写真ごとの流れを、最大 UPLOAD_CONCURRENCY 枚ぶん同時に進める：
//   ・縮小は1枚ずつ（メモリのため）。縮小が終わった写真から順にアップロードを始めるので、前の写真の送信中に次を縮小できる
//   ・ready … 記録の id が決まる／編集の前提の確認が済む、まで待ってから送る（確認に失敗したら、1枚も送らない）
//   ・どれか1枚でも失敗したら、新しい写真の処理は始めない。すでに送信中のものは終わるのを待つ
//   ・attemptedPaths には「送信を始めた写真の path」を入れる（失敗時にまとめて削除するため。送信の完了は待ってから返す）
// 成功：入力と同じ順番の path の配列。失敗：error.pipeline = { stage: 'convert' | 'ready' | 'upload', index, cause, uploaded } を付けて投げる
async function convertAndUpload({ files, ready, pathFor, attemptedPaths, perf }) {
  const total = files.length
  const paths = new Array(total).fill(null)
  const limitResize = createLimiter(RESIZE_CONCURRENCY)
  let next = 0
  let failure = null

  async function worker() {
    while (!failure) {
      const index = next++
      if (index >= total) return
      let stage = 'convert'
      try {
        const blob = await limitResize(async () => (failure ? null : await perf.time('resize', () => resizeToJpeg(files[index]))))
        if (failure) return
        stage = 'ready'
        const readyValue = await ready
        if (failure) return
        stage = 'upload'
        const path = pathFor(index, readyValue)
        attemptedPaths.push(path)
        const { error } = await perf.time('upload', () =>
          supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }),
        )
        if (error) throw error
        paths[index] = path
      } catch (cause) {
        if (!failure) failure = { stage, index, cause }
        return
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(uploadConcurrency(), total) }, worker))
  if (failure) {
    failure.uploaded = paths.filter(Boolean).length
    const error = new Error('写真の処理に失敗しました', { cause: failure.cause })
    error.pipeline = failure
    throw error
  }
  return paths
}

// 画面に見せる日本語のメッセージ付きのエラー
function saveError(userMessage, cause) {
  const error = new Error(userMessage, { cause })
  error.userMessage = userMessage
  return error
}

// ---- 読み書き ----

export async function fetchRecords() {
  const { data, error } = await supabase.from('records').select('*')
  if (error) throw error
  const urlMap = await signPaths(pathsOf(data)) // 署名付き URL は全記録ぶんを1回でまとめて作る
  return data.map((row) => toRecord(row, urlMap)).filter(Boolean)
}

// タグ専用のテーブルはまだないので、最初から用意しているタグ ＋ 保存済みの記録で使われているタグを返す
export async function fetchTags() {
  const { data, error } = await supabase.from('records').select('tags')
  if (error) throw error
  const used = data.flatMap((row) => toArray(row.tags))
  return [...new Set([...DEFAULT_TAGS, ...used])]
}

// input: { placeName, prefectureId, visitedOn, photos, memo, tags }
//   photos: [{ id, src(プレビュー用の blob URL), file(選んだ元の画像) }]
//
// 保存の流れ（写真なしなら 2 だけ。通信は INSERT の1回だけ）：
//   1. 写真の縮小を始める（同時に 2 の INSERT も送る。待ち時間が重なる）
//   2. records に記録を作る（photos は空）→ id が決まる
//   3. 写真を <user_id>/<record_id>/<UUID>.jpg にアップロード（最大3枚を同時に。縮小が終わった写真から順に）
//   4. records.photos と cover_photo（1枚目の path）を更新（同時に、表示用の署名付き URL も作る）
//   1〜4 のどこかで失敗したら、アップロード済み（送信中だったものも含む）の写真と作った記録を削除して、保存前の状態に戻す
//   旅（input.tripId）は 2 の INSERT に含める（通信は増えない）。undefined のときは trip_id に触れない
//   ※ 縮小・アップロードの途中で失敗したときの取り消しは、記録を先に作っている分、これまでより「記録の削除」が1回増える
export async function createRecord(input) {
  const perf = createPerf('新規記録')
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session
  if (!session) throw saveError('ログインしていません。ログインし直してください。')
  const userId = session.user.id

  const prefecture = PREFECTURES.find((p) => p.id === Number(input.prefectureId))
  if (!prefecture) throw saveError('都道府県が正しくありません。')

  const files = toArray(input.photos).map((p) => p.file).filter(Boolean)
  if (files.length > MAX_PHOTOS) throw saveError(`写真は${MAX_PHOTOS}枚までです。`)

  const insertRecord = () =>
    supabase
      .from('records')
      .insert({
        user_id: userId,
        place_name: input.placeName,
        prefecture: prefecture.name,
        visited_date: input.visitedOn,
        memo: input.memo,
        tags: input.tags,
        photos: [],
        cover_photo: null,
        ...tripColumn(input), // 旅：保存の通信は増やさず、同じ INSERT に1列足すだけ
      })
      .select()
      .single()

  // 写真なし：INSERT の1回だけ（縮小もアップロードもない）
  if (files.length === 0) {
    const { data: created, error: insertError } = await perf.time('db', insertRecord)
    if (insertError) throw insertError
    perf.end(0)
    return toRecord(created)
  }

  // 写真あり：記録の作成（INSERT）を、写真の縮小と同時に始める。id が決まったら、縮小済みの写真から送り始める
  const inserting = perf.time('db', insertRecord)
  const ready = Promise.resolve(inserting).then(({ data, error }) => {
    if (error) throw error
    return data
  })
  ready.catch(() => {}) // だれも待っていない間に失敗しても、未処理のエラーにならないように（あとで下で必ず確認する）

  const photoIds = files.map(() => crypto.randomUUID())
  const attemptedPaths = [] // アップロードを始めた写真（失敗時にまとめて削除する）

  try {
    // 3. 縮小 → アップロード
    const paths = await convertAndUpload({
      files,
      ready,
      attemptedPaths,
      perf,
      pathFor: (i, created) => `${userId}/${created.id}/${photoIds[i]}.jpg`,
    })
    const photos = paths.map((path, i) => ({ id: photoIds[i], path }))

    // 4. 写真の情報を記録に書き込む（表紙は1枚目。あとから変えられるよう、cover_photo は別の列に持つ）。表示用の URL は同時に作る
    const created = await ready
    const [{ data: updated, error: updateError }, urlMap] = await Promise.all([
      perf.time('db', () =>
        supabase.from('records').update({ photos, cover_photo: photos[0].path }).eq('id', created.id).select().single(),
      ),
      perf.time('sign', () => signPaths(paths)),
    ])
    if (updateError) throw saveError('写真の情報を記録に書き込めませんでした。', updateError)

    perf.end(files.length)
    return toRecord(updated, urlMap)
  } catch (cause) {
    const pipeline = cause && cause.pipeline
    // 記録を作れなかったとき：写真は1枚も送っていない。取り消すものはないので、そのままエラーにする
    let insertFailure = null
    const created = await ready.catch((e) => {
      insertFailure = e
      return null
    })
    if (insertFailure) {
      console.error('記録を作れませんでした', insertFailure)
      throw insertFailure
    }

    // 取り消し：アップロード済みの写真と、作った記録を削除する
    console.error('保存に失敗したため、取り消します', cause)
    const problems = []
    if (attemptedPaths.length > 0) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(attemptedPaths)
      if (removeError) {
        console.error('取り消し失敗：Storage の写真を削除できませんでした', attemptedPaths, removeError)
        problems.push('アップロード済みの写真')
      }
    }
    const { error: deleteError } = await supabase.from('records').delete().eq('id', created.id)
    if (deleteError) {
      console.error('取り消し失敗：records の行を削除できませんでした', created.id, deleteError)
      problems.push('作成した記録')
    }

    let reason = '写真の保存中にエラーが起きました。'
    if (pipeline && pipeline.stage === 'convert') {
      reason = `${files.length}枚中${pipeline.index + 1}枚目の写真を変換できませんでした。`
    } else if (pipeline && pipeline.stage === 'upload') {
      reason = `${files.length}枚中${pipeline.index + 1}枚目の写真をアップロードできませんでした（${pipeline.uploaded}枚は成功）。`
    } else if (cause && cause.userMessage) {
      reason = cause.userMessage
    }
    const outcome =
      problems.length === 0
        ? '保存は取り消しました。'
        : `保存を取り消そうとしましたが、${problems.join('と')}を削除できませんでした。Supabase の管理画面で確認してください。`
    throw saveError(`${reason}${outcome}`, cause)
  }
}

// 記録の編集。
//   input: { placeName, prefectureId, visitedOn, memo, tags, photos? }
//   photos を渡さなければ、写真には一切触れない（文字情報の5列だけ更新する）。
//   photos を渡すと、写真の追加・削除・並べ替えも行う。渡し方：
//     [{ kind: 'existing', id, path } | { kind: 'new', file }, ...]  ← 保存後の並び順のまま
//   先頭の写真が代表写真：DB でも、photos[0].path と cover_photo が必ず同じになる（0枚なら cover_photo は null）。
//
// 写真を変えるときの順序（既存の写真を、DB より先に消さない）：
//   1. 新しい写真をすべて縮小（失敗しても、まだ何も変えていない）
//   2. 新しい写真を Storage にアップロード
//   3. records を1回の UPDATE で更新（文字情報 ＋ photos ＋ cover_photo）
//   4. UPDATE が成功したあとで、外された古い写真を Storage から削除
// 失敗したとき：
//   2 または 3 で失敗 → 今回アップロードした新しい写真だけを削除する（既存の写真は絶対に消さない）
//   3 が通信エラーのとき → 行を取得し直して、今回の変更が DB に入っているかを確かめてから判断する
//   4 で失敗 → 記録の更新は成功として扱い、残った写真の path を控えて返す
// 戻り値：{ fields, photos, failedPaths }（photos は写真を変えたときだけ。src は新しい写真のぶんだけ入る）
export async function updateRecord(id, input) {
  const prefecture = PREFECTURES.find((p) => p.id === Number(input.prefectureId))
  if (!prefecture) throw saveError('都道府県が正しくありません。')
  const numericId = Number(id)
  const textColumns = {
    place_name: input.placeName,
    prefecture: prefecture.name,
    visited_date: input.visitedOn,
    memo: input.memo,
    tags: input.tags,
    ...tripColumn(input), // 旅（旅の機能が使えるときだけ。同じ UPDATE に1列足すだけ）
  }
  // 旅の機能が使えないときは、trip_id を読み取りにも含めない（列が無くてもエラーにならないように）
  const tripSelect = hasTrip(input) ? ', trip_id' : ''
  const toFields = (row) => ({
    placeName: row.place_name,
    prefectureId: prefecture.id,
    visitedOn: row.visited_date,
    memo: row.memo || '',
    tags: toArray(row.tags),
    ...(hasTrip(input) ? { tripId: toTripId(row.trip_id) } : {}),
  })

  // ---- 写真を変えない場合：文字情報の5列だけ（旅の機能があれば trip_id も）----
  if (input.photos === undefined) {
    const { data, error } = await supabase
      .from('records')
      .update(textColumns)
      .eq('id', numericId)
      .select(`id, place_name, prefecture, visited_date, memo, tags${tripSelect}`)
    if (error) throw saveError('記録を更新できませんでした。もう一度お試しください。', error)
    if (!data || data.length === 0) throw saveError('記録を更新できませんでした。記録が見つからないか、更新する権限がありません。')
    return { fields: toFields(data[0]), failedPaths: [] }
  }

  // ---- 写真も変える場合 ----
  const perf = createPerf('編集保存')
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session
  if (!session) throw saveError('ログインしていません。ログインし直してください。')
  const userId = session.user.id
  const ownPrefix = `${userId}/`

  const items = input.photos
  if (items.length > MAX_PHOTOS) throw saveError(`写真は${MAX_PHOTOS}枚までです。`)

  // いまの DB の写真（外された写真を見つけるため、画面ではなく DB を基準にする）。
  // この確認は、写真の縮小と同時に進める（新しい写真は、確認が済んでから送る。確認に失敗したら、1枚も送らない）
  const checking = perf.time('db', () =>
    supabase.from('records').select('id, photos').eq('id', numericId).maybeSingle(),
  )
  const ready = Promise.resolve(checking).then(({ data: current, error: currentError }) => {
    if (currentError) throw saveError('記録を確認できませんでした。もう一度お試しください。', currentError)
    if (!current) throw saveError('この記録が見つかりません。')
    const paths = toArray(current.photos).map((item) => item && item.path).filter(Boolean)
    // 既存の写真は、DB にある自分の写真だけ受け付ける
    for (const item of items) {
      if (item.kind === 'existing' && !paths.includes(item.path)) {
        throw saveError('写真の情報が古くなっています。編集画面を開き直してください。')
      }
    }
    return paths
  })
  ready.catch(() => {}) // だれも待っていない間に失敗しても、未処理のエラーにならないように（あとで下で必ず確認する）

  // 新しい写真だけを取り消すための関数。既存の写真は、ここでは絶対に消さない
  const attemptedPaths = []
  async function rollbackNewPhotos() {
    if (attemptedPaths.length === 0) return []
    const { error } = await supabase.storage.from(BUCKET).remove(attemptedPaths)
    if (error) {
      console.error('取り消し失敗：今回アップロードした写真を削除できませんでした', attemptedPaths, error)
      return ['今回追加した写真']
    }
    return []
  }
  const failWith = async (reason, cause, problems = []) => {
    const outcome =
      problems.length === 0
        ? '変更は取り消しました。'
        : `変更を取り消そうとしましたが、${problems.join('と')}を削除できませんでした。Supabase の管理画面で確認してください。`
    throw saveError(`${reason}${outcome}`, cause)
  }

  // 1〜2. 新しい写真を「縮小 → アップロード」（最大3枚同時。縮小は1枚ずつ）。失敗したら、今回送った写真だけを取り消す
  const newItems = items.filter((item) => item.kind === 'new')
  const newPhotoIds = newItems.map(() => crypto.randomUUID())
  let currentPaths
  if (newItems.length === 0) {
    currentPaths = await ready // 写真の追加がないときは、確認だけ（縮小・アップロードなし）
  } else {
    try {
      await convertAndUpload({
        files: newItems.map((item) => item.file),
        ready,
        attemptedPaths,
        perf,
        pathFor: (i) => `${userId}/${numericId}/${newPhotoIds[i]}.jpg`,
      })
    } catch (cause) {
      const pipeline = cause && cause.pipeline
      if (pipeline && pipeline.stage === 'ready') throw pipeline.cause // 前提の確認に失敗（写真は1枚も送っていない）
      const problems = await rollbackNewPhotos()
      if (pipeline && pipeline.stage === 'convert') {
        await failWith(`追加した${newItems.length}枚中${pipeline.index + 1}枚目の写真を変換できませんでした。`, cause, problems)
      }
      if (pipeline && pipeline.stage === 'upload') {
        await failWith(`追加した${newItems.length}枚中${pipeline.index + 1}枚目の写真をアップロードできませんでした。`, cause, problems)
      }
      await failWith('写真の保存中にエラーが起きました。', cause, problems)
    }
    currentPaths = await ready
  }

  const finalPhotos = []
  let newIndex = 0
  for (const item of items) {
    if (item.kind === 'existing') {
      finalPhotos.push({ id: item.id, path: item.path })
      continue
    }
    const photoId = newPhotoIds[newIndex]
    newIndex += 1
    finalPhotos.push({ id: photoId, path: `${userId}/${numericId}/${photoId}.jpg` })
  }
  const finalPaths = finalPhotos.map((photo) => photo.path)

  // 3. records を更新（先頭の写真が代表写真。photos[0] と cover_photo を、必ず同じにする）
  const { data: updated, error: updateError } = await perf.time('db', () =>
    supabase
      .from('records')
      .update({ ...textColumns, photos: finalPhotos, cover_photo: finalPaths[0] ?? null })
      .eq('id', numericId)
      .select(`id, place_name, prefecture, visited_date, memo, tags, photos, cover_photo${tripSelect}`),
  )

  let row = updated && updated[0]
  if (updateError) {
    // 通信エラーでも、サーバー側では成功している場合がある。行を取得し直して、今回の変更が入っているか確かめる
    console.error('記録の更新で通信エラーが起きました。DB の状態を確かめます', updateError)
    const { data: check, error: checkError } = await supabase
      .from('records')
      .select(`id, place_name, prefecture, visited_date, memo, tags, photos, cover_photo${tripSelect}`)
      .eq('id', numericId)
      .maybeSingle()
    if (checkError || !check) {
      // 状態を確かめられない。DB が新しい写真を指している可能性があるので、写真は削除せず残す
      console.error('DB の状態を確かめられませんでした。アップロード済みの写真は削除せず残します', attemptedPaths, checkError)
      throw saveError(
        '保存できたかどうかを確認できませんでした。写真は削除せずに残しています。記録を開き直して、内容を確かめてください。',
        updateError,
      )
    }
    const checkedPaths = toArray(check.photos).map((item) => item && item.path)
    if (JSON.stringify(checkedPaths) === JSON.stringify(finalPaths)) {
      row = check // 実際には更新できていた → 成功として扱う
    } else {
      const problems = await rollbackNewPhotos()
      await failWith('記録を更新できませんでした。', updateError, problems)
    }
  } else if (!row) {
    const problems = await rollbackNewPhotos()
    await failWith('記録を更新できませんでした。記録が見つからないか、更新する権限がありません。', null, problems)
  }

  // 4. 更新が成功したあとで、外された古い写真を Storage から削除する。
  //    同時に、新しく追加した写真の表示用 URL（既存の写真は、画面が持っている URL をそのまま使う）を作る
  const removedPaths = currentPaths.filter((path) => !finalPaths.includes(path) && path.startsWith(ownPrefix))
  const newPaths = finalPaths.filter((path) => !currentPaths.includes(path))
  async function removeOldPhotos() {
    if (removedPaths.length === 0) return []
    const { data: removed, error: removeError } = await supabase.storage.from(BUCKET).remove(removedPaths)
    let failed
    if (removeError) {
      failed = removedPaths
    } else {
      const done = new Set((removed || []).map((item) => item.name))
      failed = removedPaths.filter((path) => !done.has(path))
    }
    if (failed.length > 0) {
      console.error('記録は更新しましたが、Storage から削除できなかった古い写真があります:', failed)
    }
    return failed
  }
  const [failedPaths, urlMap] = await Promise.all([removeOldPhotos(), perf.time('sign', () => signPaths(newPaths))])
  perf.end(newItems.length)
  return {
    fields: toFields(row),
    photos: finalPhotos.map((photo) => ({ ...photo, src: urlMap[photo.path] || null })),
    failedPaths,
  }
}

// 記録の削除。順序：
//   1. 対象の行を取得して、写真の path を控える
//   2. records の行を削除する（失敗したら、ここで止める。Storage には触れない）
//   3. Storage の写真を削除する（失敗しても、記録の削除は成功として扱う）
// 戻り値：{ failedPaths } … Storage から消せなかった写真の path（すべて消せたら空の配列）
// RLS と Storage のポリシーにより、自分の記録・自分のフォルダの写真にしか触れません。
export async function deleteRecord(id) {
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session
  if (!session) throw saveError('ログインしていません。ログインし直してください。')
  const numericId = Number(id)

  // 1. 対象の行と、写真の path
  const { data: row, error: selectError } = await supabase
    .from('records')
    .select('id, photos, cover_photo')
    .eq('id', numericId)
    .maybeSingle()
  if (selectError) throw saveError('記録を確認できませんでした。もう一度お試しください。', selectError)
  if (!row) throw saveError('この記録が見つかりません。すでに削除されている可能性があります。')

  // 念のため、自分のフォルダ（<user_id>/…）の写真だけを対象にする
  const ownPrefix = `${session.user.id}/`
  const allPaths = [...new Set([...pathsOf([row]), row.cover_photo].filter(Boolean))]
  const paths = allPaths.filter((path) => path.startsWith(ownPrefix))
  if (paths.length !== allPaths.length) {
    console.warn('自分のフォルダ以外の path は、削除の対象から外しました', allPaths.filter((path) => !paths.includes(path)))
  }

  // 2. records の行を削除（RLS で 0 件になってもエラーにならないので、消えた行数も確かめる）
  const { data: deleted, error: deleteError } = await supabase
    .from('records')
    .delete()
    .eq('id', numericId)
    .select('id')
  if (deleteError) throw saveError('記録を削除できませんでした。もう一度お試しください。', deleteError)
  if (!deleted || deleted.length === 0) throw saveError('記録を削除できませんでした。もう一度お試しください。')

  // 3. 写真を削除。失敗しても記録は消えているので、成功として扱い、残った path を控えて返す
  if (paths.length === 0) return { failedPaths: [] }
  const { data: removed, error: removeError } = await supabase.storage.from(BUCKET).remove(paths)
  if (removeError) {
    console.error('記録は削除しましたが、Storage の写真を削除できませんでした。残っている写真:', paths, removeError)
    return { failedPaths: paths }
  }
  const removedPaths = new Set((removed || []).map((item) => item.name))
  const failedPaths = paths.filter((path) => !removedPaths.has(path))
  if (failedPaths.length > 0) {
    console.error('記録は削除しましたが、Storage の一部の写真が残っています:', failedPaths)
  }
  return { failedPaths }
}

// タグは、記録に付けて保存した時点で records.tags に残ります（専用の保存先は今はありません）
export async function createTag(name) {
  return name
}
