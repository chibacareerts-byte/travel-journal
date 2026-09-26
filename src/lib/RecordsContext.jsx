// 記録とタグを、アプリ全体で共有するための入れ物（React Context）です。
// 画面側では  const { records, tags, addRecord, addTag } = useRecords()  と書くだけで使えます。

import { createContext, useContext, useEffect, useState } from 'react'
import { fetchRecords, fetchTags, createRecord, createTag } from './recordsApi'
import { sortNewestFirst } from './recordUtils'

const RecordsContext = createContext(null)

export function RecordsProvider({ children }) {
  const [records, setRecords] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchRecords(), fetchTags()]).then(([r, t]) => {
      setRecords(sortNewestFirst(r))
      setTags(t)
      setLoading(false)
    })
  }, [])

  async function addRecord(input) {
    const created = await createRecord(input)
    setRecords((prev) => sortNewestFirst([...prev, created]))
    return created
  }

  async function addTag(name) {
    const clean = name.trim()
    if (!clean || tags.includes(clean)) return clean
    await createTag(clean)
    setTags((prev) => [...prev, clean])
    return clean
  }

  const value = { records, tags, loading, addRecord, addTag }
  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>
}

export function useRecords() {
  return useContext(RecordsContext)
}
