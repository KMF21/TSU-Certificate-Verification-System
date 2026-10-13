\set ON_ERROR_STOP on
-- Runs after 10_workflow_test.sql in the same database.
create function pg_temp.act_as(uid text, aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.expect_error(sql text, fragment text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected an error containing "%" but the statement succeeded', fragment;
exception when others then
  if sqlerrm not like '%' || fragment || '%' then raise exception 'expected "%", got "%"', fragment, sqlerrm; end if;
end $$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect_error($$select public.import_reference_rows('[{}]')$$, 'Only a Super Admin');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.import_reference_rows('[
  {"faculty_code":"FSC","faculty_name":"Faculty of Science","department_code":"MTH","department_name":"Department of Mathematics","programme_code":"BSC-MTH","programme_name":"Mathematics","award_title":"Bachelor of Science (B.Sc.)","award_level":"undergraduate"},
  {"faculty_code":"FSC","faculty_name":"Faculty of Science","department_code":"MTH","department_name":"Department of Mathematics","programme_code":"MSC-MTH","programme_name":"Mathematics","award_title":"Master of Science (M.Sc.)","award_level":"postgraduate"}
]');
select pg_temp.expect_error($$select public.import_reference_rows('[{"faculty_code":"FSC","faculty_name":"Faculty of Science","department_code":"PHY","department_name":"Department of Physics","programme_code":"BSC-PHY","programme_name":"Physics","award_title":"Bachelor of Science (B.Sc.)","award_level":"diploma"}]')$$, 'level must be');
do $$ begin if (select count(*) from public.programmes where code like '%-MTH') <> 2 then raise exception 'reference import'; end if;
  if exists (select 1 from public.departments where code = 'PHY') then raise exception 'failed import left rows'; end if; end $$;

-- Issued programme is frozen, both through the function and through import
select pg_temp.expect_error($$select public.save_programme((select id from public.programmes where code='BSC-CSC'), (select department_id from public.programmes where code='BSC-CSC'), 'BSC-CSC', 'Computer Sciences', 'Bachelor of Science (B.Sc.)', 'undergraduate')$$, 'cannot change');
select pg_temp.expect_error($$select public.import_reference_rows('[{"faculty_code":"FCAI","faculty_name":"Faculty of Computing and Artificial Intelligence","department_code":"CSC","department_name":"Department of Computer Science","programme_code":"BSC-CSC","programme_name":"Computing","award_title":"Bachelor of Science (B.Sc.)","award_level":"undergraduate"}]')$$, 'cannot change');
reset role;
select 'REFERENCE TESTS PASSED' as result;

-- Staff accounts
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'new@tsu.test');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
select pg_temp.expect_error($$select public.save_staff_profile('00000000-0000-0000-0000-0000000000b1', 'New Person', 'new@tsu.test', 'registrar')$$, 'Only a Super Admin');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.save_staff_profile('00000000-0000-0000-0000-0000000000b1', 'New Person', 'NEW@tsu.test', 'records_officer');
select pg_temp.expect_error($$select public.save_staff_profile('00000000-0000-0000-0000-0000000000a1', 'Super Admin', 'admin@tsu.test', 'auditor')$$, 'own Super Admin');
select pg_temp.expect_error($$select public.save_staff_profile(gen_random_uuid(), 'Ghost', 'g@tsu.test', 'auditor')$$, 'No sign-in account');
reset role;
do $$ begin
  if (select email from public.profiles where user_id = '00000000-0000-0000-0000-0000000000b1') <> 'new@tsu.test' then raise exception 'profile not saved'; end if;
  if not exists (select 1 from public.audit_log where table_name = 'profiles' and actor_id = '00000000-0000-0000-0000-0000000000a1') then raise exception 'profile change not audited'; end if;
end $$;
select 'STAFF TESTS PASSED' as result;
