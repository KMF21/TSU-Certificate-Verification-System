-- Workflow and security tests for the core register. Run on a scratch database
-- after 00_supabase_stub.sql and the migrations. Any failed check raises an exception.
\set ON_ERROR_STOP on

-- Users
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@tsu.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'records@tsu.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'cpgs@tsu.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'registrar@tsu.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'auditor@tsu.test');
insert into public.profiles (user_id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Super Admin', 'admin@tsu.test', 'super_admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'Records Officer', 'records@tsu.test', 'records_officer'),
  ('00000000-0000-0000-0000-0000000000a3', 'CPGS Officer', 'cpgs@tsu.test', 'cpgs_records_officer'),
  ('00000000-0000-0000-0000-0000000000a4', 'The Registrar', 'registrar@tsu.test', 'registrar'),
  ('00000000-0000-0000-0000-0000000000a5', 'Auditor', 'auditor@tsu.test', 'auditor');

create function pg_temp.act_as(uid text, aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.expect_error(sql text, fragment text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected an error containing "%" but the statement succeeded: %', fragment, sql;
exception when others then
  if sqlerrm not like '%' || fragment || '%' then
    raise exception 'expected error containing "%", got "%"', fragment, sqlerrm;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to authenticated, anon;

-- Reference data: only Super Admin at aal2
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select pg_temp.expect_error($$select public.save_faculty(null, 'SCI', 'Faculty of Science')$$, 'Only a Super Admin');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.save_faculty(null, 'FCAI', 'Faculty of Computing and Artificial Intelligence');
select public.save_faculty(null, 'FSS', 'Faculty of Social Sciences');
select public.save_department(null, (select id from public.faculties where code = 'FCAI'), 'CSC', 'Department of Computer Science');
select public.save_department(null, (select id from public.faculties where code = 'FSS'), 'GEO', 'Department of Geography');
select public.save_programme(null, (select id from public.departments where code = 'CSC'), 'BSC-CSC', 'Computer Science', 'Bachelor of Science (B.Sc.)', 'undergraduate');
select public.save_programme(null, (select id from public.departments where code = 'GEO'), 'MSC-ERM', 'Environmental Resource Management', 'Master of Science (M.Sc.)', 'postgraduate');
select pg_temp.expect_error($$select public.create_batch('x batch', 'undergraduate', '2024/2025')$$, 'cannot create');
reset role;

-- Records Officer: no direct table writes
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect_error($$insert into public.graduates (surname, other_names, matric_no) values ('A','B','TSU/1/2')$$, 'permission denied');
select pg_temp.expect_error($$update public.batches set status = 'approved'$$, 'permission denied');
select pg_temp.expect_error($$select public.create_batch('PG batch', 'postgraduate', '2024/2025')$$, 'cannot create postgraduate');

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
insert into ids values ('ug', public.create_batch('2024/2025 Convocation, Faculty of Computing', 'undergraduate', '2024/2025'));

-- A bad row aborts the whole import
select pg_temp.expect_error(format($$select public.import_batch_rows(%L, %L)$$, (select v from ids where k='ug'),
  '[{"surname":"Ibrahim","other_names":"Aisha Ladi","matric_no":"TSU/19/CSC/1045","programme_code":"BSC-CSC","class_of_degree":"First Class Honours","date_of_award":"2025-11-20"},
    {"surname":"Okoro","other_names":"Chidi","matric_no":"TSU/19/CSC/1046","programme_code":"NOPE","class_of_degree":"Pass","date_of_award":"2025-11-20"}]'), 'Row 2: programme code');
select pg_temp.expect_error(format($$select public.import_batch_rows(%L, %L)$$, (select v from ids where k='ug'),
  '[{"surname":"Okoro","other_names":"Chidi","matric_no":"TSU/19/CSC/1046","programme_code":"BSC-CSC","date_of_award":"2025-11-20"}]'), 'class of degree is required');
select pg_temp.expect_error(format($$select public.import_batch_rows(%L, %L)$$, (select v from ids where k='ug'),
  '[{"surname":"Okoro","other_names":"Chidi","matric_no":"TSU/19/GEO/1046","programme_code":"MSC-ERM","date_of_award":"2025-11-20"}]'), 'is postgraduate but this batch is undergraduate');
do $$ begin if (select count(*) from public.graduates) <> 0 then raise exception 'failed import left rows behind'; end if; end $$;

select public.import_batch_rows((select v from ids where k='ug'),
  '[{"surname":"Ibrahim","other_names":"Aisha Ladi","matric_no":"tsu/19/csc/1045","programme_code":"bsc-csc","class_of_degree":"First Class Honours","date_of_award":"2025-11-20"},
    {"surname":"Okoro","other_names":"Chidi Emeka","matric_no":"TSU/19/CSC/1046","programme_code":"BSC-CSC","class_of_degree":"Second Class Honours (Upper Division)","date_of_award":"2025-11-20","email":"chidi@example.com"}]');
-- Same award twice is refused; a different name on a known matric is refused
select pg_temp.expect_error(format($$select public.import_batch_rows(%L, %L)$$, (select v from ids where k='ug'),
  '[{"surname":"Ibrahim","other_names":"Aisha Ladi","matric_no":"TSU/19/CSC/1045","programme_code":"BSC-CSC","class_of_degree":"Pass","date_of_award":"2025-11-20"}]'), 'already has a');
select pg_temp.expect_error(format($$select public.import_batch_rows(%L, %L)$$, (select v from ids where k='ug'),
  '[{"surname":"Someone","other_names":"Else","matric_no":"TSU/19/CSC/1045","programme_code":"BSC-CSC","class_of_degree":"Pass","date_of_award":"2025-11-20"}]'), 'already registered to IBRAHIM');

select public.submit_batch((select v from ids where k='ug'));
select pg_temp.expect_error(format($$select public.import_batch_rows(%L, '[{}]')$$, (select v from ids where k='ug')), 'Only draft or rejected');
reset role;

-- Records Officer cannot approve; Registrar must
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect_error(format($$select public.approve_batch(%L, 'k1')$$, (select v from ids where k='ug')), 'Only the Registrar');
reset role;

-- Registrar rejects, officer fixes and resubmits, Registrar approves
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
select pg_temp.expect_error(format($$select public.reject_batch(%L, 'no')$$, (select v from ids where k='ug')), 'Give a reason');
select public.reject_batch((select v from ids where k='ug'), 'Check the class for Okoro against the Senate list');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select public.remove_draft_credential((select c.id from public.credentials c join public.graduates g on g.id = c.graduate_id where g.surname = 'Okoro'));
select public.import_batch_rows((select v from ids where k='ug'),
  '[{"surname":"Okoro","other_names":"Chidi Emeka","matric_no":"TSU/19/CSC/1046","programme_code":"BSC-CSC","class_of_degree":"Second Class Honours (Lower Division)","date_of_award":"2025-11-20"}]');
select public.submit_batch((select v from ids where k='ug'));
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
select pg_temp.expect_error(format($$select public.approve_batch(%L, '')$$, (select v from ids where k='ug')), 'signing key id');
do $$ begin if (select public.approve_batch((select v from ids where k='ug'), 'tsu-2026-1')) <> 2 then raise exception 'approve count'; end if; end $$;
reset role;

do $$
begin
  if (select count(*) from public.credentials where status = 'approved' and serial_no ~ '^TSU/2025/0000\d\d$' and verify_code ~ '^[a-z2-9]{16}$' and key_id = 'tsu-2026-1') <> 2 then
    raise exception 'approved credentials missing identity';
  end if;
  if (select serial_no from public.credentials c join public.graduates g on g.id = c.graduate_id where g.surname = 'Ibrahim') <> 'TSU/2025/000001' then
    raise exception 'serials not issued in name order';
  end if;
end $$;

-- Postgraduate: separate officer and serial series; submitter cannot approve own batch
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
insert into ids values ('pg', public.create_batch('2023/2024 CPGS Convocation', 'postgraduate', '2023/2024'));
select public.import_batch_rows((select v from ids where k='pg'),
  '[{"surname":"Bako","other_names":"Emmanuel Tanko","matric_no":"TSU/PG/21/GEO/0112","programme_code":"MSC-ERM","date_of_award":"2024-12-12"}]');
select public.submit_batch((select v from ids where k='pg'));
reset role;
-- make the registrar the submitter to prove the maker-checker rule
update public.batches set submitted_by = '00000000-0000-0000-0000-0000000000a4' where id = (select v from ids where k='pg');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
select pg_temp.expect_error(format($$select public.approve_batch(%L, 'tsu-2026-1')$$, (select v from ids where k='pg')), 'someone else must approve');
reset role;
update public.batches set submitted_by = '00000000-0000-0000-0000-0000000000a3' where id = (select v from ids where k='pg');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
select public.approve_batch((select v from ids where k='pg'), 'tsu-2026-1');
reset role;

-- Public lookups as anon
set role anon;
select set_config('request.jwt.claims', '{}', false);
select pg_temp.expect_error($$select * from public.credentials$$, 'permission denied');
select pg_temp.expect_error($$select * from public.graduates$$, 'permission denied');
select pg_temp.expect_error($$select * from private.public_credentials$$, 'permission denied');
select pg_temp.expect_error($$select public.submit_batch(gen_random_uuid())$$, 'permission denied');
do $$
declare r record;
begin
  select * into r from public.verify_by_serial_and_matric('tsu/pg/2024/000001', ' TSU/PG/21/GEO/0112 ');
  if r.full_name <> 'BAKO, Emmanuel Tanko' or r.matric_masked <> 'TSU/PG/21/•••/••12' or r.status <> 'approved' or r.class_of_degree is not null then
    raise exception 'public serial+matric lookup wrong: %', row_to_json(r);
  end if;
  if not exists (select 1 from public.verify_by_code(r.verify_code)) then raise exception 'lookup by code failed'; end if;
  if exists (select 1 from public.verify_by_serial_and_matric('TSU/PG/2024/000001', 'TSU/PG/21/GEO/0113')) then raise exception 'wrong matric matched'; end if;
  if exists (select 1 from public.verify_by_code('not-a-code')) then raise exception 'bad code matched'; end if;
end $$;
reset role;

-- Staff without aal2 see nothing
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a5', 'aal1');
do $$ begin if (select count(*) from public.credentials) <> 0 then raise exception 'aal1 user can read credentials'; end if; end $$;
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a5');
do $$ begin if (select count(*) from public.credentials) <> 3 then raise exception 'auditor cannot read credentials'; end if; end $$;
do $$ begin if (select count(*) from public.audit_log) = 0 then raise exception 'auditor cannot read audit log'; end if; end $$;
reset role;

-- The audit log is append-only, even for the owner
select pg_temp.expect_error($$delete from public.audit_log$$, 'cannot be changed');
select pg_temp.expect_error($$update public.audit_log set action = 'x'$$, 'cannot be changed');
do $$ begin
  if not exists (select 1 from public.audit_log where table_name = 'batches' and action = 'update'
                 and after ->> 'status' = 'approved' and actor_id = '00000000-0000-0000-0000-0000000000a4') then
    raise exception 'approval not audited with the registrar as actor';
  end if;
end $$;

select 'ALL TESTS PASSED' as result;
