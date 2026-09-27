-- 各MY BESTを「最大5件（BEST 5）」にするための移行SQL。Supabase の SQL Editor に、そのまま貼り付けて Run してください。
--   ・前回の multiple_ranking_lists.sql を実行済みの状態から、そのままアップグレードできます。何度実行しても壊れません。
--   ・データは1件も削除・変更しません。すでに6件以上入っているリストがあっても、そのまま残ります
--     （そのリストは「追加」ができなくなるだけ。外す・並べ替えはできます。外して5件以下になれば、また追加できます）。
--   ・records テーブルには一切触れません。全体が1つのトランザクションなので、途中で失敗したら何も変わりません。
--   ・最後に「6件以上入っているリスト」の一覧を表示します（空なら該当なし）。

begin;

-- 1. 順位を 1,2,3… の詰まった番号に付け直す（外したあとの欠番をなくす）。ほかのリストには触れない
create or replace function public.compact_ranking_positions(p_list_id bigint)
returns void
language sql
security invoker
set search_path = public
as $$
  update record_rankings r
     set position = t.rn
    from (
      select id, row_number() over (order by position, id) as rn
        from record_rankings
       where list_id = p_list_id
    ) t
   where r.id = t.id and r.position <> t.rn;
$$;

-- 2. 5件を超える追加を、DB側で必ず止める（アプリの画面・RPC・直接の INSERT のどれからでも）。
--    追加の直前にリストの行をロックして、同時に追加されても6件目が入らないようにする（競合対策）。
--    すでに入っているデータには何もしない（新しく追加する／別のリストへ移すときだけ確認する）。
create or replace function public.enforce_ranking_list_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  if tg_op = 'UPDATE' and new.list_id is not distinct from old.list_id then
    return new;
  end if;
  perform 1 from ranking_lists where id = new.list_id for update;   -- 同じリストへの同時追加を、1つずつに直列化する
  select count(*) into v_count from record_rankings where list_id = new.list_id;
  if v_count >= 5 then
    raise exception 'BEST_FIVE_LIMIT' using detail = new.list_id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists record_rankings_limit on public.record_rankings;
create trigger record_rankings_limit
  before insert or update of list_id on public.record_rankings
  for each row execute function public.enforce_ranking_list_limit();

-- 3. 末尾に追加する：番号を詰め直してから、いまの件数 + 1 の順位で入れる（戻り値は入れた順位）。
--    6件目はトリガーが拒否／自分の記録・自分のリストだけ（RLS）／同じ記録の重複は unique 制約が拒否
create or replace function public.add_record_to_ranking(p_list_id bigint, p_record_id bigint)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_pos integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  perform 1 from ranking_lists where id = p_list_id and user_id = v_user for update;
  if not found then
    raise exception 'list not found';
  end if;
  perform public.compact_ranking_positions(p_list_id);
  select count(*) + 1 into v_pos from record_rankings where list_id = p_list_id;
  insert into record_rankings (list_id, record_id, position) values (p_list_id, p_record_id, v_pos);
  return v_pos;
end;
$$;

-- 4. 記録の編集画面用：1つの記録について、複数のリストへの追加と、リストからの取り外しを「まとめて1回」で行う。
--    1つでも失敗（満員など）したら、全体を取り消す（一部だけ反映されない）。先に外して枠を空けてから、追加する。
create or replace function public.set_record_ranking_lists(
  p_record_id bigint,
  p_add_list_ids bigint[],
  p_remove_list_ids bigint[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_list bigint;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from unnest(coalesce(p_add_list_ids, '{}')) a where a = any (coalesce(p_remove_list_ids, '{}'))) then
    raise exception 'same list in add and remove';
  end if;

  for v_list in select distinct x from unnest(coalesce(p_remove_list_ids, '{}')) as x order by x loop
    perform 1 from ranking_lists where id = v_list and user_id = v_user for update;
    if not found then
      raise exception 'list not found';
    end if;
    delete from record_rankings where list_id = v_list and record_id = p_record_id;   -- ランキングの行だけ。records には触れない
    perform public.compact_ranking_positions(v_list);
  end loop;

  for v_list in select distinct x from unnest(coalesce(p_add_list_ids, '{}')) as x order by x loop
    perform public.add_record_to_ranking(v_list, p_record_id);
  end loop;
end;
$$;

revoke all on function public.compact_ranking_positions(bigint) from public, anon;
revoke all on function public.add_record_to_ranking(bigint, bigint) from public, anon;
revoke all on function public.set_record_ranking_lists(bigint, bigint[], bigint[]) from public, anon;
grant execute on function public.compact_ranking_positions(bigint) to authenticated;
grant execute on function public.add_record_to_ranking(bigint, bigint) to authenticated;
grant execute on function public.set_record_ranking_lists(bigint, bigint[], bigint[]) to authenticated;

commit;

-- 確認：6件以上入っているリスト（何も削除していません。空なら該当なし）
select l.id as list_id, l.user_id, l.title, count(*) as places
  from public.ranking_lists l
  join public.record_rankings r on r.list_id = l.id
 group by l.id, l.user_id, l.title
having count(*) > 5
 order by places desc;
