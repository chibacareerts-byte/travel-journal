// 写真の「撮影日」（EXIF の DateTimeOriginal）だけを読む、小さな自作の読み取り処理。
//
// ・画像そのものはデコードしない（ピクセルは読まない）。ファイルの先頭など、必要な範囲のバイトだけを読む
// ・対応：JPEG（APP1 の Exif）と、HEIC / HEIF / AVIF（ISOBMFF の Exif アイテム）
//   iPhone の写真が HEIC のまま渡されても、JPEG に変換されて渡されても読める
// ・それ以外の形式や、EXIF が無い・壊れている写真は、静かに null（エラーにしない）
// ・戻り値は 'YYYY-MM-DD'（撮影した場所の、その時の日付。タイムゾーンの変換はしない）
//
// 撮影日は表示と「訪問日に設定」の候補に使うだけ。訪問日（visited_date）へ勝手に入れることはない。

const WINDOW = 64 * 1024 // 1回に読むバイト数
const JPEG_SCAN_LIMIT = 4 * 1024 * 1024 // JPEG で Exif を探す範囲（先頭から）
const META_LIMIT = 1024 * 1024 // HEIC の meta ボックスとして受け付ける大きさの上限
const EXIF_ITEM_LIMIT = 512 * 1024 // HEIC の Exif アイテムとして受け付ける大きさの上限
const MAX_IFD_ENTRIES = 1000

const TAG_EXIF_IFD = 0x8769
const TAG_DATE_TIME_ORIGINAL = 0x9003
const TAG_DATE_TIME_DIGITIZED = 0x9004 // DateTimeOriginal が無いときだけ使う（どちらも「撮影した時刻」）

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'avif', 'avis'])

// ファイルの一部だけを読むための小さな窓。同じ範囲は読み直さない
function createReader(blob) {
  let start = 0
  let view = new DataView(new ArrayBuffer(0))
  return {
    size: blob.size,
    // offset から n バイトが読める DataView と、その中での位置を返す。ファイルの外なら null
    async at(offset, n) {
      if (offset < 0 || n < 0 || offset + n > blob.size) return null
      if (offset < start || offset + n > start + view.byteLength) {
        start = offset
        view = new DataView(await blob.slice(offset, offset + Math.max(n, WINDOW)).arrayBuffer())
        if (view.byteLength < n) return null
      }
      return { view, pos: offset - start }
    },
  }
}

const fourCC = (view, pos) =>
  String.fromCharCode(view.getUint8(pos), view.getUint8(pos + 1), view.getUint8(pos + 2), view.getUint8(pos + 3))

// ---- 撮影日の文字列 → 'YYYY-MM-DD' ----
// EXIF の書式は 'YYYY:MM:DD HH:MM:SS'。まれに - や / の区切りもあるので受け付ける。あり得ない日付は null
export function parseExifDate(text) {
  const m = /^\s*(\d{4})[:\-/](\d{2})[:\-/](\d{2})/.exec(text || '')
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1) return null
  const check = new Date(Date.UTC(y, mo - 1, d))
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null // 2月30日など
  return `${m[1]}-${m[2]}-${m[3]}`
}

// ---- TIFF（EXIF の中身）から撮影日を探す ----
// view の base から length バイトが TIFF のデータ。どこかがおかしければ null
export function dateFromTiff(view, base, length) {
  if (!view || length < 8 || base < 0 || base + length > view.byteLength) return null
  const order = view.getUint16(base)
  if (order !== 0x4949 && order !== 0x4d4d) return null
  const le = order === 0x4949
  const u16 = (off) => view.getUint16(base + off, le)
  const u32 = (off) => view.getUint32(base + off, le)
  if (u16(2) !== 42) return null
  const inRange = (off, n) => off >= 0 && off + n <= length

  // IFD（タグの一覧）を読み、tag → { type, count, valueOffset(値の入っている位置) } を返す
  function readIfd(ifdOffset) {
    if (!inRange(ifdOffset, 2)) return null
    const count = u16(ifdOffset)
    if (count > MAX_IFD_ENTRIES || !inRange(ifdOffset + 2, count * 12)) return null
    const tags = new Map()
    for (let i = 0; i < count; i += 1) {
      const entry = ifdOffset + 2 + i * 12
      const tag = u16(entry)
      const type = u16(entry + 2)
      const n = u32(entry + 4)
      tags.set(tag, { type, count: n, entry })
    }
    return tags
  }

  function readAscii(info) {
    if (!info || info.type !== 2 || info.count < 10 || info.count > 64) return null // 2 = ASCII
    const at = info.count <= 4 ? info.entry + 8 : u32(info.entry + 8)
    if (!inRange(at, info.count)) return null
    let s = ''
    for (let i = 0; i < info.count; i += 1) {
      const c = view.getUint8(base + at + i)
      if (c === 0) break
      s += String.fromCharCode(c)
    }
    return s
  }

  const ifd0 = readIfd(u32(4))
  if (!ifd0) return null
  const pointer = ifd0.get(TAG_EXIF_IFD)
  if (!pointer || (pointer.type !== 4 && pointer.type !== 13)) return null // LONG / IFD
  const exif = readIfd(u32(pointer.entry + 8))
  if (!exif) return null
  return (
    parseExifDate(readAscii(exif.get(TAG_DATE_TIME_ORIGINAL))) ||
    parseExifDate(readAscii(exif.get(TAG_DATE_TIME_DIGITIZED)))
  )
}

