-- 「旅」機能のためのSQL。Supabase の SQL Editor に、そのまま貼り付けて Run してください。
--   ・trips（旅）テーブルを作り、records に trip_id（どの旅に入っているか）の列を足します。
--   ・既存の記録（records の行）は消しません・書き換えません。すべて trip_id = null（旅に入っていない）のままです。
--   ・旅を削除しても、記録は削除されません（その記録の trip_id が null に戻るだけ）。
--   ・旅の開始日・終了日は保存しません（アプリが、旅に入っている記録の訪問日から計算して表示します）。
--   ・何度実行しても壊れません。全体が1つのトランザクションなので、途中で失敗したら何も変わりません。
--
-- 前提：records テーブルに id（bigint）と user_id（uuid）の列があること（今のアプリの構成どおり）。

begin;

-- 1. 旅（trips）
create table if not exists public.trips (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  title       text        not null check (char_length(btrim(title)) between 1 and 60),
  created_at  timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips (user_id);

-- 2. RLS：ログインしている本人の旅だけを、見る・作る・変える・消すことができる
alter table public.trips enable row level security;

drop policy if exists "trips_select_own" on public.trips;
drop policy if exists "trips_insert_own" on public.trips;
drop policy if exists "trips_update_own" on public.trips;
drop policy if exists "trips_delete_own" on public.trips;

create policy "trips_select_own" on public.trips
  for select to authenticated using (user_id = (select auth.uid()));
create policy "trips_insert_own" on public.trips
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "trips_update_own" on public.trips
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "trips_delete_own" on public.trips
  for delete to authenticated using (user_id = (select auth.uid()));

-- ログインしていない人（anon）からは、一切触れない
revoke all on public.trips from anon;
grant select, insert, update, delete on public.trips to authenticated;

-- 3. records に trip_id を追加（null = 旅に入っていない。既存の記録はすべて null のまま）
alter table public.records add column if not exists trip_id bigint;

-- 旅を削除したら、その旅に入っていた記録の trip_id を null に戻す（記録そのものは消さない）
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'records_trip_id_fkey') then
    alter table public.records
      add constraint records_trip_id_fkey
      foreign key (trip_id) references public.trips (id) on delete set null;
  end if;
end $$;

-- 旅ごとの記録を探す・旅の削除時に null へ戻す処理を速くする
create index if not exists records_trip_id_idx on public.records (trip_id);

-- 4. 安全対策：記録は「その記録の持ち主と同じ人の旅」にしか入れられない
--    （他の人の旅の id を指定されても、保存を拒否する。RLS の設定に関係なく、DB が必ず確かめる）
create or replace function public.records_check_trip_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.trip_id is not null and not exists (
    select 1 from public.trips t where t.id = new.trip_id and t.user_id = new.user_id
  ) then
    raise exception 'trip not found' using errcode = '23503';
  end if;
  return new;
end;
$$;

-- この関数は、下のトリガーからだけ使う（アプリや anon から直接呼べないようにする）
revoke all on function public.records_check_trip_owner() from public, anon, authenticated;

drop trigger if exists records_check_trip_owner on public.records;
create trigger records_check_trip_owner
  before insert or update of trip_id, user_id on public.records
  for each row execute function public.records_check_trip_owner();

commit;

-- ────────────────────────────────────────────────
-- 実行後の確認用（必要なら、1つずつ実行してください。どれもデータは変えません）
--
-- ・trip_id の列ができているか（既存の記録は、すべて null のはず）
--     select count(*) as 記録の数, count(trip_id) as 旅に入っている数 from public.records;
--
-- ・trips の RLS が有効か（true のはず）
--     select relrowsecurity from pg_class where oid = 'public.trips'::regclass;
--
-- ・外部キーが「削除時は null に戻す（n）」になっているか（confdeltype = 'n' のはず）
--     select conname, confdeltype from pg_constraint where conname = 'records_trip_id_fkey';
-- ────────────────────────────────────────────────
