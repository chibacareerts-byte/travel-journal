// 保存中の写真の進み具合を、文字だけで静かに伝える：「写真を保存しています 3 / 10」
// done は、アップロードが終わった枚数。バーや動きは付けない（数字だけが変わる）。

export default function SaveProgress({ done, total }) {
  return (
    <p className="field__hint save-progress" role="status" aria-atomic="true">
      写真を保存しています
      <span className="save-progress__count">
        {done} / {total}
      </span>
    </p>
  )
}