// ---- JPEG：APP1（"Exif\0\0"）を探して、その中の TIFF を読む ----
async function dateFromJpeg(reader) {
  let offset = 2
  const limit = Math.min(reader.size, JPEG_SCAN_LIMIT)
  while (offset + 4 <= limit) {
    const head = await reader.at(offset, 4)
    if (!head) return null
    const { view, pos } = head
    if (view.getUint8(pos) !== 0xff) return null
    const marker = view.getUint8(pos + 1)
    if (marker === 0xff) {
      offset += 1 // 詰め物の 0xFF
      continue
    }
    if (marker === 0xda || marker === 0xd9) return null // 画像データの始まり／終わり（ここより後ろに EXIF は無い）
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2 // 長さを持たないマーカー
      continue
    }
    const length = view.getUint16(pos + 2)
    if (length < 2) return null
    if (marker === 0xe1 && length >= 16) {
      const seg = await reader.at(offset + 4, length - 2)
      if (!seg) return null
      const v = seg.view
      const p = seg.pos
      // "Exif\0\0"
      if (
        v.getUint32(p) === 0x45786966 &&
        v.getUint16(p + 4) === 0x0000
      ) {
        return dateFromTiff(v, p + 6, length - 8)
      }
    }
    offset += 2 + length
  }
  return null
}

// ---- HEIC / HEIF：ボックス構造から Exif アイテムの場所を探す ----
// ボックス1つ分：{ type, start(中身の開始位置), end }。壊れていれば null
function box(view, pos, limit) {
  if (pos + 8 > limit) return null
  let size = view.getUint32(pos)
  const type = fourCC(view, pos + 4)
  let header = 8
  if (size === 1) {
    if (pos + 16 > limit) return null
    const hi = view.getUint32(pos + 8)
    const lo = view.getUint32(pos + 12)
    if (hi > 0x1fffff) return null
    size = hi * 2 ** 32 + lo
    header = 16
  } else if (size === 0) {
    size = limit - pos // ファイルの終わりまで
  }
  if (size < header) return null
  return { type, start: pos + header, end: pos + size }
}

function childBoxes(view, from, to) {
  const list = []
  let pos = from
  while (pos + 8 <= to && list.length < 256) {
    const b = box(view, pos, to)
    if (!b || b.end > to) break
    list.push(b)
    pos = b.end
  }
  return list
}

// 可変長（0 / 4 / 8 バイト）の数値
function readSized(view, pos, size) {
  if (size === 0) return 0
  if (size === 4) return view.getUint32(pos)
  if (size === 8) {
    const hi = view.getUint32(pos)
    if (hi > 0x1fffff) return NaN
    return hi * 2 ** 32 + view.getUint32(pos + 4)
  }
  return NaN
}

