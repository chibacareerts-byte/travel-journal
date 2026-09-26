// サブページ上部の「‹ 戻る」バー。
// 履歴があれば1つ前に戻り、直接開いたときは fallback の場所へ移動します。

import { useNavigate } from 'react-router-dom'

export default function BackBar({ fallback = '/', label = '戻る' }) {
  const navigate = useNavigate()

  function goBack() {
    if (window.history.state && window.history.state.idx > 0) navigate(-1)
    else navigate(fallback)
  }

  return (
    <div className="backbar">
      <button type="button" className="backbar__btn" onClick={goBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7" />
        </svg>
        {label}
      </button>
    </div>
  )
}
