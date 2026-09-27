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

  // 追加の条件（都道府県・期間・タグ）を開くかどうか。場所名は常に表示するので、数えない
  const [moreOpen, setMoreOpen] = useState(false)
  // 設定されている追加条件の数：都道府県 1、期間 1（開始・終了のどちらか／両方でも1）、タグ 1（複数選んでも1）
  const moreCount =
    (filters.prefectureId ? 1 : 0) + (filters.from || filters.to ? 1 : 0) + (filters.tags.length > 0 ? 1 : 0)

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
            enterKeyHint="search"
            onKeyDown={(e) => {
              // Enter：ライブ検索の結果はそのまま、キーボードだけ閉じる。日本語の変換確定の Enter では閉じない
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            onChange={(e) => set('keyword')(e.target.value)}
          />
        </div>

        <div>
          <button
            type="button"
            className="filter-toggle"
            aria-expanded={moreOpen}
            aria-controls="q-more"
            onClick={() => setMoreOpen(!moreOpen)}
          >
            {moreCount > 0 ? `絞り込み（${moreCount}）` : '絞り込み'}
            <svg className="filter-toggle__chev" width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m1 1.5 5 5 5-5" />
            </svg>
          </button>

          {moreOpen && (
            <div className="search-more" id="q-more">
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
                <span className="field__label">タグ</span>
                <TagDropdown selected={filters.tags} onChange={set('tags')} />
              </div>
            </div>
          )}
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
