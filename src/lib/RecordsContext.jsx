// 記録とタグを、アプリ全体で共有するための入れ物（React Context）です。
// 画面側では  const { records, tags, addRecord, addTag } = useRecords()  と書くだけで使えます。

import { createContext, useContext, useEffect, useState } from 'react'
import { fetchRecords, fetchTags, createRecord, createTag, deleteRecord } from './recordsApi'
import { sortNewestFirst } from './recordUtils'
import { DEFAULT_TAGS } from '../data/tags'

const RecordsContext = createContext(null)

export function RecordsProvider({ children }) {
  const [records, setRecords] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchRecords(), fetchTags()])
      .then(([r, t]) => {
        setRecords(sortNewestFirst(r))
        setTags(t)
      })
      .catch((error) => {
        // 取得に失敗しても、読み込み中のまま止まらないようにする（記録は空のまま表示する）
        console.error('記録の取得に失敗しました', error)
        setTags(DEFAULT_TAGS)
      })
      .finally(() => setLoading(false))
  }, [])

  async function addRecord(input) {
    const created = await createRecord(input)
    setRecords((prev) => sortNewestFirst([...prev, created]))
    return created
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

  const value = { records, tags, loading, addRecord, addTag, removeRecord }
  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>
}

export function useRecords() {
  return useContext(RecordsContext)
}
