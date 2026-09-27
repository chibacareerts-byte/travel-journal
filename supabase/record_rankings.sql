-- MY BEST（手動ランキング）用のテーブルと関数。Supabase の SQL Editor に、そのまま貼り付けて Run してください。
-- 何度実行しても壊れないように書いてあります（既存の records テーブルには一切触れません）。

-- 1. テーブル：ランキングは「どの記録が何位か」だけを持つ（記録の内容は複製しない）
create table if not exists public.record_rankings (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  record_id   bigint      not null references public.records (id) on delete cascade, -- 記録が削除されたら、ランキングからも自動で外れる
  position    integer     not null check (position > 0),
  created_at  timestamptz not null default now(),
  -- 同じ記録は、1人につき1回だけ
  constraint record_rankings_user_record_key unique (user_id, record_id),
  -- 順位も、1人につき重複しない。入れ替えの途中で一時的に重なっても、処理の最後に確認する（deferred）
  constraint record_rankings_user_position_key unique (user_id, position) deferrable initially deferred
);

-- 2. RLS：自分のランキングだけ、見る・追加・更新・削除ができる
alter table public.record_rankings enable row level security;

drop policy if exists "record_rankings_select_own" on public.record_rankings;
drop policy if exists "record_rankings_insert_own" on public.record_rankings;
drop policy if exists "record_rankings_update_own" on public.record_rankings;
drop policy if exists "record_rankings_delete_own" on public.record_rankings;

create policy "record_rankings_select_own" on public.record_rankings
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 追加できるのは「自分の記録」だけ（他人の記録の id を指すランキングは作れない）
create policy "record_rankings_insert_own" on public.record_rankings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.records r where r.id = record_id and r.user_id = (select auth.uid()))
  );

create policy "record_rankings_update_own" on public.record_rankings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.records r where r.id = record_id and r.user_id = (select auth.uid()))
  );

create policy "record_rankings_delete_own" on public.record_rankings
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ログインしていない人（anon）には、何も許可しない
revoke all on public.record_rankings from anon;
grant select, insert, update, delete on public.record_rankings to authenticated;

-- 3. 順位の並べ替え：新しい並び順（record_id の配列）を渡すと、1 から順に position を付け直す。
--    1回の呼び出し＝1つのトランザクションなので、途中で失敗したら何も変わらない（画面だけ順位が変わることもない）。
--    渡された一覧が、自分のランキング全件と過不足なく一致しないときは、何も変えずにエラーにする。
create or replace function public.reorder_record_rankings(p_record_ids bigint[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  select count(*) into v_count from record_rankings where user_id = v_user;
  if coalesce(array_length(p_record_ids, 1), 0) <> v_count
     or (select count(distinct x) from unnest(p_record_ids) as x) <> v_count
     or exists (
       select 1 from unnest(p_record_ids) as x
       where x not in (select record_id from record_rankings where user_id = v_user)
     ) then
    raise exception 'ranking list does not match';
  end if;

  update record_rankings r
     set position = t.ord
    from unnest(p_record_ids) with ordinality as t(rid, ord)
   where r.user_id = v_user and r.record_id = t.rid;
end;
$$;

revoke all on function public.reorder_record_rankings(bigint[]) from public, anon;
grant execute on function public.reorder_record_rankings(bigint[]) to authenticated;
