// 記録とタグを、アプリ全体で共有するための入れ物（React Context）です。
// 画面側では  const { records, tags, addRecord, addTag } = useRecords()  と書くだけで使えます。

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  fetchRecords,
  fetchTags,
  createRecord,
  createTag,
  deleteRecord,
  refreshPhotoUrls,
  updateRecord as saveRecordChanges,
} from './recordsApi'
import { sortNewestFirst } from './recordUtils'
import { createTrip, fetchTrips } from './tripsApi'
import { cleanTripTitle } from './tripUtils'
import { DEFAULT_TAGS } from '../data/tags'

const RecordsContext = createContext(null)

// 写真の表示用 URL（署名付き・有効1時間）を、期限が切れる前に静かに作り直す設定
const STALE_MS = 45 * 60 * 1000 // 前回の署名から、これ以上たったら作り直す（有効期限の60分より15分早い）
const CHECK_EVERY_MS = 60 * 1000 // 確認の間隔（確認だけでは通信しない）
const FAILED_RETRY_MS = 5 * 60 * 1000 // 前回の試行から、この時間は再試行しない（通信障害時に毎分リクエストしないため）

// records の写真の src だけを、path をキーに新しい URL へ差し替える。
// 記録本体・photos の長さ・id・path はそのまま。新しい URL が無い path は、いまの src を残す。
// 何も変わらない記録は、同じオブジェクトのまま返す。
function applyPhotoUrls(list, urlMap) {
  return list.map((record) => {
    let changed = false
    const photos = record.photos.map((photo) => {
      const url = urlMap[photo.path]
      if (!url || url === photo.src) return photo
      changed = true
      return { ...photo, src: url }
    })
    return changed ? { ...record, photos } : record
  })
}

