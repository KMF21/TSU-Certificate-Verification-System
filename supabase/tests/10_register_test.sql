-- Tests for the Graduation Records Register. Run on a scratch database after
-- 00_supabase_stub.sql, both migrations and seed/sample_records.sql.
-- Any failed check raises an exception and stops the run.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@tsu.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'officer.a@tsu.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'officer.b@tsu.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'viewer@tsu.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'new@tsu.test');
insert into public.profiles (user_id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Ada Admin', 'admin@tsu.test', 'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'Officer A', 'officer.a@tsu.test', 'records_officer'),
  ('00000000-0000-0000-0000-0000000000a3', 'Officer B', 'officer.b@tsu.test', 'records_officer'),
  ('00000000-0000-0000-0000-0000000000a4', 'Vera Viewer', 'viewer@tsu.test', 'viewer');

create function pg_temp.act_as(who text, aal text default 'aal2') returns void language plpgsql as $$
declare uid text := case who
  when 'admin' then '00000000-0000-0000-0000-0000000000a1' when 'a' then '00000000-0000-0000-0000-0000000000a2'
  when 'b' then '00000000-0000-0000-0000-0000000000a3' when 'viewer' then '00000000-0000-0000-0000-0000000000a4' end;
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.expect_error(sql text, fragment text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected an error containing "%" but it succeeded: %', fragment, sql;
exception when others then
  if sqlerrm not like '%' || fragment || '%' then
    raise exception 'expected error containing "%", got "%" for: %', fragment, sqlerrm, sql;
  end if;
end $$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'CHECK FAILED: %', what; end if;
end $$;
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated, service_role, anon;
grant execute on all functions in schema pg_temp to authenticated, service_role, anon;

-- ---------------------------------------------------------- access
select pg_temp.act_as('admin', 'aal1');
select pg_temp.check((select count(*) from public.graduates) = 0, 'staff without two-factor see no records');
select pg_temp.expect_error($$select public.approve_records(array[gen_random_uuid()], current_date, null, 'k')$$, 'Only Records Officers');

select pg_temp.act_as('viewer');
select pg_temp.check((select count(*) from public.graduates) = 40, 'viewer reads all records');
select pg_temp.check((select count(*) from public.programmes) = 274, 'viewer reads programmes');
select pg_temp.expect_error($$insert into public.graduates (full_name, reg_number, programme_id) values ('X Y', 'TSU/PG/1/2', (select id from public.programmes limit 1))$$, 'row-level security');
select pg_temp.expect_error($$update public.graduates set remark = 'x'$$, 'row-level security');
select pg_temp.check((select count(*) from public.lookup_events) = 0 and (select count(*) from public.audit_log where table_name <> 'graduates') = 0, 'viewer sees no lookup log or non-record audit');
select pg_temp.check((select count(*) from public.staff_directory()) = 4, 'staff directory lists names');
select pg_temp.expect_error($$delete from public.graduates$$, 'permission denied');

-- ------------------------------------------------- single entry
select pg_temp.act_as('a');
with x as (
  insert into public.graduates (full_name, reg_number, programme_id, cgpa, class_id, graduation_session, status, verify_code)
  values ('  okoro   chidi  emeka ', ' tsu/pg/22/csc/0901 ', (select id from public.programmes where code = 'MSC-CS'), 4.21,
          (select id from public.degree_classes where label = 'Merit'), '2024/2025', 'pending', null)
  returning id)
insert into ids select 'live1', id from x;
select pg_temp.check((select reg_number = 'TSU/PG/22/CSC/0901' and full_name = 'okoro chidi emeka' and surname_key = 'OKORO'
                      and created_by = '00000000-0000-0000-0000-0000000000a2' and verification_status = 'verified'
                      from public.graduates where id = (select v from ids where k = 'live1')), 'entry normalised and stamped');
-- Protected fields can't be set or changed directly
-- A direct insert claiming APPROVED is quietly saved as PENDING
insert into public.graduates (full_name, reg_number, programme_id, status, senate_approval_date, approved_at, verify_code) values ('SHAM Record', 'TSU/PG/9/9', (select id from public.programmes limit 1), 'approved', '2024-01-01', now(), 'abcdefghjkmnpqrs');
select pg_temp.check((select status = 'pending' and verify_code is null and approved_at is null from public.graduates where reg_number = 'TSU/PG/9/9'), 'claimed approval ignored on insert');
select pg_temp.expect_error(format($$update public.graduates set status = 'approved', approved_at = now(), senate_approval_date = current_date where id = %L$$, (select v from ids where k = 'live1')), 'change only through approval');
select pg_temp.expect_error(format($$update public.graduates set verify_code = 'abcdefghjkmnpqrs' where id = %L$$, (select v from ids where k = 'live1')), 'change only through approval');
select pg_temp.expect_error($$insert into public.graduates (full_name, reg_number, programme_id, cgpa) values ('A B', 'TSU/PG/9/8', (select id from public.programmes limit 1), 5.5)$$, 'check constraint');
select pg_temp.expect_error($$insert into public.graduates (full_name, reg_number, programme_id, graduation_session) values ('A B', 'TSU/PG/9/7', (select id from public.programmes limit 1), '2023/2025')$$, 'check constraint');
select pg_temp.expect_error($$insert into public.graduates (full_name, reg_number, programme_id) values ('A B', 'TSU/PG/22/CSC/0901', (select id from public.programmes limit 1))$$, 'duplicate key');
select pg_temp.expect_error($$insert into public.graduates (full_name, reg_number, programme_id, senate_approval_date) values ('A B', 'TSU/PG/9/6', (select id from public.programmes limit 1), current_date + 10)$$, 'in the future');
update public.graduates set cgpa = 4.30 where id = (select v from ids where k = 'live1');

-- ----------------------------------------- two-person approval
select pg_temp.expect_error(format($$select public.approve_records(array[%L]::uuid[], '2025-11-20', null, 'tsu-demo-2026')$$, (select v from ids where k = 'live1')), 'another officer must approve it');
select pg_temp.act_as('b');
select pg_temp.expect_error(format($$select public.approve_records(array[%L]::uuid[], '2099-01-01', null, 'k')$$, (select v from ids where k = 'live1')), 'future');
select pg_temp.expect_error(format($$select public.approve_records(array[%L]::uuid[], '2025-11-20', null, '')$$, (select v from ids where k = 'live1')), 'signing key');
select pg_temp.check(public.approve_records(array[(select v from ids where k = 'live1')], '2025-11-20', null, 'tsu-demo-2026') = 1, 'officer B approves');
select pg_temp.check((select status = 'approved' and certificate_serial ~ '^TSU/PG/2025/\d{6}$'
                      and verify_code ~ '^[a-z2-9]{16}$' and approved_by = '00000000-0000-0000-0000-0000000000a3'
                      and updated_by = '00000000-0000-0000-0000-0000000000a2'
                      from public.graduates where id = (select v from ids where k = 'live1')), 'live approval issues certificate identity, keeps last editor');
select pg_temp.expect_error(format($$select public.approve_records(array[%L]::uuid[], '2025-11-20', null, 'k')$$, (select v from ids where k = 'live1')), 'already approved');

-- Approved records change only with a reason
select pg_temp.expect_error(format($$update public.graduates set remark = 'x' where id = %L$$, (select v from ids where k = 'live1')), 'row-level security');
select pg_temp.expect_error(format($$select public.update_approved_record(%L, '{"cgpa": 4.5}', 'no')$$, (select v from ids where k = 'live1')), 'Give a reason');
select pg_temp.expect_error(format($$select public.update_approved_record(%L, '{"status": "pending"}', 'Correcting status')$$, (select v from ids where k = 'live1')), 'can’t be changed here');
select public.update_approved_record((select v from ids where k = 'live1'), '{"cgpa": 4.35, "remark": "Graduated"}', 'Senate list shows 4.35');
select pg_temp.check((select reason = 'Senate list shows 4.35' and action = 'edit_approved' and (after ->> 'cgpa')::numeric = 4.35
                      from public.audit_log where table_name = 'graduates' and row_id = (select v from ids where k = 'live1') order by id desc limit 1),
                     'approved edit audited with reason');

-- ------------------------------------------------------ imports
select pg_temp.act_as('a');
insert into ids values ('batch1', public.commit_import('legacy-2021.xlsx', 'legacy', jsonb_build_array(
  jsonb_build_object('action', 'create', 'full_name', 'DANLADI Peter Bala', 'reg_number', 'tsu/pg/19/geo/0101', 'programme_id', (select id from public.programmes where code = 'MSC-ERM'), 'cgpa', '3.90', 'graduation_session', '2021/2022', 'senate_approval_date', '2022-11-17'),
  jsonb_build_object('action', 'create', 'full_name', 'Mrs. ZAKKA Comfort', 'reg_number', 'TSU/PG/19/GEO/0102', 'programme_id', (select id from public.programmes where code = 'MSC-ERM'), 'cgpa', '', 'class_id', (select id from public.degree_classes where label = 'Pass')),
  jsonb_build_object('action', 'update', 'full_name', 'OKORO Chidi Emeka', 'reg_number', (select reg_number from public.graduates where is_sample and status = 'pending' and source = 'live' order by reg_number limit 1), 'programme_id', (select id from public.programmes where code = 'MSC-CS'), 'cgpa', '4.00')
), '{"Name": "full_name"}', '{"graduation_session": "2021/2022"}', '[{"row": 9, "reason": "No name"}]', 1, 1));
select pg_temp.check((select accepted_count = 2 and updated_count = 1 and skipped_count = 1 and rejected_count = 1 and source = 'legacy'
                      from public.import_batches where id = (select v from ids where k = 'batch1')), 'import counts');
select pg_temp.check((select bool_and(status = 'pending' and verification_status = 'unverified' and created_by = '00000000-0000-0000-0000-0000000000a2')
                      from public.graduates where import_batch_id = (select v from ids where k = 'batch1')), 'imported legacy rows are pending and unverified');
select pg_temp.check((select surname_key from public.graduates where reg_number = 'TSU/PG/19/GEO/0102') = 'ZAKKA', 'titles ignored in surname');
-- One bad row aborts the whole file
select pg_temp.expect_error($$select public.commit_import('bad.xlsx', 'live', jsonb_build_array(
  jsonb_build_object('action', 'create', 'full_name', 'GOOD Row', 'reg_number', 'TSU/PG/23/X/0001', 'programme_id', (select id from public.programmes limit 1)),
  jsonb_build_object('action', 'create', 'full_name', 'DUP Row', 'reg_number', 'TSU/PG/19/GEO/0101', 'programme_id', (select id from public.programmes limit 1))))$$, 'already in the register');
select pg_temp.check(not exists (select 1 from public.graduates where reg_number = 'TSU/PG/23/X/0001'), 'failed import saved nothing');
select pg_temp.expect_error(format($$select public.commit_import('x.xlsx', 'live', jsonb_build_array(jsonb_build_object('action', 'update', 'full_name', 'A B', 'reg_number', %L, 'programme_id', (select id from public.programmes limit 1))))$$,
  (select reg_number from public.graduates where id = (select v from ids where k = 'live1'))), 'already approved');
select pg_temp.expect_error($$select public.commit_import('x.xlsx', 'live', jsonb_build_array(jsonb_build_object('action', 'create', 'reg_number', 'TSU/PG/23/X/0002', 'programme_id', (select id from public.programmes limit 1))))$$, 'name is missing');
select pg_temp.expect_error($$select public.commit_import('x.xlsx', 'live', jsonb_build_array(
  jsonb_build_object('row', '14', 'action', 'create', 'full_name', 'ONE Person', 'reg_number', 'tsu/pg/23/x/0009', 'programme_id', (select id from public.programmes limit 1)),
  jsonb_build_object('row', '15', 'action', 'create', 'full_name', 'TWO Person', 'reg_number', 'TSU/PG/23/X/0009', 'programme_id', (select id from public.programmes limit 1))))$$,
  'Row 14: TSU/PG/23/X/0009 appears more than once');
select pg_temp.expect_error($$select public.commit_import('x.xlsx', 'live', jsonb_build_array(
  jsonb_build_object('action', 'create', 'full_name', 'ONE Person', 'reg_number', 'TSU/PG/23/X/0010', 'programme_id', (select id from public.programmes limit 1), 'cgpa', 'four')))$$,
  'couldn’t be read');

-- Importer can't verify own legacy rows; B approves and verifies them.
select pg_temp.expect_error(format($$select public.verify_records(array(select id from public.graduates where import_batch_id = %L))$$, (select v from ids where k = 'batch1')), 'another officer must verify');

-- Undo: admin only, reason required, and only while untouched
select pg_temp.expect_error(format($$select public.undo_import(%L, 'Wrong file uploaded')$$, (select v from ids where k = 'batch1')), 'Only an Admin');
select pg_temp.act_as('admin');
select pg_temp.expect_error(format($$select public.undo_import(%L, 'no')$$, (select v from ids where k = 'batch1')), 'Give a reason');
-- an edit after import blocks undo
select pg_temp.act_as('b');
update public.graduates set remark = 'Checked' where reg_number = 'TSU/PG/19/GEO/0101';
select pg_temp.act_as('admin');
select pg_temp.expect_error(format($$select public.undo_import(%L, 'Wrong file uploaded')$$, (select v from ids where k = 'batch1')), 'TSU/PG/19/GEO/0101');
reset role;
-- Second import, left untouched, undoes cleanly and restores the updated record
select pg_temp.act_as('a');
insert into ids values ('target', (select id from public.graduates where is_sample and status = 'pending' and source = 'live' order by reg_number offset 1 limit 1));
insert into ids values ('batch2', public.commit_import('fix.xlsx', 'live', jsonb_build_array(
  jsonb_build_object('action', 'create', 'full_name', 'NEW Person', 'reg_number', 'TSU/PG/24/CSC/0500', 'programme_id', (select id from public.programmes where code = 'MSC-CS')),
  jsonb_build_object('action', 'update', 'full_name', 'CHANGED Name', 'reg_number', (select reg_number from public.graduates where id = (select v from ids where k = 'target')), 'programme_id', (select id from public.programmes where code = 'MSC-CS'), 'remark', 'changed')
)));
reset role;
select pg_temp.act_as('admin');
select pg_temp.check(public.undo_import((select v from ids where k = 'batch2'), 'Uploaded the wrong file') = 1, 'undo removes created record');
select pg_temp.check(not exists (select 1 from public.graduates where reg_number = 'TSU/PG/24/CSC/0500'), 'created record gone');
select pg_temp.check((select full_name <> 'CHANGED Name' and coalesce(remark, '') <> 'changed' from public.graduates where id = (select v from ids where k = 'target')), 'updated record restored');
select pg_temp.check((select status = 'undone' and undo_reason = 'Uploaded the wrong file' from public.import_batches where id = (select v from ids where k = 'batch2')), 'batch marked undone');
select pg_temp.expect_error(format($$select public.undo_import(%L, 'Again please')$$, (select v from ids where k = 'batch2')), 'already undone');

-- B approves the legacy rows from batch 1, then verifies them (approval doesn't count as editing)
select pg_temp.act_as('b');
select pg_temp.check(public.approve_records(array(select id from public.graduates where reg_number = 'TSU/PG/19/GEO/0102'), '2022-11-17', '2021/2022', null) = 1, 'legacy approval needs no key');
select pg_temp.check((select certificate_serial is null and verify_code is null from public.graduates where reg_number = 'TSU/PG/19/GEO/0102'), 'legacy approval issues no certificate');
select pg_temp.check(public.verify_records(array(select id from public.graduates where reg_number = 'TSU/PG/19/GEO/0102')) = 1, 'B verifies legacy record');
-- B last edited 0101, so B can't verify it
select pg_temp.expect_error($$select public.verify_records(array(select id from public.graduates where reg_number = 'TSU/PG/19/GEO/0101'))$$, 'another officer must verify');

-- ---------------------------------------------- admin operations
select pg_temp.act_as('a');
select pg_temp.expect_error(format($$select public.delete_record(%L, 'Duplicate entry')$$, (select v from ids where k = 'live1')), 'Only an Admin');
select pg_temp.act_as('admin');
select pg_temp.expect_error($$select public.save_staff_profile('00000000-0000-0000-0000-0000000000a1', 'Ada Admin', 'admin@tsu.test', 'viewer')$$, 'own Admin access');
select public.save_staff_profile('00000000-0000-0000-0000-0000000000a5', 'New Officer', 'NEW@tsu.test', 'records_officer');
select pg_temp.check((select email from public.profiles where user_id = '00000000-0000-0000-0000-0000000000a5') = 'new@tsu.test', 'admin creates staff profile');
insert into public.degree_classes (label, level, sort_order) values ('Upper Credit', 'pgd', 25);
select pg_temp.act_as('a');
select pg_temp.expect_error($$insert into public.degree_classes (label) values ('Excellent')$$, 'row-level security');
select pg_temp.act_as('viewer');
select public.log_export('{"sessions": ["2023/2024"], "status": "approved"}', array['full_name', 'reg_number'], 'xlsx', 120);
select pg_temp.expect_error($$select public.log_export('{}', array['x'], 'docx', 1)$$, 'Unknown export format');
select pg_temp.act_as('admin');
select pg_temp.check(exists (select 1 from public.audit_log where action = 'export' and actor_id = '00000000-0000-0000-0000-0000000000a4' and details -> 'filters' ->> 'status' = 'approved'), 'export logged with filters');

-- --------------------------------------------- public lookups
reset role;
set role anon;
select set_config('request.jwt.claims', '{}', false);
select pg_temp.expect_error($$select * from public.graduates$$, 'permission denied');
select pg_temp.expect_error($$select * from public.lookup_by_code('abcdefghjkmnpqrs')$$, 'permission denied');
select pg_temp.expect_error($$select * from public.lookup_by_reg_and_surname('TSU/PG/1/1', 'X')$$, 'permission denied');
reset role;
select pg_temp.act_as('admin');
select pg_temp.expect_error($$select * from public.lookup_by_code('abcdefghjkmnpqrs')$$, 'permission denied');
reset role;
set role service_role;
do $$
declare r record; g public.graduates;
begin
  -- Verified live record by QR code
  select * into g from public.graduates where id = (select v from ids where k = 'live1');
  select * into r from public.lookup_by_code(g.verify_code, 'ip-1');
  perform pg_temp.check(r.result = 'verified' and r.full_name = g.full_name and r.programme = 'Computer Science'
                        and r.class_of_degree = 'Merit' and r.certificate_serial = g.certificate_serial, 'QR lookup verified');
  -- Same record by reg number and surname (case, spaces and titles ignored)
  select * into r from public.lookup_by_reg_and_surname(' tsu/pg/22/csc/0901', 'Dr. Okoro', 'ip-1');
  perform pg_temp.check(r.result = 'verified', 'reg + surname lookup verified');
  -- Wrong surname looks exactly like an unknown number
  select * into r from public.lookup_by_reg_and_surname('TSU/PG/22/CSC/0901', 'Bako', 'ip-1');
  perform pg_temp.check(r.result = 'not_found' and r.full_name is null, 'wrong surname gives not found');
  -- Legacy approved but unverified: under review, no details
  select * into g from public.graduates where is_sample and source = 'legacy' and verification_status = 'unverified' and status = 'approved' limit 1;
  select * into r from public.lookup_by_reg_and_surname(g.reg_number, g.surname_key, 'ip-2');
  perform pg_temp.check(r.result = 'under_review' and r.full_name is null and r.programme is null, 'legacy unverified is under review');
  -- Legacy pending: under review too
  select * into g from public.graduates where is_sample and source = 'legacy' and status = 'pending' limit 1;
  select * into r from public.lookup_by_reg_and_surname(g.reg_number, g.surname_key, 'ip-2');
  perform pg_temp.check(r.result = 'under_review', 'legacy pending is under review');
  -- Legacy approved and verified: verified, no certificate serial
  select * into r from public.lookup_by_reg_and_surname('TSU/PG/19/GEO/0102', 'Zakka', 'ip-2');
  perform pg_temp.check(r.result = 'verified' and r.certificate_serial is null, 'verified legacy record');
  -- Live pending: not found
  select * into g from public.graduates where is_sample and source = 'live' and status = 'pending' limit 1;
  select * into r from public.lookup_by_reg_and_surname(g.reg_number, g.surname_key, 'ip-2');
  perform pg_temp.check(r.result = 'not_found' and r.full_name is null, 'live pending is not found');
  -- Malformed code
  select * into r from public.lookup_by_code('../../etc', 'ip-2');
  perform pg_temp.check(r.result = 'not_found', 'bad code not found');
end $$;
-- Rate limit: the 11th lookup in a minute from one address is refused and logged
do $$
declare r record;
begin
  for i in 1..10 loop perform public.lookup_by_code('zzzzzzzzzzzzzzzz', 'ip-flood'); end loop;
  select * into r from public.lookup_by_code('zzzzzzzzzzzzzzzz', 'ip-flood');
  perform pg_temp.check(r.result = 'rate_limited' and r.full_name is null, 'rate limited after 10 a minute');
  select * into r from public.lookup_by_code('zzzzzzzzzzzzzzzz', 'ip-other');
  perform pg_temp.check(r.result = 'not_found', 'other addresses unaffected');
end $$;
-- Results never carry CGPA, remark or internal fields
do $$ begin
  perform pg_temp.check(not exists (
    select 1 from information_schema.parameters
    where specific_name like 'lookup_by_%' and parameter_mode = 'OUT'
      and parameter_name in ('cgpa', 'remark', 'reg_number', 'created_by', 'approved_by', 'id')), 'no internal fields in public results');
end $$;
reset role;

-- ----------------------------------------------- audit log
select pg_temp.expect_error($$delete from public.audit_log$$, 'cannot be changed');
select pg_temp.expect_error($$update public.audit_log set reason = 'x'$$, 'cannot be changed');
select pg_temp.expect_error($$truncate public.audit_log$$, 'cannot be changed');
select pg_temp.check(exists (select 1 from public.audit_log where action = 'approve' and actor_id = '00000000-0000-0000-0000-0000000000a3'), 'approvals audited');
select pg_temp.check(exists (select 1 from public.audit_log where action = 'undo_import' and reason = 'Uploaded the wrong file'), 'undo audited with reason');
select pg_temp.check(exists (select 1 from public.audit_log where action = 'import'), 'imports audited');

select 'ALL REGISTER TESTS PASSED' as result;
