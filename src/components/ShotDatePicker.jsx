// 選んだ写真の撮影日を、訪問日に設定するための小さな欄。撮影日が1つも取れなければ何も出さない。
//   dates     : 写真ごとの撮影日（写真の並び順。撮影日の無い写真は含めない）
//   visitedOn : いまの訪問日
//   onPick(d) : 訪問日を d（'YYYY-MM-DD'）にする
// 同じ日付は1つにまとめる。未来の日付（カメラの時計のずれ）は、訪問日の上限（今日）を超えるので候補に出さない。
// 撮影日を勝手に訪問日へ入れることはない（ユーザーが押したときだけ）。

import { useMemo } from 'react'
import { today } from './RecordFields'
import { formatDate, formatDotDate } from '../lib/recordUtils'

export default function ShotDatePicker({ dates, visitedOn, onPick }) {
  const candidates = useMemo(() => {
    const max = today()
    return [...new Set(dates)].filter((d) => d && d <= max).sort()
  }, [dates])

  if (candidates.length === 0) return null

  // 候補が1つ：「この日（2026.09.18）を訪問日に設定」
  if (candidates.length === 1) {
    const d = candidates[0]
    const on = d === visitedOn
    return (
      <div className="shot-dates">
        <button
          type="button"
          className={on ? 'shot-date shot-date--wide is-on' : 'shot-date shot-date--wide'}
          aria-pressed={on}
          onClick={() => onPick(d)}
        >
          {on ? `✓ 訪問日は撮影日（${formatDotDate(d)}）です` : `この日（${formatDotDate(d)}）を訪問日に設定`}
        </button>
      </div>
    )
  }

  // 候補が複数：「撮影日を訪問日に設定」＋ 9/18・9/19 …（年が違うときは年も出す）
  const sameYear = candidates.every((d) => d.slice(0, 4) === candidates[0].slice(0, 4))
  const short = (d) => (sameYear ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : formatDotDate(d))
  return (
    <div className="shot-dates">
      <p className="shot-dates__label">撮影日を訪問日に設定</p>
      <div className="shot-dates__list">
        {candidates.map((d) => {
          const on = d === visitedOn
          return (
            <button
              key={d}
              type="button"
              className={on ? 'shot-date is-on' : 'shot-date'}
              aria-pressed={on}
              aria-label={`${formatDate(d)}を訪問日に設定`}
              onClick={() => onPick(d)}
            >
              {on ? `✓ ${short(d)}` : short(d)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
