// 「新しい順 / 古い順」だけの、小さな並べ替えトグル。カードにはせず、文字中心の軽いUIです。
// order: 'newest' | 'oldest'　／　onChange(order)

export default function DateSortToggle({ order, onChange }) {
  return (
    <div className="sort-toggle" role="group" aria-label="並べ替え">
      <button
        type="button"
        className={order === 'newest' ? 'sort-toggle__btn is-active' : 'sort-toggle__btn'}
        aria-pressed={order === 'newest'}
        onClick={() => onChange('newest')}
      >
        新しい順
      </button>
      <button
        type="button"
        className={order === 'oldest' ? 'sort-toggle__btn is-active' : 'sort-toggle__btn'}
        aria-pressed={order === 'oldest'}
        onClick={() => onChange('oldest')}
      >
        古い順
      </button>
    </div>
  )
}
