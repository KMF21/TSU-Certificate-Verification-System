-- TSU Certificate Verification System: core register.
-- Tables, row-level security, audit trail, and the workflow functions
-- (import -> submit -> approve/reject) plus the public lookup functions.
--
-- Security model
--   * Browsers never write tables directly. Staff writes go through
--     SECURITY DEFINER functions that check the caller's role.
--   * Staff roles only count at assurance level aal2 (two-factor sign-in).
--   * Anonymous visitors can only call the two public lookup functions,
--     which return the fields printed on a certificate, with the matric
--     number partly masked.
--   * The audit log is insert-only, written by triggers.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------- types
create type public.app_role as enum (
  'records_officer',       -- Exams & Records: undergraduate batches
  'cpgs_records_officer',  -- College of Postgraduate Studies: postgraduate batches
  'registrar',             -- approves or rejects batches
  'auditor',               -- read-only
  'super_admin'            -- users and reference data; cannot approve
);
create type public.award_level as enum ('undergraduate', 'postgraduate');
create type public.batch_status as enum ('draft', 'pending', 'approved', 'rejected');
create type public.credential_status as enum ('draft', 'pending', 'approved', 'revoked', 'superseded');

-- --------------------------------------------------------------- tables
create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(trim(full_name)) between 2 and 120),
  email      text not null,
  role       public.app_role not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.faculties (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-Z0-9]{2,12}$'),
  name       text not null unique check (length(trim(name)) between 3 and 160),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties (id),
  code       text not null unique check (code ~ '^[A-Z0-9]{2,12}$'),
  name       text not null check (length(trim(name)) between 3 and 160),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (faculty_id, name)
);

create table public.programmes (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id),
  code          text not null unique check (code ~ '^[A-Z0-9-]{2,16}$'),
  name          text not null check (length(trim(name)) between 2 and 160),
  award_title   text not null check (length(trim(award_title)) between 3 and 120),
  award_level   public.award_level not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (department_id, name, award_title)
);

