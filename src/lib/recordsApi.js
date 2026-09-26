// データの読み書きをここにまとめています。
//
// 今はダミーデータを返すだけですが、あとで Supabase につなぐときは
// このファイルの中身だけを書き換えれば、画面側（pages / components）は
// ほとんど変更しなくて済みます。
//
// 例）Supabase にした場合:
//   export async function fetchRecords() {
//     const { data } = await supabase.from('records').select('*, photos(*)')
//     return data
//   }

import { DUMMY_RECORDS } from '../data/dummyRecords'
import { DEFAULT_TAGS } from '../data/tags'

// 通信しているように見せる、ほんの少しの待ち時間
const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchRecords() {
  await wait()
  return DUMMY_RECORDS
}

export async function fetchTags() {
  await wait()
  return DEFAULT_TAGS
}

// input: { placeName, prefectureId, visitedOn, photos, memo, tags }
export async function createRecord(input) {
  await wait()
  return { id: `r${Date.now()}`, ...input }
}

export async function createTag(name) {
  await wait(0)
  return name
}
