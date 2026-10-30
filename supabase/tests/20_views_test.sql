\set ON_ERROR_STOP on
-- Runs after 10_register_test.sql in the same database.
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'CHECK FAILED: %', what; end if;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

set role anon;
select set_config('request.jwt.claims', '{}', false);
do $$ begin
  perform 1 from public.register_view limit 1;
  raise exception 'anon could read register_view';
exception when insufficient_privilege then null; end $$;
reset role;

-- Without two-factor, the view is empty (security invoker keeps RLS)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","aal":"aal1","role":"authenticated"}', false);
set role authenticated;
select pg_temp.check((select count(*) from public.register_view) = 0, 'aal1 sees nothing in the view');
select pg_temp.check((public.register_stats() ->> 'total')::int = 0, 'aal1 stats are zero');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","aal":"aal2","role":"authenticated"}', false);
set role authenticated;
select pg_temp.check((select count(*) from public.register_view) = (select (public.register_stats() ->> 'total')::int), 'view and stats agree');
select pg_temp.check((select count(*) from public.register_view where faculty_name is null or programme_name is null) = 0, 'every row has faculty and programme');
select pg_temp.check(jsonb_array_length(public.register_stats() -> 'by_faculty') > 0, 'stats by faculty');
select pg_temp.check((public.register_stats() ->> 'legacy_unverified')::int > 0, 'legacy unverified counted');
reset role;
select 'VIEW TESTS PASSED' as result;
