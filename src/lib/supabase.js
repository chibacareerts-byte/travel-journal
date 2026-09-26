// Supabase への接続設定。
// 接続先の URL と公開用キー（publishable key）は、プロジェクト直下の .env.local から読み込みます。
// ※ secret key / service_role key は、ブラウザで動くこのアプリでは絶対に使いません。
//
// 使うときは、必要な場所で次のように読み込みます。
//   import { supabase } from './supabase'
// 今はまだ、認証・データ取得・保存・写真の保存には使っていません。

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
