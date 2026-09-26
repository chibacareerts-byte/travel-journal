// 記録の読み込み状態に応じた、静かな表示。
//   読み込み中 … 「読み込み中…」だけを出す（「0件」「記録なし」などの空状態は出さない）
//   読み込み失敗 … 「読み込めませんでした」と［再読み込み］を出す（記録が消えたようには見せない）
//   読み込み完了 … 中身（children）を表示する
// 「本当の0件」の表示（EmptyRecords）も、ここに置いています。

import { Link } from 'react-router-dom'
import { useRecords } from '../lib/RecordsContext'

export function LoadError({ tight = false }) {
  const { reload } = useRecords()
  return (
    <div className={tight ? 'empty empty--tight' : 'empty'} role="alert">
      <p>記録を読み込めませんでした。</p>
      <button type="button" className="btn-line" onClick={reload}>
        再読み込み
      </button>
    </div>
  )
}

export function EmptyRecords() {
  return (
    <div className="empty">
      <p>まだ記録がありません。</p>
      <Link to="/new" className="btn-line">
        ＋ 最初の記録をつける
      </Link>
    </div>
  )
}

export default function RecordsGate({ children }) {
  const { loading, error } = useRecords()
  if (loading) return <p className="empty" role="status">読み込み中…</p>
  if (error) return <LoadError />
  return children
}
