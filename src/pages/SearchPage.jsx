// 5. 検索。場所名・都道府県・期間・タグ（複数選択）で絞り込み。
import { useState } from 'react'
import RecordEntry from '../components/RecordEntry'
import TagDropdown from '../components/TagDropdown'
import RecordsGate from '../components/RecordsGate'
import { REGIONS, PREFECTURES } from '../data/prefectures'
import { useRecords } from '../lib/RecordsContext'
import { filterRecords } from '../lib/recordUtils'

const EMPTY = { keyword: '', prefectureId: '', from: '', to: '', tags: [] }

export default function SearchPage() {
  const { records } = useRecords()
  const [filters, setFilters] = useState(EMPTY)

  const set = (key) => (value) => setFilters((prev) => ({ ...prev, [key]: value }))
  const isFiltering =
    filters.keyword || filters.prefectureId || filters.from || filters.to || filters.tags.length > 0
  const results = filterRecords(records, filters)

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Search</p>
        <h1 className="page-title">検索</h1>
      </header>

      <div className="form">
        <div className="field">
          <label className="field__label" htmlFor="q-keyword">場所名</label>
          <input
            id="q-keyword"
            type="search"
            className="input"
            value={filters.keyword}
            placeholder="場所の名前で探す"
            onChange={(e) => set('keyword')(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="q-pref">都道府県</label>
          <select
            id="q-pref"
            className="input input--select"
            value={filters.prefectureId}
            onChange={(e) => set('prefectureId')(e.target.value)}
          >
            <option value="">すべて</option>
            {REGIONS.map((region) => (
              <optgroup key={region} label={region}>
                {PREFECTURES.filter((p) => p.region === region).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field__label">期間</span>
          <div className="range">
            <input
              type="date"
              className="input"
              value={filters.from}
              aria-label="期間の開始日"
              onChange={(e) => set('from')(e.target.value)}
            />
            <span aria-hidden="true">〜</span>
            <input
              type="date"
              className="input"
              value={filters.to}
              aria-label="期間の終了日"
              onChange={(e) => set('to')(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <span className="field__label">タグ（複数選択・すべて含むもの）</span>
          <TagDropdown selected={filters.tags} onChange={set('tags')} />
        </div>
      </div>

      <section className="results">
        {/* 読み込み中・失敗中は「0件」を出さず、状態だけを静かに伝える */}
        <RecordsGate>
          <div className="results__head">
            <p className="results__count">{results.length}件</p>
            {isFiltering && (
              <button type="button" className="text-btn" onClick={() => setFilters(EMPTY)}>
                条件をクリア
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <p className="empty">{records.length === 0 ? 'まだ記録がありません。' : '条件に合う記録はありません。'}</p>
          ) : (
            <div className="entry-grid">
              {results.map((r) => (
                <RecordEntry key={r.id} record={r} compact />
              ))}
            </div>
          )}
        </RecordsGate>
      </section>
    </div>
  )
}
