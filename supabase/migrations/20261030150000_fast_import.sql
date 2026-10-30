-- Faster bulk import. The first version wrote rows one at a time, which takes
-- several seconds for large files and can hit the API's statement time limit.
-- This version checks every row up front (reporting spreadsheet-style row
-- numbers), then writes all rows in a few set-based statements. Still one
-- transaction: either the whole file goes in, or nothing does.
create or replace function public.commit_import(
  p_file_name text, p_source public.record_source, p_rows jsonb,
  p_column_mapping jsonb default '{}'::jsonb, p_shared_values jsonb default '{}'::jsonb,
  p_report jsonb default '[]'::jsonb, p_skipped integer default 0, p_rejected integer default 0
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_batch   uuid;
  v_problem text;
  v_created integer;
  v_updated integer;
begin
  perform private.require(private.can_write(), 'Only Records Officers and Admins can upload records');
  perform private.require(jsonb_typeof(p_rows) = 'array', 'No rows to import');
  perform private.require(jsonb_array_length(p_rows) between 1 and 10000, 'Upload between 1 and 10,000 records at a time');

  create temp table if not exists pg_temp.import_rows (
    n integer, row_label text, action text, copies integer, full_name text, reg_number text, programme_id uuid, cgpa numeric,
    class_id uuid, remark text, graduation_session text, senate_approval_date date
  ) on commit drop;
  truncate pg_temp.import_rows;

  -- Parse. A malformed value stops the import with the row it came from.
  begin
    insert into pg_temp.import_rows
    select x.n,
           coalesce(nullif(r ->> 'row', ''), x.n::text),
           coalesce(nullif(r ->> 'action', ''), 'create'),
           0,
           regexp_replace(trim(coalesce(r ->> 'full_name', '')), '\s+', ' ', 'g'),
           private.normalise_reg(r ->> 'reg_number'),
           nullif(r ->> 'programme_id', '')::uuid,
           nullif(r ->> 'cgpa', '')::numeric,
           nullif(r ->> 'class_id', '')::uuid,
           nullif(trim(coalesce(r ->> 'remark', '')), ''),
           nullif(trim(coalesce(r ->> 'graduation_session', '')), ''),
           nullif(r ->> 'senate_approval_date', '')::date
    from jsonb_array_elements(p_rows) with ordinality as x(r, n);
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
    raise exception 'A value in the file couldn’t be read (%). Check the preview and try again.', sqlerrm;
  end;

  update pg_temp.import_rows i set copies = c.k
  from (select reg_number, count(*) k from pg_temp.import_rows group by reg_number) c
  where c.reg_number = i.reg_number;
  analyze pg_temp.import_rows;

  -- Check every row; report the first few problems by row number.
  select string_agg(msg, '; ' order by n) into v_problem from (
    select n, msg from (
      select n, 'Row ' || row_label || ': ' || m as msg
      from pg_temp.import_rows i,
      lateral (values
        (case when action not in ('create', 'update') then 'unknown action ' || action end),
        (case when length(full_name) < 3 then 'name is missing' end),
        (case when reg_number !~ '^[A-Z0-9][A-Z0-9/.-]{2,39}$' then 'registration number is missing or has invalid characters' end),
        (case when programme_id is null then 'programme is missing'
              when not exists (select 1 from public.programmes p where p.id = i.programme_id) then 'programme no longer exists' end),
        (case when class_id is not null and not exists (select 1 from public.degree_classes c where c.id = i.class_id) then 'class of degree no longer exists' end),
        (case when cgpa is not null and (cgpa < 0 or cgpa > 5) then 'CGPA must be between 0.00 and 5.00' end),
        (case when graduation_session is null then null
              when graduation_session !~ '^\d{4}/\d{4}$' then 'session must be two consecutive years, like 2024/2025'
              when split_part(graduation_session, '/', 2)::int <> split_part(graduation_session, '/', 1)::int + 1
              then 'session must be two consecutive years, like 2024/2025' end),
        (case when senate_approval_date > current_date then 'Senate approval date is in the future'
              when senate_approval_date < date '2008-01-01' then 'Senate approval date is before 2008' end),
        (case when copies > 1
              then reg_number || ' appears more than once in the file' end),
        (case when action = 'create' and exists (select 1 from public.graduates g where g.reg_number = i.reg_number)
              then reg_number || ' is already in the register; choose update or skip' end),
        (case when action = 'update' and not exists (select 1 from public.graduates g where g.reg_number = i.reg_number)
              then reg_number || ' is not in the register, so it can’t be updated' end),
        (case when action = 'update' and exists (select 1 from public.graduates g where g.reg_number = i.reg_number and g.status <> 'pending')
              then reg_number || ' is already approved; change it from its record page with a reason' end)
      ) as v(m)
      where m is not null
    ) all_problems
    order by n
    limit 5
  ) first_problems;
  if v_problem is not null then
    raise exception 'Nothing was imported. %', v_problem using errcode = '22023';
  end if;

  perform private.begin_action('import');
  insert into public.import_batches (file_name, source, uploaded_by, column_mapping, shared_values, report, skipped_count, rejected_count)
  values (left(p_file_name, 255), p_source, auth.uid(), p_column_mapping, p_shared_values, p_report,
          greatest(p_skipped, 0), greatest(p_rejected, 0))
  returning id into v_batch;

  -- Updates: keep the old values for undo, then apply.
  insert into public.import_batch_changes (batch_id, graduate_id, action, before)
  select v_batch, g.id, 'updated', to_jsonb(g)
  from public.graduates g join pg_temp.import_rows i on i.reg_number = g.reg_number and i.action = 'update';

  update public.graduates g set
    full_name = i.full_name, programme_id = i.programme_id, cgpa = i.cgpa, class_id = i.class_id, remark = i.remark,
    graduation_session = i.graduation_session, senate_approval_date = i.senate_approval_date
  from pg_temp.import_rows i
  where i.action = 'update' and g.reg_number = i.reg_number and g.status = 'pending';
  get diagnostics v_updated = row_count;

  -- New records, all pending.
  with created as (
    insert into public.graduates (full_name, reg_number, programme_id, cgpa, class_id, remark, graduation_session,
                                  senate_approval_date, status, source, import_batch_id, created_by, updated_by)
    select full_name, reg_number, programme_id, cgpa, class_id, remark, graduation_session, senate_approval_date,
           'pending', p_source, v_batch, auth.uid(), auth.uid()
    from pg_temp.import_rows where action = 'create' order by n
    returning id
  )
  insert into public.import_batch_changes (batch_id, graduate_id, action)
  select v_batch, id, 'created' from created;
  get diagnostics v_created = row_count;

  update public.import_batches set accepted_count = v_created, updated_count = v_updated where id = v_batch;
  perform private.begin_action('');
  return v_batch;
end $$;

revoke execute on function public.commit_import(text, public.record_source, jsonb, jsonb, jsonb, jsonb, integer, integer) from public, anon;
grant execute on function public.commit_import(text, public.record_source, jsonb, jsonb, jsonb, jsonb, integer, integer) to authenticated;
