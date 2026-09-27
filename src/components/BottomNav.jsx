// 画面下部に固定されるナビゲーション：地図 / 記録 / ＋ / 検索 / 年別

import { NavLink, useLocation } from 'react-router-dom'

const stroke = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const icons = {
  map: (
    <svg {...stroke}>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  ),
  records: (
    <svg {...stroke}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="m4 16 4.5-4.5 3.5 3.5 3-3L20 16" />
      <circle cx="9" cy="9" r="1.2" />
    </svg>
  ),
  plus: (
    <svg {...stroke} strokeWidth={1.8}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  search: (
    <svg {...stroke}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  ),
  years: (
    <svg {...stroke}>
      <rect x="4" y="5" width="16" height="15" rx="1" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  ),
}

const items = [
  { to: '/', label: '地図', icon: 'map', end: true, alsoActive: '/prefecture' }, // 都道府県一覧・都道府県ページでも点灯
  { to: '/records', label: '記録', icon: 'records' },
  { to: '/new', label: '新規記録', icon: 'plus', center: true },
  { to: '/search', label: '検索', icon: 'search' },
  { to: '/years', label: '年別', icon: 'years' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="bottom-nav" aria-label="メインメニュー">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          aria-label={item.label}
          className={({ isActive }) =>
            'bottom-nav__item' +
            (item.center ? ' bottom-nav__item--center' : '') +
            (isActive || (item.alsoActive && pathname.startsWith(item.alsoActive)) ? ' is-active' : '')
          }
        >
          <span className="bottom-nav__icon">{icons[item.icon]}</span>
          {!item.center && <span className="bottom-nav__label">{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  )
}