create table public.graduates (
  id            uuid primary key default gen_random_uuid(),
  surname       text not null check (length(trim(surname)) between 1 and 80),
  other_names   text not null check (length(trim(other_names)) between 1 and 120),
  matric_no     text not null unique check (matric_no = upper(matric_no) and matric_no ~ '^[A-Z0-9][A-Z0-9/-]{3,39}$'),
  date_of_birth date,
  email         text,
  phone         text,
  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.batches (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(trim(title)) between 3 and 160),
  award_level     public.award_level not null,
  session         text not null check (session ~ '^\d{4}/\d{4}$'),
  status          public.batch_status not null default 'draft',
  created_by      uuid not null references auth.users (id),
  submitted_by    uuid references auth.users (id),
  submitted_at    timestamptz,
  decided_by      uuid references auth.users (id),
  decided_at      timestamptz,
  decision_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.credentials (
  id              uuid primary key default gen_random_uuid(),
  graduate_id     uuid not null references public.graduates (id),
  programme_id    uuid not null references public.programmes (id),
  batch_id        uuid not null references public.batches (id),
  class_of_degree text check (class_of_degree in (
    'First Class Honours',
    'Second Class Honours (Upper Division)',
    'Second Class Honours (Lower Division)',
    'Third Class Honours',
    'Pass',
    'Distinction',
    'Merit'
  )),
  date_of_award   date not null check (date_of_award between date '2008-01-01' and current_date + 365),
  status          public.credential_status not null default 'draft',
  serial_no       text unique,
  verify_code     text unique check (verify_code ~ '^[a-z2-9]{16}$'),
  key_id          text,
  issued_at       timestamptz,
  revoked_at      timestamptz,
  revoke_reason   text,
  superseded_by   uuid references public.credentials (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Issued credentials always carry a serial and code; unissued ones never do.
  constraint issued_has_identity check (
    (status in ('draft', 'pending')) = (serial_no is null and verify_code is null)
  )
);

-- One live award per graduate per programme. Corrections supersede, never duplicate.
create unique index credentials_one_live_award
  on public.credentials (graduate_id, programme_id) where status <> 'superseded';
create index credentials_batch_idx on public.credentials (batch_id);
create index credentials_status_idx on public.credentials (status);

create table public.serial_counters (
  series     text primary key,          -- e.g. UG-2025, PG-2025
  last_value integer not null default 0 check (last_value >= 0)
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  action     text not null,
  table_name text not null,
  row_id     uuid,
  before     jsonb,
  after      jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id);

create table public.verification_events (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  channel       text not null check (channel in ('qr', 'link', 'details', 'token')),
  code_tried    text,
  credential_id uuid references public.credentials (id),
  result        text not null check (result in ('verified', 'revoked', 'superseded', 'not_found')),
  signature     text check (signature in ('valid', 'invalid', 'unknown_key', 'stale')),
  country       text,
  user_agent    text,
  ip_hash       text
);
create index verification_events_at_idx on public.verification_events (at desc);

-- ------------------------------------------------- helpers and triggers
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
  insert into public.audit_log (actor_id, action, table_name, row_id, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(r ->> 'id', r ->> 'user_id')::uuid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

create function private.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'The audit log cannot be changed';
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','faculties','departments','programmes','graduates','batches','credentials'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function private.audit_row()', t);
  end loop;
end $$;

create trigger audit_log_is_append_only
  before update or delete on public.audit_log
  for each statement execute function private.forbid_change();
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.forbid_change();

-- The caller's role, only when signed in with a second factor (aal2).
create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid()
    and p.active
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create function private.can_edit_level(lvl public.award_level) returns boolean
language sql stable security definer set search_path = '' as $$
  select case public.current_app_role()
    when 'records_officer' then lvl = 'undergraduate'
    when 'cpgs_records_officer' then lvl = 'postgraduate'
    else false
  end
$$;

create function private.mask_matric(m text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  parts text[] := string_to_array(m, '/');
  keep  int := case when parts[2] = 'PG' then 3 else 2 end;
  rest  text;
begin
  if coalesce(array_length(parts, 1), 0) <= keep then
    return regexp_replace(left(m, greatest(length(m) - 2, 0)), '[^/]', '•', 'g') || right(m, 2);
  end if;
  rest := array_to_string(parts[keep + 1:], '/');
  return array_to_string(parts[1:keep], '/') || '/'
    || regexp_replace(left(rest, length(rest) - 2), '[^/]', '•', 'g')
    || right(rest, 2);
end $$;

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
    exit when not exists (select 1 from public.credentials where verify_code = s);
  end loop;
  return s;
end $$;

-- --------------------------------------------- row-level security
alter table public.profiles            enable row level security;
alter table public.faculties           enable row level security;
alter table public.departments         enable row level security;
alter table public.programmes          enable row level security;
alter table public.graduates           enable row level security;
alter table public.batches             enable row level security;
alter table public.credentials         enable row level security;
alter table public.serial_counters     enable row level security;
alter table public.audit_log           enable row level security;
alter table public.verification_events enable row level security;

-- Start from nothing, then grant only reads. Writes go through functions.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.faculties, public.departments, public.programmes,
  public.graduates, public.batches, public.credentials, public.audit_log, public.verification_events
  to authenticated;
revoke update, delete, truncate on public.audit_log from service_role;

create policy "Own profile, or all for admins" on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.current_app_role() in ('super_admin', 'auditor', 'registrar'));

create policy "Staff read faculties" on public.faculties for select to authenticated
  using (public.current_app_role() is not null);
create policy "Staff read departments" on public.departments for select to authenticated
  using (public.current_app_role() is not null);
create policy "Staff read programmes" on public.programmes for select to authenticated
  using (public.current_app_role() is not null);
create policy "Staff read graduates" on public.graduates for select to authenticated
  using (public.current_app_role() is not null);
create policy "Staff read batches" on public.batches for select to authenticated
  using (public.current_app_role() is not null);
create policy "Staff read credentials" on public.credentials for select to authenticated
  using (public.current_app_role() is not null);
create policy "Oversight reads audit log" on public.audit_log for select to authenticated
  using (public.current_app_role() in ('registrar', 'auditor', 'super_admin'));
create policy "Oversight reads verification events" on public.verification_events for select to authenticated
  using (public.current_app_role() in ('registrar', 'auditor', 'super_admin'));

-- ------------------------------------------------- reference data writes
create function public.save_faculty(p_id uuid, p_code text, p_name text, p_active boolean default true)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if public.current_app_role() is distinct from 'super_admin' then
    raise exception 'Only a Super Admin can change faculties' using errcode = '42501';
  end if;
  if p_id is null then
    insert into public.faculties (code, name, active) values (upper(trim(p_code)), trim(p_name), p_active) returning id into v_id;
  else
    update public.faculties set code = upper(trim(p_code)), name = trim(p_name), active = p_active where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create function public.save_department(p_id uuid, p_faculty_id uuid, p_code text, p_name text, p_active boolean default true)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if public.current_app_role() is distinct from 'super_admin' then
    raise exception 'Only a Super Admin can change departments' using errcode = '42501';
  end if;
  if p_id is null then
    insert into public.departments (faculty_id, code, name, active)
    values (p_faculty_id, upper(trim(p_code)), trim(p_name), p_active) returning id into v_id;
  else
    update public.departments set faculty_id = p_faculty_id, code = upper(trim(p_code)), name = trim(p_name), active = p_active
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create function public.save_programme(
  p_id uuid, p_department_id uuid, p_code text, p_name text, p_award_title text,
  p_award_level public.award_level, p_active boolean default true
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if public.current_app_role() is distinct from 'super_admin' then
    raise exception 'Only a Super Admin can change programmes' using errcode = '42501';
  end if;
  if p_id is null then
    insert into public.programmes (department_id, code, name, award_title, award_level, active)
    values (p_department_id, upper(trim(p_code)), trim(p_name), trim(p_award_title), p_award_level, p_active)
    returning id into v_id;
  else
    -- Printed fields of programmes with issued certificates are frozen.
    if exists (
      select 1 from public.credentials c join public.programmes p on p.id = c.programme_id
      where c.programme_id = p_id and c.status in ('approved', 'revoked', 'superseded')
        and (p.name <> trim(p_name) or p.award_title <> trim(p_award_title) or p.award_level <> p_award_level)
    ) then
      raise exception 'This programme has issued certificates, so its name, award title and level cannot change';
    end if;
    update public.programmes
    set department_id = p_department_id, code = upper(trim(p_code)), name = trim(p_name),
        award_title = trim(p_award_title), award_level = p_award_level, active = p_active
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

-- ------------------------------------------------------ batch workflow
create function public.create_batch(p_title text, p_award_level public.award_level, p_session text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.can_edit_level(p_award_level) then
    raise exception 'Your role cannot create % batches', p_award_level using errcode = '42501';
  end if;
  insert into public.batches (title, award_level, session, created_by)
  values (trim(p_title), p_award_level, trim(p_session), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Loads rows into a draft batch. All or nothing: any bad row aborts the whole import.
-- Each row: surname, other_names, matric_no, programme_code, class_of_degree,
--           date_of_award (yyyy-mm-dd), and optional date_of_birth, email, phone.
create function public.import_batch_rows(p_batch_id uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_batch   public.batches;
  v_prog    public.programmes;
  v_grad    public.graduates;
  v_row     jsonb;
  v_n       integer := 0;
  v_matric  text;
  v_class   text;
begin
  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if not private.can_edit_level(v_batch.award_level) then
    raise exception 'Your role cannot edit this batch' using errcode = '42501';
  end if;
  if v_batch.status not in ('draft', 'rejected') then
    raise exception 'Only draft or rejected batches can be changed';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to import';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'Import at most 5,000 rows at a time';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_n := v_n + 1;
    v_matric := upper(regexp_replace(coalesce(v_row ->> 'matric_no', ''), '\s', '', 'g'));
    v_class := nullif(trim(coalesce(v_row ->> 'class_of_degree', '')), '');

    select * into v_prog from public.programmes
    where code = upper(trim(coalesce(v_row ->> 'programme_code', ''))) and active;
    if not found then
      raise exception 'Row %: programme code "%" is not in the programme list', v_n, v_row ->> 'programme_code';
    end if;
    if v_prog.award_level <> v_batch.award_level then
      raise exception 'Row %: programme % is % but this batch is %', v_n, v_prog.code, v_prog.award_level, v_batch.award_level;
    end if;
    if v_batch.award_level = 'undergraduate' and v_class is null then
      raise exception 'Row %: class of degree is required for undergraduate awards', v_n;
    end if;

    select * into v_grad from public.graduates where matric_no = v_matric;
    if found then
      if lower(v_grad.surname) <> lower(trim(v_row ->> 'surname'))
         or lower(v_grad.other_names) <> lower(trim(v_row ->> 'other_names')) then
        raise exception 'Row %: matric number % is already registered to % %', v_n, v_matric, upper(v_grad.surname), v_grad.other_names;
      end if;
    else
      insert into public.graduates (surname, other_names, matric_no, date_of_birth, email, phone, created_by)
      values (
        trim(v_row ->> 'surname'),
        trim(v_row ->> 'other_names'),
        v_matric,
        nullif(v_row ->> 'date_of_birth', '')::date,
        nullif(trim(coalesce(v_row ->> 'email', '')), ''),
        nullif(trim(coalesce(v_row ->> 'phone', '')), ''),
        auth.uid()
      )
      returning * into v_grad;
    end if;

    begin
      insert into public.credentials (graduate_id, programme_id, batch_id, class_of_degree, date_of_award)
      values (v_grad.id, v_prog.id, p_batch_id, v_class, (v_row ->> 'date_of_award')::date);
    exception when unique_violation then
      raise exception 'Row %: % already has a % % record', v_n, v_matric, v_prog.award_title, v_prog.name;
    end;
  end loop;

  if v_batch.status = 'rejected' then
    update public.batches set status = 'draft' where id = p_batch_id;
  end if;
  return v_n;
end $$;

create function public.remove_draft_credential(p_credential_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_level public.award_level; v_status public.batch_status;
begin
  select b.award_level, b.status into v_level, v_status
  from public.credentials c join public.batches b on b.id = c.batch_id
  where c.id = p_credential_id and c.status = 'draft';
  if not found then raise exception 'Only draft records can be removed'; end if;
  if not private.can_edit_level(v_level) then raise exception 'Your role cannot edit this batch' using errcode = '42501'; end if;
  if v_status not in ('draft', 'rejected') then raise exception 'Only draft or rejected batches can be changed'; end if;
  delete from public.credentials where id = p_credential_id;
end $$;

create function public.delete_draft_batch(p_batch_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_batch public.batches;
begin
  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if not private.can_edit_level(v_batch.award_level) then raise exception 'Your role cannot edit this batch' using errcode = '42501'; end if;
  if v_batch.status not in ('draft', 'rejected') then raise exception 'Only draft or rejected batches can be deleted'; end if;
  delete from public.credentials where batch_id = p_batch_id;
  delete from public.batches where id = p_batch_id;
end $$;

create function public.submit_batch(p_batch_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_batch public.batches;
begin
  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if not private.can_edit_level(v_batch.award_level) then raise exception 'Your role cannot submit this batch' using errcode = '42501'; end if;
  if v_batch.status not in ('draft', 'rejected') then raise exception 'Only draft or rejected batches can be submitted'; end if;
  if not exists (select 1 from public.credentials where batch_id = p_batch_id) then
    raise exception 'Add at least one record before submitting';
  end if;
  update public.credentials set status = 'pending' where batch_id = p_batch_id;
  update public.batches
  set status = 'pending', submitted_by = auth.uid(), submitted_at = now(),
      decided_by = null, decided_at = null, decision_reason = null
  where id = p_batch_id;
end $$;

-- Approval issues every record: serial number, verify code, signing key id.
-- The person who submitted a batch can never approve it.
create function public.approve_batch(p_batch_id uuid, p_key_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_batch  public.batches;
  v_cred   record;
  v_series text;
  v_year   text;
  v_next   integer;
  v_n      integer := 0;
begin
  if public.current_app_role() is distinct from 'registrar' then
    raise exception 'Only the Registrar can approve batches' using errcode = '42501';
  end if;
  if coalesce(trim(p_key_id), '') = '' then raise exception 'A signing key id is required'; end if;

  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if v_batch.status <> 'pending' then raise exception 'Only batches awaiting approval can be approved'; end if;
  if v_batch.submitted_by = auth.uid() then raise exception 'You submitted this batch, so someone else must approve it'; end if;

  for v_cred in
    select c.id, c.date_of_award
    from public.credentials c join public.graduates g on g.id = c.graduate_id
    where c.batch_id = p_batch_id and c.status = 'pending'
    order by g.surname, g.other_names, g.matric_no
  loop
    v_year := extract(year from v_cred.date_of_award)::text;
    v_series := case v_batch.award_level when 'postgraduate' then 'PG-' else 'UG-' end || v_year;
    insert into public.serial_counters as s (series, last_value) values (v_series, 1)
    on conflict (series) do update set last_value = s.last_value + 1
    returning last_value into v_next;

    update public.credentials
    set status = 'approved',
        serial_no = case v_batch.award_level when 'postgraduate' then 'TSU/PG/' else 'TSU/' end
                    || v_year || '/' || lpad(v_next::text, 6, '0'),
        verify_code = private.new_verify_code(),
        key_id = trim(p_key_id),
        issued_at = now()
    where id = v_cred.id;
    v_n := v_n + 1;
  end loop;

  update public.batches set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = p_batch_id;
  return v_n;
end $$;

create function public.reject_batch(p_batch_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_batch public.batches;
begin
  if public.current_app_role() is distinct from 'registrar' then
    raise exception 'Only the Registrar can reject batches' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Give a reason so the Records Officer knows what to fix'; end if;
  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if v_batch.status <> 'pending' then raise exception 'Only batches awaiting approval can be rejected'; end if;
  update public.credentials set status = 'draft' where batch_id = p_batch_id;
  update public.batches
  set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_reason = trim(p_reason)
  where id = p_batch_id;
end $$;

-- --------------------------------------------------- public lookups
create view private.public_credentials as
select
  c.id,
  c.verify_code,
  c.serial_no,
  upper(g.surname) || ', ' || g.other_names as full_name,
  g.matric_no,
  private.mask_matric(g.matric_no) as matric_masked,
  f.name as faculty,
  d.name as department,
  p.name as programme,
  p.award_title,
  p.award_level,
  c.class_of_degree,
  b.session,
  c.date_of_award,
  c.status,
  c.revoked_at,
  s.verify_code as superseded_by_code
from public.credentials c
join public.graduates g on g.id = c.graduate_id
join public.programmes p on p.id = c.programme_id
join public.departments d on d.id = p.department_id
join public.faculties f on f.id = d.faculty_id
join public.batches b on b.id = c.batch_id
left join public.credentials s on s.id = c.superseded_by
where c.status in ('approved', 'revoked', 'superseded');

revoke all on private.public_credentials from public, anon, authenticated;

create function public.verify_by_code(p_code text)
returns table (
  verify_code text, serial_no text, full_name text, matric_masked text, faculty text, department text,
  programme text, award_title text, award_level public.award_level, class_of_degree text, session text,
  date_of_award date, status public.credential_status, revoked_at timestamptz, superseded_by_code text
) language sql stable security definer set search_path = '' as $$
  select v.verify_code, v.serial_no, v.full_name, v.matric_masked, v.faculty, v.department, v.programme,
         v.award_title, v.award_level, v.class_of_degree, v.session, v.date_of_award, v.status, v.revoked_at,
         v.superseded_by_code
  from private.public_credentials v
  where p_code ~ '^[a-z2-9]{16}$' and v.verify_code = p_code
$$;

create function public.verify_by_serial_and_matric(p_serial text, p_matric text)
returns table (
  verify_code text, serial_no text, full_name text, matric_masked text, faculty text, department text,
  programme text, award_title text, award_level public.award_level, class_of_degree text, session text,
  date_of_award date, status public.credential_status, revoked_at timestamptz, superseded_by_code text
) language sql stable security definer set search_path = '' as $$
  select v.verify_code, v.serial_no, v.full_name, v.matric_masked, v.faculty, v.department, v.programme,
         v.award_title, v.award_level, v.class_of_degree, v.session, v.date_of_award, v.status, v.revoked_at,
         v.superseded_by_code
  from private.public_credentials v
  where v.serial_no = upper(regexp_replace(p_serial, '\s', '', 'g'))
    and v.matric_no = upper(regexp_replace(p_matric, '\s', '', 'g'))
$$;

-- ------------------------------------------------- function grants
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function public.verify_by_code(text) to anon, authenticated;
grant execute on function public.verify_by_serial_and_matric(text, text) to anon, authenticated;
grant execute on function
  public.current_app_role(),
  public.save_faculty(uuid, text, text, boolean),
  public.save_department(uuid, uuid, text, text, boolean),
  public.save_programme(uuid, uuid, text, text, text, public.award_level, boolean),
  public.create_batch(text, public.award_level, text),
  public.import_batch_rows(uuid, jsonb),
  public.remove_draft_credential(uuid),
  public.delete_draft_batch(uuid),
  public.submit_batch(uuid),
  public.approve_batch(uuid, text),
  public.reject_batch(uuid, text)
to authenticated;
