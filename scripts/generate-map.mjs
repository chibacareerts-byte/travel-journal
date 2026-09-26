// 日本地図のSVGパスを作るスクリプト（最初に1回だけ実行済み。普段は触りません）
// 使い方: npm run map
import fs from 'node:fs'
import { geoMercator, geoPath } from 'd3-geo'
import { topology } from 'topojson-server'
import { presimplify, simplify, quantile } from 'topojson-simplify'
import { feature } from 'topojson-client'

const raw = JSON.parse(fs.readFileSync('scripts/japan.geojson', 'utf8'))

// 遠くの小さな離島（小笠原など）を除いて、日本列島を大きく表示するための下ごしらえ。
// 各ポリゴンの中心が「本州〜九州あたり」の範囲に入るものだけ残す。沖縄は全部残す。
function center(poly) {
  const ring = poly[0]
  const lons = ring.map((c) => c[0])
  const lats = ring.map((c) => c[1])
  return [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2]
}
const inMain = (poly) => {
  const [lon, lat] = center(poly)
  return lon > 128.5 && lon < 146.5 && lat > 30.6 && lat < 46
}
const src = {
  ...raw,
  features: raw.features.map((f) => {
    if (f.properties.id === 47) {
      // 沖縄は本島まわり（東経126.5〜129度）だけ使う。小さな枠の中で島が見えるように
      const polys = f.geometry.coordinates.filter((poly) => {
        const [lon] = center(poly)
        return lon > 126.5 && lon < 129
      })
      return { ...f, geometry: { type: 'MultiPolygon', coordinates: polys } }
    }
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).filter(inMain)
    return { ...f, geometry: { type: 'MultiPolygon', coordinates: polys } }
  }),
}
const topo = presimplify(topology({ p: src }))
const min = quantile(topo, 0.06) // 小さいほど細かい。値を大きくすると軽くなる
const simple = simplify(topo, min)
const fc = feature(simple, simple.objects.p)

const W = 400
const H = 460
const main = fc.features.filter((f) => f.properties.id !== 47)
// 沖縄は島が小さいので、単純化せず元の形のまま使う
const okinawa = src.features.filter((f) => f.properties.id === 47)

const mainProj = geoMercator().fitExtent(
  [[4, 4], [W - 4, H - 4]],
  { type: 'FeatureCollection', features: main }
)
const okiProj = geoMercator().fitExtent(
  [[14, 12], [84, 68]],
  { type: 'FeatureCollection', features: okinawa }
)

const mk = (proj) => geoPath(proj).digits(1)
const out = {}
for (const f of main) out[f.properties.id] = mk(mainProj)(f)
for (const f of okinawa) out[f.properties.id] = mk(okiProj)(f)

const body =
  `// 自動生成ファイル（scripts/generate-map.mjs）。手で編集しないでください。\n` +
  `export const MAP_VIEWBOX = '0 0 ${W} ${H}'\n` +
  `export const MAP_PATHS = ${JSON.stringify(out)}\n`
fs.writeFileSync('src/data/japanPaths.js', body)
console.log('paths:', Object.keys(out).length, 'bytes:', body.length)
