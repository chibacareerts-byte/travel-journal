// 記録とタグを、アプリ全体で共有するための入れ物（React Context）です。
// 画面側では  const { records, tags, addRecord, addTag } = useRecords()  と書くだけで使えます。

import { createContext, useContext, useEffect, useState } from 'react'
import { fetchRecords, fetchTags, createRecord, createTag, deleteRecord, updateRecord as saveRecordChanges } from './recordsApi'
import { sortNewestFirst } from './recordUtils'
import { DEFAULT_TAGS } from '../data/tags'

const RecordsContext = createContext(null)

export function RecordsProvider({ children }) {
  const [records, setRecords] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  // 読み込みに失敗したとき true。「記録が0件」とは別の状態として画面に伝える
  const [error, setError] = useState(false)

  function fetchAll() {
    return Promise.all([fetchRecords(), fetchTags()])
      .then(([r, t]) => {
        setRecords(sortNewestFirst(r))
        setTags(t)
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

  const value = { records, tags, loading, error, reload, addRecord, addTag, updateRecord, removeRecord }
  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>
}

export function useRecords() {
  return useContext(RecordsContext)
}