export function RecordsProvider({ children }) {
  const [records, setRecords] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  // 読み込みに失敗したとき true。「記録が0件」とは別の状態として画面に伝える
  const [error, setError] = useState(false)
  // 旅（trips）。trips.sql をまだ実行していない・取得に失敗したときは tripsReady = false にして、
  // 旅の欄や旅ごとの表示を出さない（記録の表示・保存は今まで通り。trip_id にも触れない）
  const [trips, setTrips] = useState([])
  const [tripsReady, setTripsReady] = useState(false)

  // 署名付き URL の作り直し用（どれも画面には関係ないので、state ではなく ref）
  const recordsRef = useRef([]) // 最新の records（非同期の処理の中から読む）
  const signedAtRef = useRef(null) // 最後に「すべての写真の署名」に成功した時刻。null なら、作り直しの対象
  const lastAttemptRef = useRef(null) // 最後に作り直しを試みた時刻（成功・失敗どちらも）
  const inFlightRef = useRef(false) // 作り直しの通信中かどうか

  useEffect(() => {
    recordsRef.current = records
  }, [records])

  function fetchAll() {
    // 旅は記録と同時に取りに行く（待ち時間を増やさない）。失敗しても記録の読み込みは失敗にしない
    const tripsLoad = fetchTrips().then(
      (list) => ({ ok: true, list }),
      (err) => {
        console.info('旅の機能は使えません（supabase/trips.sql が未実行、または取得に失敗）。記録は今まで通り表示します。', err && (err.code || err.message))
        return { ok: false, list: [] }
      },
    )
    return Promise.all([fetchRecords(), fetchTags(), tripsLoad])
      .then(([r, t, tr]) => {
        // 取得時の署名は、すべての写真に src が付いていれば成功とみなす（一部でも付いていなければ null のまま。
        // 失敗の理由までは分からないので、その場合は最初の確認で1回だけ作り直しを試みる）
        signedAtRef.current = r.every((rec) => rec.photos.every((p) => p.src)) ? Date.now() : null
        lastAttemptRef.current = null
        setRecords(sortNewestFirst(r))
        setTags(t)
        setTrips(tr.list)
        setTripsReady(tr.ok)
      })
      .catch((err) => {
        // 読み込み中のまま止まらないようにし、失敗したことを error で伝える（records は空のまま＝「0件」ではない）
        console.error('記録の取得に失敗しました', err)
        setError(true)
        setTags((prev) => (prev.length > 0 ? prev : DEFAULT_TAGS))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 写真の署名付き URL を、期限が切れる前に作り直す。
  // きっかけは「画面が見えるようになった／ページが戻ってきた／60秒ごとの確認」だけ（state の変化では動かさない）。
  // 確認しても、条件がそろわなければ通信しない。作り直すのは src だけで、loading・error・記録の中身には触れない。
  useEffect(() => {
    if (loading || error) return undefined

    function check() {
      if (document.visibilityState !== 'visible') return
      if (inFlightRef.current) return
      const now = Date.now()
      if (signedAtRef.current !== null && now - signedAtRef.current < STALE_MS) return
      if (lastAttemptRef.current !== null && now - lastAttemptRef.current < FAILED_RETRY_MS) return
      const paths = [...new Set(recordsRef.current.flatMap((r) => r.photos.map((p) => p.path).filter(Boolean)))]
      if (paths.length === 0) return

      inFlightRef.current = true
      lastAttemptRef.current = now
      refreshPhotoUrls(paths)
        .then((urlMap) => {
          if (!urlMap) return // 失敗（警告は出済み）。signedAt は更新しない → 5分後に再試行
          signedAtRef.current = now
          setRecords((prev) => applyPhotoUrls(prev, urlMap))
        })
        .catch((err) => console.warn('写真の表示用URLの更新に失敗しました', err))
        .finally(() => {
          inFlightRef.current = false
        })
    }

    const onVisibility = () => check()
    const onPageShow = () => check()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    const timer = setInterval(check, CHECK_EVERY_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
      clearInterval(timer)
    }
  }, [loading, error])

  // 失敗したあと、もう一度読み込む
  function reload() {
    setError(false)
    setLoading(true)
    fetchAll()
  }

  async function addRecord(input) {
    const created = await createRecord(input)
    setRecords((prev) => sortNewestFirst([...prev, created]))
    return created
  }

  // 編集：Supabase の更新が成功してから、state の該当の記録を差し替える。
  // 文字情報の5項目は差し替える。写真は、編集画面で変えたときだけ差し替え、
  // すでにある写真は、表示用の署名付き URL を含めて元の値をそのまま残す（新しく追加した写真だけ新しい URL）。
  // 訪問日が変わったときのために、並び順も作り直す。
  // 戻り値：{ failedPaths } … Storage から消せなかった古い写真の path
  async function updateRecord(id, input) {
    const { fields, photos, failedPaths } = await saveRecordChanges(id, input)
    setRecords((prev) =>
      sortNewestFirst(
        prev.map((r) => {
          if (r.id !== String(id)) return r
          if (!photos) return { ...r, ...fields }
          const nextPhotos = photos.map(
            (p) => r.photos.find((old) => old.id === p.id) || { id: p.id, path: p.path, src: p.src, tone: 5 },
          )
          return { ...r, ...fields, photos: nextPhotos }
        }),
      ),
    )
    return { failedPaths }
  }

  // Supabase 側の削除が終わってから、画面の記録一覧（state）から外す。
  // HOME・記録一覧・検索・都道府県ページ・年別は、すべてこの state から作っているので、すぐに反映される。
  // 戻り値：{ failedPaths } … Storage から消せなかった写真の path
  async function removeRecord(id) {
    const result = await deleteRecord(id)
    setRecords((prev) => prev.filter((r) => r.id !== String(id)))
    return result
  }

  async function addTag(name) {
    const clean = name.trim()
    if (!clean || tags.includes(clean)) return clean
    await createTag(clean)
    setTags((prev) => [...prev, clean])
    return clean
  }

  // 旅を用意する：同じ名前の旅がすでにあればそれを使い、なければ作る（記録の保存の直前に呼ぶ）
  async function ensureTrip(title) {
    const clean = cleanTripTitle(title)
    const existing = trips.find((t) => t.title === clean)
    if (existing) return existing
    const created = await createTrip(clean)
    setTrips((prev) => [...prev, created])
    return created
  }

  const value = {
    records,
    tags,
    trips,
    tripsReady,
    loading,
    error,
    reload,
    addRecord,
    addTag,
    ensureTrip,
    updateRecord,
    removeRecord,
  }
  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>
}

export function useRecords() {
  return useContext(RecordsContext)
}
