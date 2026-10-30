-- =====================================================================
-- TSU Graduation Records Register
-- The single source of truth for graduates of Taraba State University,
-- starting with the College of Postgraduate Studies.
--
-- Security model
--   * Staff must be signed in with two factors (aal2) and hold an active
--     role: admin, records_officer or viewer.
--   * Row-level security on every table. Simple edits to PENDING records
--     go straight through RLS; everything that changes what the public
--     sees (approve, verify, edit an approved record, import, undo,
--     delete) goes through functions that check role, the two-person
--     rule and a reason.
--   * A guard trigger stops any write path from setting protected fields
--     outside those functions.
--   * Anonymous visitors have no access at all. The website's server
--     calls two public lookup functions, which rate-limit, log, and
--     return only safe fields.
--   * The audit log is append-only, for everyone.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- --------------------------------------------------------------- types
create type public.app_role as enum ('admin', 'records_officer', 'viewer');
-- 'undergraduate' is reserved so first degrees can be added later without a type change.
create type public.programme_level as enum ('pgd', 'masters', 'phd', 'undergraduate');
create type public.record_status as enum ('pending', 'approved');
create type public.record_source as enum ('live', 'legacy');
create type public.verification_state as enum ('verified', 'unverified');

-- ------------------------------------------------------- staff accounts
create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(trim(full_name)) between 2 and 120),
  email      text not null,
  role       public.app_role not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------ reference data
create table public.faculties (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-Z0-9]{2,12}$'),
  name       text not null unique check (length(trim(name)) between 3 and 160),
  is_sample  boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties (id) on delete restrict,
  code       text not null unique check (code ~ '^[A-Z0-9]{2,12}$'),
  name       text not null check (length(trim(name)) between 3 and 160),
  is_sample  boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (faculty_id, name)
);

create table public.programmes (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  code          text not null unique check (code ~ '^[A-Z0-9-]{2,24}$'),
  name          text not null check (length(trim(name)) between 2 and 200),
  award_title   text not null check (length(trim(award_title)) between 2 and 120),
  level         public.programme_level not null,
  is_sample     boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (department_id, name, award_title)
);
create index programmes_department_idx on public.programmes (department_id);

-- Editable list of classes of degree / grades. A null level means it applies to every level.
create table public.degree_classes (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (length(trim(label)) between 2 and 80),
  level      public.programme_level,
  sort_order integer not null default 100,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (label, level)
);

