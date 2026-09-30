// 「旅」（Supabase の trips テーブル）の読み書き。
//   trips の1行：{ id(int8), user_id, title, created_at }
//   アプリ内の旅：{ id: '3', title: '京都旅行', createdAt }
// 旅の開始日・終了日は DB に持たない（旅に入っている記録の訪問日から、画面側で計算する → tripUtils.js）。
//
// supabase/trips.sql をまだ実行していない（trips テーブルが無い）ときは fetchTrips が失敗する。
// そのときアプリは「旅の機能なし」として、今まで通りに動く（RecordsContext の tripsReady = false）。

import { supabase } from './supabase'
import { cleanTripTitle } from './tripUtils'

const toTrip = (row) => ({ id: String(row.id), title: row.title, createdAt: row.created_at })

export async function fetchTrips() {
  const { data, error } = await supabase
    .from('trips')
    .select('id, title, created_at')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data.map(toTrip)
}

export async function createTrip(title) {
  const clean = cleanTripTitle(title)
  if (!clean) {
    const error = new Error('旅の名前を入力してください。')
    error.userMessage = error.message
    throw error
  }
  // user_id は DB の既定値（auth.uid()）で本人になる
  const { data, error } = await supabase.from('trips').insert({ title: clean }).select('id, title, created_at').single()
  if (error) {
    const wrapped = new Error('旅を作れませんでした。もう一度お試しください。', { cause: error })
    wrapped.userMessage = wrapped.message
    throw wrapped
  }
  return toTrip(data)
}
