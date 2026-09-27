-- MY BEST を「複数のリスト」にするための移行SQL。Supabase の SQL Editor に、そのまま貼り付けて Run してください。
--   ・前回の record_rankings（テーブル）と reorder_record_rankings（関数）がある状態から、安全にアップグレードします。
--   ・まだ無い状態（新規）から実行しても動きます。何度実行しても壊れません。
--   ・既存のランキングは消しません。各ユーザーに「MY BEST」というリストを作り、いまの順位のまま紐付けます。
--   ・records テーブルには一切触れません。全体が1つのトランザクションなので、途中で失敗したら何も変わりません。

begin;

-- 1. ランキングリスト（親）
create table if not exists public.ranking_lists (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  title       text        not null check (char_length(btrim(title)) between 1 and 60),
  created_at  timestamptz not null default now()
);

alter table public.ranking_lists enable row level security;

drop policy if exists "ranking_lists_select_own" on public.ranking_lists;
drop policy if exists "ranking_lists_insert_own" on public.ranking_lists;
drop policy if exists "ranking_lists_update_own" on public.ranking_lists;
drop policy if exists "ranking_lists_delete_own" on public.ranking_lists;

create policy "ranking_lists_select_own" on public.ranking_lists
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ranking_lists_insert_own" on public.ranking_lists
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "ranking_lists_update_own" on public.ranking_lists
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "ranking_lists_delete_own" on public.ranking_lists
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.ranking_lists from anon;
grant select, insert, update, delete on public.ranking_lists to authenticated;

-- 2. record_rankings（子）：前回のテーブルが無いときだけ作る。あるときは list_id の列を足すだけ（データはそのまま）
create table if not exists public.record_rankings (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  record_id   bigint      not null references public.records (id) on delete cascade,
  position    integer     not null check (position > 0),
  created_at  timestamptz not null default now()
);
alter table public.record_rankings enable row level security;

alter table public.record_rankings
  add column if not exists list_id bigint references public.ranking_lists (id) on delete cascade;

-- 3. 既存のランキング（list_id がまだ無い行）を、各ユーザーの「MY BEST」リストへ紐付ける（順位はそのまま）
do $$
declare
  u uuid;
  new_list bigint;
begin
  for u in select distinct user_id from public.record_rankings where list_id is null loop
    insert into public.ranking_lists (user_id, title) values (u, 'MY BEST') returning id into new_list;
    update public.record_rankings set list_id = new_list where user_id = u and list_id is null;
  end loop;
end $$;

alter table public.record_rankings alter column list_id set not null;

-- 4. 制約を「ユーザー単位」から「リスト単位」へ（同じリストの中で、同じ記録は1回・順位は重複なし）
alter table public.record_rankings drop constraint if exists record_rankings_user_record_key;
alter table public.record_rankings drop constraint if exists record_rankings_user_position_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'record_rankings_list_record_key') then
    alter table public.record_rankings
      add constraint record_rankings_list_record_key unique (list_id, record_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'record_rankings_list_position_key') then
    -- 入れ替えの途中で一時的に重なっても、処理の最後に確認する（deferred）
    alter table public.record_rankings
      add constraint record_rankings_list_position_key unique (list_id, position) deferrable initially deferred;
  end if;
end $$;

create index if not exists record_rankings_list_id_idx on public.record_rankings (list_id);

-- 5. RLS：自分のデータだけ。追加・更新できるのは「自分のリスト」に「自分の記録」を入れるときだけ
drop policy if exists "record_rankings_select_own" on public.record_rankings;
drop policy if exists "record_rankings_insert_own" on public.record_rankings;
drop policy if exists "record_rankings_update_own" on public.record_rankings;
drop policy if exists "record_rankings_delete_own" on public.record_rankings;

create policy "record_rankings_select_own" on public.record_rankings
  for select to authenticated using (user_id = (select auth.uid()));

create policy "record_rankings_insert_own" on public.record_rankings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.ranking_lists l where l.id = list_id and l.user_id = (select auth.uid()))
    and exists (select 1 from public.records r where r.id = record_id and r.user_id = (select auth.uid()))
  );

create policy "record_rankings_update_own" on public.record_rankings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.ranking_lists l where l.id = list_id and l.user_id = (select auth.uid()))
    and exists (select 1 from public.records r where r.id = record_id and r.user_id = (select auth.uid()))
  );

create policy "record_rankings_delete_own" on public.record_rankings
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.record_rankings from anon;
grant select, insert, update, delete on public.record_rankings to authenticated;

-- 6. 並べ替え：リスト単位。新しい並び順（そのリストの record_id の配列）を渡すと、1 から順に付け直す。
--    ほかのリストの順位には影響しません。渡した一覧が、そのリストの全件と過不足なく一致しないときは、何も変えずにエラー。
drop function if exists public.reorder_record_rankings(bigint[]);   -- 前回の（リストを区別しない）関数
drop function if exists public.reorder_record_rankings(bigint, bigint[]);

create function public.reorder_record_rankings(p_list_id bigint, p_record_ids bigint[])
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
  if not exists (select 1 from ranking_lists where id = p_list_id and user_id = v_user) then
    raise exception 'list not found';
  end if;
  select count(*) into v_count from record_rankings where list_id = p_list_id and user_id = v_user;
  if coalesce(array_length(p_record_ids, 1), 0) <> v_count
     or (select count(distinct x) from unnest(p_record_ids) as x) <> v_count
     or exists (
       select 1 from unnest(p_record_ids) as x
       where x not in (select record_id from record_rankings where list_id = p_list_id and user_id = v_user)
     ) then
    raise exception 'ranking list does not match';
  end if;

  update record_rankings r
     set position = t.ord
    from unnest(p_record_ids) with ordinality as t(rid, ord)
   where r.list_id = p_list_id and r.user_id = v_user and r.record_id = t.rid;
end;
$$;

revoke all on function public.reorder_record_rankings(bigint, bigint[]) from public, anon;
grant execute on function public.reorder_record_rankings(bigint, bigint[]) to authenticated;

commit;
