// 表示専用のタグ一覧（タップはできません）。
export default function TagList({ tags }) {
  if (!tags || tags.length === 0) return null
  return (
    <ul className="taglist">
      {tags.map((t) => (
        <li key={t} className="tag">
          {t}
        </li>
      ))}
    </ul>
  )
}
