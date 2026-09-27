// 開発中（npm run dev）だけ、保存処理の各段階の時間を計って、ブラウザのコンソールに出す道具です。
// 本番のビルド（npm run build）では import.meta.env.DEV が false になり、何も計らず・何も表示しません（画面には一切出ません）。
//
//   const perf = createPerf('新規記録')
//   await perf.time('resize', () => 画像を縮小する())   // 段階ごとの時間を集計（'resize' 画像処理 / 'upload' Storage / 'db' DB / 'sign' 表示用URL）
//   perf.end(写真の枚数)                                  // 全体の時間と、段階ごとの合計・実時間・回数を出力
//
// 「合計」は各回の所要時間の足し算、「実時間」は最初の開始から最後の終了まで。並列にすると、合計より実時間が短くなります。
// 比べたいとき（開発中のコンソールで）：  window.__saveUploadConcurrency = 1  と入れると、写真を1枚ずつ送る動きになります。

const NAMES = { resize: '画像処理', upload: 'Storageアップロード', db: 'DB保存', sign: '表示用URL' }

const NOOP = { time: (name, fn) => fn(), end() {} }

export function createPerf(label) {
  if (!import.meta.env.DEV) return NOOP
  const startedAt = performance.now()
  const stats = {}
  return {
    async time(name, fn) {
      const t0 = performance.now()
      try {
        return await fn()
      } finally {
        const t1 = performance.now()
        const s = (stats[name] ||= { sum: 0, count: 0, first: t0, last: t1 })
        s.sum += t1 - t0
        s.count += 1
        s.first = Math.min(s.first, t0)
        s.last = Math.max(s.last, t1)
      }
    },
    end(photoCount) {
      const total = performance.now() - startedAt
      const ms = (n) => `${Math.round(n)}ms`
      const parts = Object.entries(stats).map(
        ([name, s]) => `${NAMES[name] || name} 合計${ms(s.sum)}（実時間${ms(s.last - s.first)}・${s.count}回）`,
      )
      const c = window.__saveUploadConcurrency
      console.log(
        `[保存計測] ${label} 写真${photoCount ?? 0}枚 全体${ms(total)} | ${parts.join(' | ') || '通信なし'}` +
          (c ? ` | 同時アップロード数=${c}` : ''),
      )
    },
  }
}
