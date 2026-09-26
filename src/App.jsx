// アプリ全体の骨組み：URL と画面（pages）の対応表 ＋ 下部ナビ。

import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import PrefectureListPage from './pages/PrefectureListPage'
import PrefecturePage from './pages/PrefecturePage'
import RecordsPage from './pages/RecordsPage'
import RecordDetailPage from './pages/RecordDetailPage'
import NewRecordPage from './pages/NewRecordPage'
import SearchPage from './pages/SearchPage'
import YearsPage from './pages/YearsPage'
import YearPage from './pages/YearPage'

// 画面を切り替えたとき、いつも一番上から表示する
function ScrollToTop() {
  const { pathname } = useLocation()
useEffect(() => {
  window.scrollTo(0, 0)
}, [pathname])
  return null
}

export default function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <main className="app__main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/prefectures" element={<PrefectureListPage />} />
          <Route path="/prefecture/:id" element={<PrefecturePage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/record/:id" element={<RecordDetailPage />} />
          <Route path="/new" element={<NewRecordPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/years" element={<YearsPage />} />
          <Route path="/years/:year" element={<YearPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