// meta ボックスの中身から、Exif アイテムの { offset, length, inIdat } を返す（見つからなければ null）
export function findHeifExif(view, metaStart, metaEnd) {
  // meta は FullBox：先頭4バイトが version/flags
  const children = childBoxes(view, metaStart + 4, metaEnd)
  const iinf = children.find((b) => b.type === 'iinf')
  const iloc = children.find((b) => b.type === 'iloc')
  const idat = children.find((b) => b.type === 'idat')
  if (!iinf || !iloc) return null

  // iinf：アイテムの一覧から、種類が 'Exif' のアイテムの番号を探す
  const iinfVersion = view.getUint8(iinf.start)
  const entriesAt = iinf.start + 4 + (iinfVersion === 0 ? 2 : 4)
  let exifId = null
  for (const infe of childBoxes(view, entriesAt, iinf.end)) {
    if (infe.type !== 'infe') continue
    const v = view.getUint8(infe.start)
    if (v < 2) continue
    const idSize = v === 2 ? 2 : 4
    if (infe.start + 4 + idSize + 2 + 4 > infe.end) continue
    const id = idSize === 2 ? view.getUint16(infe.start + 4) : view.getUint32(infe.start + 4)
    const type = fourCC(view, infe.start + 4 + idSize + 2)
    if (type === 'Exif') {
      exifId = id
      break
    }
  }
  if (exifId === null) return null

  // iloc：アイテムの番号から、ファイル内の位置と長さを探す
  let p = iloc.start
  const end = iloc.end
  const version = view.getUint8(p)
  p += 4
  if (p + 2 > end) return null
  const sizes1 = view.getUint8(p)
  const sizes2 = view.getUint8(p + 1)
  p += 2
  const offsetSize = sizes1 >> 4
  const lengthSize = sizes1 & 0x0f
  const baseOffsetSize = sizes2 >> 4
  const indexSize = version === 1 || version === 2 ? sizes2 & 0x0f : 0
  let itemCount
  if (version < 2) {
    if (p + 2 > end) return null
    itemCount = view.getUint16(p)
    p += 2
  } else {
    if (p + 4 > end) return null
    itemCount = view.getUint32(p)
    p += 4
  }
  for (let i = 0; i < itemCount && i < 10000; i += 1) {
    const idSize = version < 2 ? 2 : 4
    if (p + idSize > end) return null
    const itemId = idSize === 2 ? view.getUint16(p) : view.getUint32(p)
    p += idSize
    let method = 0
    if (version === 1 || version === 2) {
      if (p + 2 > end) return null
      method = view.getUint16(p) & 0x0f
      p += 2
    }
    if (p + 2 + baseOffsetSize + 2 > end) return null
    p += 2 // data_reference_index
    const baseOffset = readSized(view, p, baseOffsetSize)
    p += baseOffsetSize
    const extentCount = view.getUint16(p)
    p += 2
    const extentBytes = indexSize + offsetSize + lengthSize
    if (p + extentCount * extentBytes > end) return null
    if (itemId === exifId) {
      if (extentCount < 1 || (method !== 0 && method !== 1)) return null
      const e = p + indexSize
      const extentOffset = readSized(view, e, offsetSize)
      const extentLength = readSized(view, e + offsetSize, lengthSize)
      if (!Number.isFinite(baseOffset) || !Number.isFinite(extentOffset) || !Number.isFinite(extentLength)) return null
      if (method === 1) {
        if (!idat) return null
        return { offset: idat.start + baseOffset + extentOffset, length: extentLength, inIdat: true }
      }
      return { offset: baseOffset + extentOffset, length: extentLength, inIdat: false }
    }
    p += extentCount * extentBytes
  }
  return null
}

// Exif アイテムの中身：先頭4バイト（ビッグエンディアン）が「TIFF までの距離」。その後ろに TIFF がある
export function dateFromHeifExifItem(view, pos, length) {
  if (length < 12) return null
  const skip = view.getUint32(pos)
  const tiffAt = pos + 4 + skip
  if (skip > length - 12) return null
  return dateFromTiff(view, tiffAt, length - 4 - skip)
}

async function dateFromHeif(reader) {
  // 先頭のボックスを順に見て、ftyp（種類）と meta を探す
  let offset = 0
  let checkedBrand = false
  for (let i = 0; i < 64 && offset + 8 <= reader.size; i += 1) {
    const head = await reader.at(offset, Math.min(16, reader.size - offset))
    if (!head) return null
    const b = box(head.view, head.pos, head.pos + (reader.size - offset))
    if (!b) return null
    const size = b.end - head.pos
    if (b.type === 'ftyp') {
      const body = await reader.at(offset, Math.min(size, 256))
      if (!body) return null
      const { view, pos } = body
      const brands = []
      for (let q = pos + 8; q + 4 <= pos + Math.min(size, 256); q += 4) {
        if (q === pos + 12) continue // minor_version
        brands.push(fourCC(view, q))
      }
      if (!brands.some((x) => HEIF_BRANDS.has(x))) return null
      checkedBrand = true
    } else if (b.type === 'meta') {
      if (!checkedBrand || size > META_LIMIT) return null
      const meta = await reader.at(offset, size)
      if (!meta) return null
      const headerLen = b.start - head.pos
      const found = findHeifExif(meta.view, meta.pos + headerLen, meta.pos + size)
      if (!found || found.length > EXIF_ITEM_LIMIT) return null
      const fileOffset = found.inIdat ? offset + (found.offset - meta.pos) : found.offset
      const item = await reader.at(fileOffset, found.length)
      if (!item) return null
      return dateFromHeifExifItem(item.view, item.pos, found.length)
    } else if (!checkedBrand) {
      return null // 先頭が ftyp でなければ HEIF ではない
    }
    offset += size
  }
  return null
}

// 写真ファイル（File / Blob）から撮影日を読む。読めなければ null。例外は投げない
export async function readShotDate(file) {
  try {
    if (!file || typeof file.slice !== 'function' || file.size < 12) return null
    const reader = createReader(file)
    const first = await reader.at(0, 12)
    if (!first) return null
    const { view, pos } = first
    if (view.getUint16(pos) === 0xffd8) return await dateFromJpeg(reader)
    if (fourCC(view, pos + 4) === 'ftyp') return await dateFromHeif(reader)
    return null
  } catch {
    return null
  }
}

// 同じファイルは1回だけ読む（再描画のたびに読み直さない）
const cache = new WeakMap()
export function shotDateOf(file) {
  if (!file || typeof file !== 'object') return Promise.resolve(null)
  let promise = cache.get(file)
  if (!promise) {
    promise = readShotDate(file)
    cache.set(file, promise)
  }
  return promise
}
