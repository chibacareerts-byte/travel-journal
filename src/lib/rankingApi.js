// MY BEST（手動ランキング）の読み書き。Supabase の ranking_lists（リスト）と record_rankings（各リストの順位）とのやり取りだけをまとめています。
// ランキングは「どのリストの、どの記録が何位か」だけを持ち、記録の内容（場所・写真など）は records から使います（複製しません）。
//   リスト   : { id: '3', title: '禅寺 BEST', count: 8 }
//   ランキング: { recordId: '12', position: 1 } の並び（position の小さい順）
// 同じ記録を、複数のリストに入れられます。同じリストの中では、同じ記録は1回・順位は重複しません（DB の制約）。
// テーブルの作り方は supabase/multiple_ranking_lists.sql を参照。RLS で、自分のリスト・自分の順位にしか触れません。

import { supabase } from './supabase'

export const TITLE_MAX = 60 // DB の check 制約（1〜60文字）と同じ
export const BEST_MAX = 5 // 1つのリストに入れられる記録の数（BEST 5）。DB のトリガーも同じ数で止める（画面を迂回しても6件目は入らない）

function rankingError(userMessage, cause) {
  const error = new Error(userMessage, { cause })
  error.userMessage = userMessage
  return error
}

// 空白だけ・長すぎるタイトルは、通信する前に弾く
function cleanTitle(title) {
  const clean = String(title ?? '').trim()
  if (!clean) throw rankingError('タイトルを入力してください。')
  if (clean.length > TITLE_MAX) throw rankingError(`タイトルは${TITLE_MAX}文字までです。`)
  return clean
}

// DB が「5件を超える追加」を止めたときのエラー（メッセージに BEST_FIVE_LIMIT、details に満員のリストの id が入る）
function limitError(cause) {
  const error = rankingError(`このリストは${BEST_MAX}件で満員です。`, cause)
  error.limit = true
  error.fullListId = cause && cause.details ? String(cause.details) : null
  return error
}
const isLimit = (cause) => !!cause && typeof cause.message === 'string' && cause.message.includes('BEST_FIVE_LIMIT')

// ---- リスト ----

// 自分のリストを、作った順に取得する（count は、そのリストに入っている記録の数）
export async function fetchLists() {
  const { data, error } = await supabase
    .from('ranking_lists')
    .select('id, title, created_at, record_rankings(count)')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data.map((row) => ({
    id: String(row.id),
    title: row.title,
    count: (row.record_rankings && row.record_rankings[0] && row.record_rankings[0].count) || 0,
  }))
}

// 1つのリスト。見つからない（他人のリスト・削除済み）ときは null
export async function fetchList(listId) {
  const { data, error } = await supabase.from('ranking_lists').select('id, title').eq('id', Number(listId)).maybeSingle()
  if (error) throw error
  return data ? { id: String(data.id), title: data.title } : null
}

export async function createList(title) {
  const clean = cleanTitle(title)
  const { data, error } = await supabase.from('ranking_lists').insert({ title: clean }).select('id, title').single()
  if (error) throw rankingError('リストを作れませんでした。もう一度お試しください。', error)
  return { id: String(data.id), title: data.title, count: 0 }
}

export async function renameList(listId, title) {
  const clean = cleanTitle(title)
  const { data, error } = await supabase
    .from('ranking_lists')
    .update({ title: clean })
    .eq('id', Number(listId))
    .select('id, title')
  if (error) throw rankingError('タイトルを変更できませんでした。もう一度お試しください。', error)
  if (!data || data.length === 0) throw rankingError('タイトルを変更できませんでした。リストが見つかりません。')
  return data[0].title
}

// リストを削除する。そのリストの順位（record_rankings）だけが一緒に消え、旅行記録（records）には触れない
export async function deleteList(listId) {
  const { data, error } = await supabase.from('ranking_lists').delete().eq('id', Number(listId)).select('id')
  if (error) throw rankingError('リストを削除できませんでした。もう一度お試しください。', error)
  if (!data || data.length === 0) throw rankingError('リストを削除できませんでした。すでに削除されている可能性があります。')
}

// ---- リストの中の順位 ----

// そのリストの順位を、順位の順に取得する
export async function fetchRankings(listId) {
  const { data, error } = await supabase
    .from('record_rankings')
    .select('record_id, position')
    .eq('list_id', Number(listId))
    .order('position', { ascending: true })
  if (error) throw error
  return data.map((row) => ({ recordId: String(row.record_id), position: row.position }))
}

// 末尾に追加する。順位（いまの最後尾）は DB 側が決める。同じリストに同じ記録は重複登録できず、6件目は DB が拒否する
export async function addRanking(listId, recordId) {
  const { error } = await supabase.rpc('add_record_to_ranking', {
    p_list_id: Number(listId),
    p_record_id: Number(recordId),
  })
  if (error) {
    if (isLimit(error)) throw limitError(error)
    if (error.code === '23505') throw rankingError('すでにこのリストに入っています。', error) // unique 違反
    throw rankingError('MY BESTに追加できませんでした。もう一度お試しください。', error)
  }
}

// このリストから外す（ランキングの行だけを消す。記録本体・ほかのリストには触れない）
export async function removeRanking(listId, recordId) {
  const { error } = await supabase
    .from('record_rankings')
    .delete()
    .eq('list_id', Number(listId))
    .eq('record_id', Number(recordId))
  if (error) throw rankingError('MY BESTから外せませんでした。もう一度お試しください。', error)
}

// 並び順を保存する。そのリストの recordId を新しい順番ですべて渡すと、サーバー側が1回の処理で 1,2,3… を付け直す
// （ほかのリストの順位には影響しない）
export async function reorderRankings(listId, recordIds) {
  const { error } = await supabase.rpc('reorder_record_rankings', {
    p_list_id: Number(listId),
    p_record_ids: recordIds.map(Number),
  })
  if (error) throw rankingError('順位を変更できませんでした。もう一度お試しください。', error)
}

// ---- 記録の編集画面から ----

// この記録が入っているリストの id の一覧
export async function fetchRecordListIds(recordId) {
  const { data, error } = await supabase.from('record_rankings').select('list_id').eq('record_id', Number(recordId))
  if (error) throw error
  return data.map((row) => String(row.list_id))
}

// この記録について、複数のリストへの追加と取り外しを「まとめて1回」で保存する（DB 側で1つのトランザクション。
// 1つでも失敗したら全体が取り消され、一部だけ反映されることはない）。records 本体には触れない
export async function setRecordLists(recordId, addListIds, removeListIds) {
  const { error } = await supabase.rpc('set_record_ranking_lists', {
    p_record_id: Number(recordId),
    p_add_list_ids: addListIds.map(Number),
    p_remove_list_ids: removeListIds.map(Number),
  })
  if (error) {
    if (isLimit(error)) throw limitError(error)
    throw rankingError('MY BESTを更新できませんでした。', error)
  }
}