-- ------------------------------------------------------------- imports
create table public.import_batches (
  id             uuid primary key default gen_random_uuid(),
  file_name      text not null check (length(file_name) between 1 and 255),
  source         public.record_source not null,
  uploaded_by    uuid not null references auth.users (id),
  uploaded_at    timestamptz not null default now(),
  column_mapping jsonb not null default '{}'::jsonb,
  shared_values  jsonb not null default '{}'::jsonb,
  accepted_count integer not null default 0 check (accepted_count >= 0),
  updated_count  integer not null default 0 check (updated_count >= 0),
  skipped_count  integer not null default 0 check (skipped_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  -- Rows rejected or skipped before commit, with reasons, for the downloadable report.
  report         jsonb not null default '[]'::jsonb,
  status         text not null default 'committed' check (status in ('committed', 'undone')),
  undone_by      uuid references auth.users (id),
  undone_at      timestamptz,
  undo_reason    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index import_batches_uploaded_at_idx on public.import_batches (uploaded_at desc);

-- ------------------------------------------------------------- register
create table public.graduates (
  id                   uuid primary key default gen_random_uuid(),
  full_name            text not null check (length(trim(full_name)) between 3 and 200),
  -- First word of the name with titles and punctuation removed, used for public lookup.
  surname_key          text not null default '',
  reg_number           text not null unique
                       check (reg_number = upper(reg_number) and reg_number ~ '^[A-Z0-9][A-Z0-9/.-]{2,39}$'),
  programme_id         uuid not null references public.programmes (id) on delete restrict,
  cgpa                 numeric(3, 2) check (cgpa between 0 and 5),
  class_id             uuid references public.degree_classes (id) on delete restrict,
  remark               text check (length(remark) <= 500),
  graduation_session   text check (
                         graduation_session ~ '^\d{4}/\d{4}$'
                         and split_part(graduation_session, '/', 2)::int = split_part(graduation_session, '/', 1)::int + 1
                       ),
  senate_approval_date date check (senate_approval_date >= date '2008-01-01'),
  status               public.record_status not null default 'pending',
  source               public.record_source not null default 'live',
  verification_status  public.verification_state not null default 'unverified',
  import_batch_id      uuid references public.import_batches (id) on delete set null,
  is_sample            boolean not null default false,
  -- Certificate identity, issued when a LIVE record is approved.
  certificate_serial   text unique,
  verify_code          text unique check (verify_code ~ '^[a-z2-9]{16}$'),
  key_id               text,
  created_by           uuid references auth.users (id),
  created_at           timestamptz not null default now(),
  updated_by           uuid references auth.users (id),
  updated_at           timestamptz not null default now(),
  approved_by          uuid references auth.users (id),
  approved_at          timestamptz,
  verified_by          uuid references auth.users (id),
  verified_at          timestamptz,
  constraint approved_needs_date    check (status = 'pending' or senate_approval_date is not null),
  constraint approved_needs_session check (status = 'pending' or graduation_session is not null),
  constraint approved_has_approver  check ((status = 'approved') = (approved_at is not null)),
  constraint certificate_only_when_approved check (verify_code is null or status = 'approved')
);

create index graduates_programme_idx      on public.graduates (programme_id);
create index graduates_session_idx        on public.graduates (graduation_session);
create index graduates_senate_date_idx    on public.graduates (senate_approval_date);
create index graduates_status_idx         on public.graduates (status, source, verification_status);
create index graduates_batch_idx          on public.graduates (import_batch_id);
create index graduates_surname_key_idx    on public.graduates (surname_key);
create index graduates_name_trgm_idx      on public.graduates using gin (full_name extensions.gin_trgm_ops);
create index graduates_reg_trgm_idx       on public.graduates using gin (reg_number extensions.gin_trgm_ops);

-- What each import did to each record, so an import can be undone exactly.
create table public.import_batch_changes (
  batch_id    uuid not null references public.import_batches (id) on delete cascade,
  graduate_id uuid not null,
  action      text not null check (action in ('created', 'updated')),
  before      jsonb,
  primary key (batch_id, graduate_id)
);

create table public.serial_counters (
  series     text primary key,
  last_value integer not null default 0 check (last_value >= 0)
);

-- --------------------------------------------------- exports and audit
create table public.export_presets (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name       text not null check (length(trim(name)) between 2 and 80),
  filters    jsonb not null default '{}'::jsonb,
  columns    text[] not null default '{}',
  shared     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  action     text not null,
  table_name text not null,
  row_id     uuid,
  before     jsonb,
  after      jsonb,
  reason     text,
  details    jsonb
);
create index audit_log_at_idx  on public.audit_log (at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id, at desc);

create table public.lookup_events (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  channel    text not null check (channel in ('code', 'reg', 'token')),
  result     text not null check (result in ('verified', 'under_review', 'not_found', 'rate_limited')),
  ip_hash    text,
  country    text,
  user_agent text
);
create index lookup_events_ip_idx on public.lookup_events (ip_hash, at desc);
create index lookup_events_at_idx on public.lookup_events (at desc);

-- ============================================================== helpers
create function private.surname_key(p_name text) returns text
language sql immutable set search_path = '' as $$
  select coalesce((
    select upper(regexp_replace(w, '[^A-Za-z]', '', 'g'))
    from unnest(regexp_split_to_array(trim(coalesce(p_name, '')), '[\s,]+')) with ordinality as t(w, n)
    where upper(regexp_replace(w, '[^A-Za-z]', '', 'g')) not in
      ('', 'MR', 'MRS', 'MS', 'MISS', 'DR', 'PROF', 'ENGR', 'BARR', 'REV', 'ALH', 'ALHAJI', 'HAJIYA', 'MALAM', 'MALLAM', 'PASTOR', 'CHIEF', 'HON', 'ARC', 'PHARM', 'SIR')
    order by n
    limit 1
  ), '')
$$;

create function private.normalise_reg(p text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(replace(coalesce(p, ''), '\', '/'), '\s', '', 'g'))
$$;

-- The caller's role, only when signed in with a second factor.
create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid()
    and p.active
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_app_role() is not null
$$;

create function private.can_write() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_app_role() in ('admin', 'records_officer')
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_app_role() = 'admin'
$$;

create function private.require(p_ok boolean, p_message text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if not coalesce(p_ok, false) then
    raise exception using message = p_message, errcode = '42501';
  end if;
end $$;

-- Marks the current transaction as a trusted workflow step, with the action name
-- and reason picked up by the audit trigger.
create function private.begin_action(p_action text, p_reason text default null) returns void
language sql volatile set search_path = '' as $$
  select set_config('app.action', p_action, true), set_config('app.reason', coalesce(p_reason, ''), true)
$$;

create function private.new_verify_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  b bytea;
  s text;
begin
  loop
    b := extensions.gen_random_bytes(16);
    s := '';
    for i in 0..15 loop
      s := s || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.graduates where verify_code = s);
  end loop;
  return s;
end $$;

-- ============================================================ triggers
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case tg_op when 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, action, table_name, row_id, before, after, reason)
  values (
    auth.uid(),
    coalesce(nullif(current_setting('app.action', true), ''), lower(tg_op)),
    tg_table_name,
    coalesce(r ->> 'id', r ->> 'user_id')::uuid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    nullif(current_setting('app.reason', true), '')
  );
  return null;
end $$;

create function private.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'The audit log cannot be changed or deleted';
end $$;

-- Keeps derived and protected fields honest on every write path.
create function private.guard_graduate() returns trigger
language plpgsql set search_path = '' as $$
declare
  trusted boolean := coalesce(nullif(current_setting('app.action', true), ''), '') <> '';
  -- Requests from the API carry a user id; migrations, seeds and the service role do not.
  from_user boolean := auth.uid() is not null;
begin
  new.full_name := regexp_replace(trim(new.full_name), '\s+', ' ', 'g');
  new.reg_number := private.normalise_reg(new.reg_number);
  new.surname_key := private.surname_key(new.full_name);
  new.remark := nullif(trim(coalesce(new.remark, '')), '');
  if new.senate_approval_date > current_date then
    raise exception 'The Senate approval date % is in the future', new.senate_approval_date using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.verification_status := case new.source when 'live' then 'verified'::public.verification_state else 'unverified'::public.verification_state end;
    if from_user and not trusted then
      new.status := 'pending';
      new.created_by := auth.uid();
      new.updated_by := auth.uid();
      new.import_batch_id := null;
      new.certificate_serial := null; new.verify_code := null; new.key_id := null;
      new.approved_by := null; new.approved_at := null;
      new.verified_by := null; new.verified_at := null;
    end if;
    return new;
  end if;

  -- UPDATE. Approving and verifying don't count as editing, so they keep the last editor.
  if from_user and coalesce(current_setting('app.action', true), '') not in ('approve', 'verify') then
    new.updated_by := auth.uid();
  elsif coalesce(current_setting('app.action', true), '') in ('approve', 'verify') then
    new.updated_by := old.updated_by;
  end if;
  if from_user and not trusted then
    if old.status = 'approved' then
      raise exception 'Approved records can only be changed with a reason' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       or new.source is distinct from old.source
       or new.verification_status is distinct from old.verification_status
       or new.import_batch_id is distinct from old.import_batch_id
       or new.created_by is distinct from old.created_by
       or new.is_sample is distinct from old.is_sample
       or (new.certificate_serial, new.verify_code, new.key_id) is distinct from (old.certificate_serial, old.verify_code, old.key_id)
       or (new.approved_by, new.approved_at, new.verified_by, new.verified_at) is distinct from (old.approved_by, old.approved_at, old.verified_by, old.verified_at) then
      raise exception 'Status, source, verification and certificate fields change only through approval and verification' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger guard before insert or update on public.graduates
  for each row execute function private.guard_graduate();

do $$
declare t text;
begin
  foreach t in array array['profiles', 'faculties', 'departments', 'programmes', 'degree_classes', 'graduates', 'import_batches', 'export_presets'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function private.audit_row()', t);
  end loop;
end $$;

create trigger audit_log_is_append_only before update or delete on public.audit_log
  for each statement execute function private.forbid_change();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.forbid_change();

-- ============================================================== access
alter table public.profiles             enable row level security;
alter table public.faculties            enable row level security;
alter table public.departments          enable row level security;
alter table public.programmes           enable row level security;
alter table public.degree_classes       enable row level security;
alter table public.import_batches       enable row level security;
alter table public.graduates            enable row level security;
alter table public.import_batch_changes enable row level security;
alter table public.serial_counters      enable row level security;
alter table public.export_presets       enable row level security;
alter table public.audit_log            enable row level security;
alter table public.lookup_events        enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.profiles, public.faculties, public.departments, public.programmes, public.degree_classes,
  public.import_batches, public.import_batch_changes, public.graduates, public.audit_log, public.lookup_events
  to authenticated;
grant insert, update on public.faculties, public.departments, public.programmes, public.degree_classes to authenticated;
grant insert, update on public.graduates to authenticated;
grant select, insert, update, delete on public.export_presets to authenticated;
revoke update, delete, truncate on public.audit_log from service_role;

-- Staff accounts
create policy "Staff read own profile, admins read all" on public.profiles for select to authenticated
  using (user_id = auth.uid() or private.is_admin());

-- Reference data: all staff read, admins change
create policy "Staff read faculties" on public.faculties for select to authenticated using (private.is_staff());
create policy "Admins add faculties" on public.faculties for insert to authenticated with check (private.is_admin());
create policy "Admins change faculties" on public.faculties for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "Staff read departments" on public.departments for select to authenticated using (private.is_staff());
create policy "Admins add departments" on public.departments for insert to authenticated with check (private.is_admin());
create policy "Admins change departments" on public.departments for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "Staff read programmes" on public.programmes for select to authenticated using (private.is_staff());
create policy "Admins add programmes" on public.programmes for insert to authenticated with check (private.is_admin());
create policy "Admins change programmes" on public.programmes for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "Staff read classes" on public.degree_classes for select to authenticated using (private.is_staff());
create policy "Admins add classes" on public.degree_classes for insert to authenticated with check (private.is_admin());
create policy "Admins change classes" on public.degree_classes for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- Register: all staff read; officers and admins add and edit PENDING records directly.
create policy "Staff read records" on public.graduates for select to authenticated using (private.is_staff());
create policy "Officers add pending records" on public.graduates for insert to authenticated
  with check (private.can_write() and status = 'pending');
create policy "Officers edit pending records" on public.graduates for update to authenticated
  using (private.can_write() and status = 'pending')
  with check (private.can_write() and status = 'pending');

create policy "Staff read imports" on public.import_batches for select to authenticated using (private.is_staff());
create policy "Staff read import changes" on public.import_batch_changes for select to authenticated using (private.is_staff());

create policy "Own or shared presets" on public.export_presets for select to authenticated
  using (private.is_staff() and (owner_id = auth.uid() or shared));
create policy "Staff add own presets" on public.export_presets for insert to authenticated
  with check (private.is_staff() and owner_id = auth.uid());
create policy "Staff change own presets" on public.export_presets for update to authenticated
  using (private.is_staff() and owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Staff delete own presets" on public.export_presets for delete to authenticated
  using (private.is_staff() and owner_id = auth.uid());

-- Audit: admins see everything; other staff see the history of register records.
create policy "Audit visibility" on public.audit_log for select to authenticated
  using (private.is_admin() or (private.is_staff() and table_name = 'graduates'));
create policy "Admins read lookup events" on public.lookup_events for select to authenticated using (private.is_admin());

-- ===================================================== staff functions
create function public.save_staff_profile(
  p_user_id uuid, p_full_name text, p_email text, p_role public.app_role, p_active boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require(private.is_admin(), 'Only an Admin can manage staff accounts');
  perform private.require(exists (select 1 from auth.users where id = p_user_id), 'No sign-in account exists for that user');
  perform private.require(not (p_user_id = auth.uid() and (p_role <> 'admin' or not p_active)),
    'You can’t remove your own Admin access. Ask another Admin.');
  insert into public.profiles (user_id, full_name, email, role, active)
  values (p_user_id, trim(p_full_name), lower(trim(p_email)), p_role, p_active)
  on conflict (user_id) do update
    set full_name = excluded.full_name, email = excluded.email, role = excluded.role, active = excluded.active;
end $$;

-- Two-person rule: you can't approve or verify a record you created, imported or last edited.
create function private.assert_not_own(p_ids uuid[], p_verb text) returns void
language plpgsql stable set search_path = '' as $$
declare v_regs text;
begin
  select string_agg(reg_number, ', ' order by reg_number) into v_regs
  from (
    select reg_number from public.graduates
    where id = any(p_ids) and (created_by = auth.uid() or updated_by = auth.uid())
    order by reg_number limit 5
  ) s;
  if v_regs is not null then
    raise exception using errcode = '42501',
      message = format('You entered or last edited %s, so another officer must %s %s', v_regs, p_verb,
                       case when strpos(v_regs, ',') > 0 then 'them' else 'it' end);
  end if;
end $$;

-- Approve one or many PENDING records with their Senate approval date.
-- LIVE records receive a certificate serial and verification code.
create function public.approve_records(
  p_ids uuid[], p_senate_approval_date date, p_graduation_session text default null, p_key_id text default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_row   record;
  v_n     integer := 0;
  v_next  integer;
  v_year  text;
  v_session text := nullif(trim(coalesce(p_graduation_session, '')), '');
begin
  perform private.require(private.can_write(), 'Only Records Officers and Admins can approve records');
  perform private.require(coalesce(array_length(p_ids, 1), 0) between 1 and 5000, 'Select between 1 and 5,000 records');
  perform private.require(p_senate_approval_date is not null, 'Enter the Senate approval date');
  perform private.require(p_senate_approval_date <= current_date, 'The Senate approval date can’t be in the future');
  if exists (select 1 from public.graduates where id = any(p_ids) and status <> 'pending') then
    raise exception 'Some selected records are already approved. Refresh and try again.';
  end if;
  if (select count(*) from public.graduates where id = any(p_ids)) <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'Some selected records no longer exist. Refresh and try again.';
  end if;
  perform private.assert_not_own(p_ids, 'approve');
  if exists (select 1 from public.graduates where id = any(p_ids) and coalesce(v_session, graduation_session) is null) then
    raise exception 'Some selected records have no graduation session. Enter one to apply to all.';
  end if;
  if exists (select 1 from public.graduates where id = any(p_ids) and source = 'live') then
    perform private.require(coalesce(trim(p_key_id), '') <> '', 'A signing key id is required to issue certificates');
  end if;

  perform private.begin_action('approve');
  v_year := extract(year from p_senate_approval_date)::text;
  for v_row in
    select id, source from public.graduates where id = any(p_ids) order by full_name, reg_number for update
  loop
    if v_row.source = 'live' then
      insert into public.serial_counters as s (series, last_value) values ('PG-' || v_year, 1)
      on conflict (series) do update set last_value = s.last_value + 1
      returning last_value into v_next;
    end if;
    update public.graduates g
    set status = 'approved',
        senate_approval_date = p_senate_approval_date,
        graduation_session = coalesce(v_session, g.graduation_session),
        approved_by = auth.uid(),
        approved_at = now(),
        certificate_serial = case when v_row.source = 'live' then 'TSU/PG/' || v_year || '/' || lpad(v_next::text, 6, '0') end,
        verify_code = case when v_row.source = 'live' then private.new_verify_code() end,
        key_id = case when v_row.source = 'live' then trim(p_key_id) end
    where g.id = v_row.id;
    v_n := v_n + 1;
  end loop;
  perform private.begin_action('');
  return v_n;
end $$;

-- Mark legacy records as checked against official documents.
create function public.verify_records(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  perform private.require(private.can_write(), 'Only Records Officers and Admins can verify records');
  perform private.require(coalesce(array_length(p_ids, 1), 0) between 1 and 5000, 'Select between 1 and 5,000 records');
  if exists (select 1 from public.graduates where id = any(p_ids) and verification_status = 'verified') then
    raise exception 'Some selected records are already verified. Refresh and try again.';
  end if;
  perform private.assert_not_own(p_ids, 'verify');
  perform private.begin_action('verify');
  update public.graduates
  set verification_status = 'verified', verified_by = auth.uid(), verified_at = now()
  where id = any(p_ids);
  get diagnostics v_n = row_count;
  perform private.begin_action('');
  return v_n;
end $$;

-- Edit an APPROVED record. A reason is required and kept in the audit log.
create function public.update_approved_record(p_id uuid, p_changes jsonb, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old public.graduates;
  allowed constant text[] := array['full_name', 'reg_number', 'programme_id', 'cgpa', 'class_id', 'remark',
                                   'graduation_session', 'senate_approval_date'];
  k text;
begin
  perform private.require(private.can_write(), 'Only Records Officers and Admins can edit records');
  perform private.require(length(trim(coalesce(p_reason, ''))) >= 5, 'Give a reason for changing an approved record');
  select * into v_old from public.graduates where id = p_id for update;
  if not found then raise exception 'Record not found'; end if;
  if v_old.status <> 'approved' then raise exception 'This record is not approved; edit it normally'; end if;
  for k in select jsonb_object_keys(p_changes) loop
    if not k = any(allowed) then raise exception 'The field % can’t be changed here', k; end if;
  end loop;

  perform private.begin_action('edit_approved', trim(p_reason));
  update public.graduates g set
    full_name            = case when p_changes ? 'full_name' then p_changes ->> 'full_name' else g.full_name end,
    reg_number           = case when p_changes ? 'reg_number' then p_changes ->> 'reg_number' else g.reg_number end,
    programme_id         = case when p_changes ? 'programme_id' then (p_changes ->> 'programme_id')::uuid else g.programme_id end,
    cgpa                 = case when p_changes ? 'cgpa' then (p_changes ->> 'cgpa')::numeric else g.cgpa end,
    class_id             = case when p_changes ? 'class_id' then (p_changes ->> 'class_id')::uuid else g.class_id end,
    remark               = case when p_changes ? 'remark' then p_changes ->> 'remark' else g.remark end,
    graduation_session   = case when p_changes ? 'graduation_session' then p_changes ->> 'graduation_session' else g.graduation_session end,
    senate_approval_date = case when p_changes ? 'senate_approval_date' then (p_changes ->> 'senate_approval_date')::date else g.senate_approval_date end
  where g.id = p_id;
  perform private.begin_action('');
end $$;

-- Admins delete a record (any status), with a reason.
create function public.delete_record(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require(private.is_admin(), 'Only an Admin can delete records');
  perform private.require(length(trim(coalesce(p_reason, ''))) >= 5, 'Give a reason for deleting this record');
  perform private.begin_action('delete', trim(p_reason));
  delete from public.graduates where id = p_id;
  if not found then raise exception 'Record not found'; end if;
  perform private.begin_action('');
end $$;

-- Commits a validated upload in one transaction. Every row lands as PENDING.
-- Each row: action ('create' | 'update'), full_name, reg_number, programme_id, cgpa,
-- class_id, remark, graduation_session, senate_approval_date.
-- Updates are allowed only on PENDING records; approved duplicates must be skipped.
create function public.commit_import(
  p_file_name text, p_source public.record_source, p_rows jsonb,
  p_column_mapping jsonb default '{}'::jsonb, p_shared_values jsonb default '{}'::jsonb,
  p_report jsonb default '[]'::jsonb, p_skipped integer default 0, p_rejected integer default 0
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_batch   uuid;
  v_row     jsonb;
  v_n       integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
  v_old     public.graduates;
  v_id      uuid;
  v_reg     text;
begin
  perform private.require(private.can_write(), 'Only Records Officers and Admins can upload records');
  perform private.require(jsonb_typeof(p_rows) = 'array', 'No rows to import');
  perform private.require(jsonb_array_length(p_rows) between 1 and 10000, 'Upload between 1 and 10,000 records at a time');

  perform private.begin_action('import');
  insert into public.import_batches (file_name, source, uploaded_by, column_mapping, shared_values, report, skipped_count, rejected_count)
  values (left(p_file_name, 255), p_source, auth.uid(), p_column_mapping, p_shared_values, p_report,
          greatest(p_skipped, 0), greatest(p_rejected, 0))
  returning id into v_batch;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_n := v_n + 1;
    v_reg := private.normalise_reg(v_row ->> 'reg_number');
    begin
      if v_row ->> 'action' = 'update' then
        select * into v_old from public.graduates where reg_number = v_reg for update;
        if not found then raise exception 'Row %: % is not in the register, so it can’t be updated', v_n, v_reg; end if;
        if v_old.status <> 'pending' then
          raise exception 'Row %: % is already approved; change it from its record page with a reason', v_n, v_reg;
        end if;
        insert into public.import_batch_changes (batch_id, graduate_id, action, before)
        values (v_batch, v_old.id, 'updated', to_jsonb(v_old));
        update public.graduates set
          full_name = v_row ->> 'full_name',
          programme_id = (v_row ->> 'programme_id')::uuid,
          cgpa = nullif(v_row ->> 'cgpa', '')::numeric,
          class_id = nullif(v_row ->> 'class_id', '')::uuid,
          remark = v_row ->> 'remark',
          graduation_session = nullif(v_row ->> 'graduation_session', ''),
          senate_approval_date = nullif(v_row ->> 'senate_approval_date', '')::date,
          updated_by = auth.uid()
        where id = v_old.id;
        v_updated := v_updated + 1;
      else
        insert into public.graduates (full_name, reg_number, programme_id, cgpa, class_id, remark, graduation_session,
                                      senate_approval_date, status, source, import_batch_id, created_by, updated_by)
        values (v_row ->> 'full_name', v_reg, (v_row ->> 'programme_id')::uuid, nullif(v_row ->> 'cgpa', '')::numeric,
                nullif(v_row ->> 'class_id', '')::uuid, v_row ->> 'remark', nullif(v_row ->> 'graduation_session', ''),
                nullif(v_row ->> 'senate_approval_date', '')::date, 'pending', p_source, v_batch, auth.uid(), auth.uid())
        returning id into v_id;
        insert into public.import_batch_changes (batch_id, graduate_id, action) values (v_batch, v_id, 'created');
        v_created := v_created + 1;
      end if;
    exception
      when unique_violation then
        raise exception 'Row %: % is already in the register. Choose “update” or “skip” for it.', v_n, v_reg;
      when check_violation then
        raise exception 'Row % (%): a value is outside what the register accepts (%).', v_n, v_reg, sqlerrm;
      when not_null_violation then
        raise exception 'Row % (%): a required value (name, registration number or programme) is missing.', v_n, v_reg;
      when foreign_key_violation then
        raise exception 'Row % (%): the programme or class of degree no longer exists.', v_n, v_reg;
      when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
        raise exception 'Row % (%): % ', v_n, v_reg, sqlerrm;
    end;
  end loop;

  update public.import_batches set accepted_count = v_created, updated_count = v_updated where id = v_batch;
  perform private.begin_action('');
  return v_batch;
end $$;

-- Reverses an import, only while none of its records have changed since.
create function public.undo_import(p_batch_id uuid, p_reason text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_batch   public.import_batches;
  v_blocked text;
  v_n       integer;
begin
  perform private.require(private.is_admin(), 'Only an Admin can undo an import');
  perform private.require(length(trim(coalesce(p_reason, ''))) >= 5, 'Give a reason for undoing this import');
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Import not found'; end if;
  if v_batch.status = 'undone' then raise exception 'This import was already undone'; end if;

  -- Every record must still be exactly as the import left it.
  select string_agg(coalesce(g.reg_number, '(deleted record)'), ', ') into v_blocked
  from (
    select c.graduate_id from public.import_batch_changes c
    left join public.graduates g on g.id = c.graduate_id
    where c.batch_id = p_batch_id and (g.id is null or g.updated_at <> v_batch.uploaded_at)
    limit 10
  ) x left join public.graduates g on g.id = x.graduate_id;
  if v_blocked is not null then
    raise exception using errcode = '42501',
      message = 'These records changed after the import, so it can’t be undone automatically: ' || v_blocked;
  end if;

  perform private.begin_action('undo_import', trim(p_reason));
  delete from public.graduates g using public.import_batch_changes c
  where c.batch_id = p_batch_id and c.action = 'created' and g.id = c.graduate_id;
  get diagnostics v_n = row_count;

  update public.graduates g set
    full_name = b.full_name, programme_id = b.programme_id, cgpa = b.cgpa, class_id = b.class_id, remark = b.remark,
    graduation_session = b.graduation_session, senate_approval_date = b.senate_approval_date, updated_by = b.updated_by
  from public.import_batch_changes c, jsonb_populate_record(null::public.graduates, c.before) b
  where c.batch_id = p_batch_id and c.action = 'updated' and g.id = c.graduate_id;

  update public.import_batches
  set status = 'undone', undone_by = auth.uid(), undone_at = now(), undo_reason = trim(p_reason)
  where id = p_batch_id;
  perform private.begin_action('');
  return v_n;
end $$;

-- Every export is recorded: who, when, which filters, which columns, how many rows.
create function public.log_export(p_filters jsonb, p_columns text[], p_format text, p_row_count integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require(private.is_staff(), 'Only staff can export records');
  perform private.require(p_format in ('xlsx', 'pdf', 'csv'), 'Unknown export format');
  insert into public.audit_log (actor_id, action, table_name, details)
  values (auth.uid(), 'export', 'graduates',
          jsonb_build_object('filters', p_filters, 'columns', p_columns, 'format', p_format, 'rows', p_row_count));
end $$;

-- ===================================================== public lookups
-- Called only by the website's server. Rate-limits by hashed IP, logs the
-- attempt, and returns only fields that are safe to show the public.
create function private.lookup_allowed(p_ip_hash text) returns boolean
language sql stable set search_path = '' as $$
  select p_ip_hash is null
      or ((select count(*) from public.lookup_events where ip_hash = p_ip_hash and at > now() - interval '1 minute') < 10
          and (select count(*) from public.lookup_events where ip_hash = p_ip_hash and at > now() - interval '1 day') < 100)
$$;

create function private.public_result(g public.graduates)
returns table (
  result text, full_name text, programme text, award_title text, level public.programme_level,
  faculty text, class_of_degree text, graduation_session text, senate_approval_date date,
  certificate_serial text, verify_code text
) language sql stable set search_path = '' as $$
  select
    case
      when g.id is null then 'not_found'
      when g.source = 'legacy' and not (g.status = 'approved' and g.verification_status = 'verified') then 'under_review'
      when g.status = 'approved' and g.verification_status = 'verified' then 'verified'
      else 'not_found'
    end,
    case when g.status = 'approved' and g.verification_status = 'verified' then g.full_name end,
    case when g.status = 'approved' and g.verification_status = 'verified' then p.name end,
    case when g.status = 'approved' and g.verification_status = 'verified' then p.award_title end,
    case when g.status = 'approved' and g.verification_status = 'verified' then p.level end,
    case when g.status = 'approved' and g.verification_status = 'verified' then f.name end,
    case when g.status = 'approved' and g.verification_status = 'verified' then dc.label end,
    case when g.status = 'approved' and g.verification_status = 'verified' then g.graduation_session end,
    case when g.status = 'approved' and g.verification_status = 'verified' then g.senate_approval_date end,
    case when g.status = 'approved' and g.verification_status = 'verified' then g.certificate_serial end,
    case when g.status = 'approved' and g.verification_status = 'verified' then g.verify_code end
  from (select 1) one
  left join public.programmes p on p.id = g.programme_id
  left join public.departments d on d.id = p.department_id
  left join public.faculties f on f.id = d.faculty_id
  left join public.degree_classes dc on dc.id = g.class_id
$$;

create function public.lookup_by_code(p_code text, p_ip_hash text default null, p_country text default null, p_user_agent text default null)
returns table (
  result text, full_name text, programme text, award_title text, level public.programme_level,
  faculty text, class_of_degree text, graduation_session text, senate_approval_date date,
  certificate_serial text, verify_code text
) language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  g public.graduates;
  r record;
begin
  if not private.lookup_allowed(p_ip_hash) then
    insert into public.lookup_events (channel, result, ip_hash, country, user_agent) values ('code', 'rate_limited', p_ip_hash, left(p_country, 2), left(p_user_agent, 200));
    return query select 'rate_limited'::text, null::text, null::text, null::text, null::public.programme_level, null::text, null::text, null::text, null::date, null::text, null::text;
    return;
  end if;
  if coalesce(p_code, '') ~ '^[a-z2-9]{16}$' then
    select * into g from public.graduates gr where gr.verify_code = p_code;
  end if;
  select * into r from private.public_result(g);
  insert into public.lookup_events (channel, result, ip_hash, country, user_agent) values ('code', r.result, p_ip_hash, left(p_country, 2), left(p_user_agent, 200));
  return query select r.result, r.full_name, r.programme, r.award_title, r.level, r.faculty, r.class_of_degree, r.graduation_session, r.senate_approval_date, r.certificate_serial, r.verify_code;
end $$;

create function public.lookup_by_reg_and_surname(p_reg text, p_surname text, p_ip_hash text default null, p_country text default null, p_user_agent text default null)
returns table (
  result text, full_name text, programme text, award_title text, level public.programme_level,
  faculty text, class_of_degree text, graduation_session text, senate_approval_date date,
  certificate_serial text, verify_code text
) language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  g public.graduates;
  r record;
  v_surname text := private.surname_key(p_surname);
begin
  if not private.lookup_allowed(p_ip_hash) then
    insert into public.lookup_events (channel, result, ip_hash, country, user_agent) values ('reg', 'rate_limited', p_ip_hash, left(p_country, 2), left(p_user_agent, 200));
    return query select 'rate_limited'::text, null::text, null::text, null::text, null::public.programme_level, null::text, null::text, null::text, null::date, null::text, null::text;
    return;
  end if;
  if v_surname <> '' then
    select * into g from public.graduates gr where gr.reg_number = private.normalise_reg(p_reg) and gr.surname_key = v_surname;
  end if;
  select * into r from private.public_result(g);
  insert into public.lookup_events (channel, result, ip_hash, country, user_agent) values ('reg', r.result, p_ip_hash, left(p_country, 2), left(p_user_agent, 200));
  return query select r.result, r.full_name, r.programme, r.award_title, r.level, r.faculty, r.class_of_degree, r.graduation_session, r.senate_approval_date, r.certificate_serial, r.verify_code;
end $$;

-- Names of staff, for showing who created or approved a record. No emails.
create function public.staff_directory() returns table (user_id uuid, full_name text, role public.app_role, active boolean)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.full_name, p.role, p.active from public.profiles p where private.is_staff()
$$;

-- ============================================================ grants
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.current_app_role(),
  public.staff_directory(),
  public.save_staff_profile(uuid, text, text, public.app_role, boolean),
  public.approve_records(uuid[], date, text, text),
  public.verify_records(uuid[]),
  public.update_approved_record(uuid, jsonb, text),
  public.delete_record(uuid, text),
  public.commit_import(text, public.record_source, jsonb, jsonb, jsonb, jsonb, integer, integer),
  public.undo_import(uuid, text),
  public.log_export(jsonb, text[], text, integer)
to authenticated;

-- RLS policies and triggers call these helpers as the signed-in user.
grant usage on schema private to authenticated;
grant execute on function private.is_staff(), private.can_write(), private.is_admin(),
  private.surname_key(text), private.normalise_reg(text), private.touch_updated_at(), private.guard_graduate()
to authenticated;

-- Public lookups: the website's server only (service role). No anonymous access.
grant execute on function
  public.lookup_by_code(text, text, text, text),
  public.lookup_by_reg_and_surname(text, text, text, text, text)
to service_role;

-- Future tables and functions start locked too.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
