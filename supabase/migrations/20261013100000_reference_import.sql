-- Bulk load of faculties, departments and programmes from one spreadsheet.
-- Upserts by code, all or nothing. Super Admin only.
create function public.import_reference_rows(p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_row  jsonb;
  v_n    integer := 0;
  v_fac  uuid;
  v_dep  uuid;
  v_lvl  public.award_level;
begin
  if public.current_app_role() is distinct from 'super_admin' then
    raise exception 'Only a Super Admin can load programmes' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to import';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_n := v_n + 1;
    begin
      v_lvl := (v_row ->> 'award_level')::public.award_level;
    exception when others then
      raise exception 'Row %: level must be undergraduate or postgraduate', v_n;
    end;

    insert into public.faculties (code, name)
    values (upper(trim(v_row ->> 'faculty_code')), trim(v_row ->> 'faculty_name'))
    on conflict (code) do update set name = excluded.name
    returning id into v_fac;

    insert into public.departments (faculty_id, code, name)
    values (v_fac, upper(trim(v_row ->> 'department_code')), trim(v_row ->> 'department_name'))
    on conflict (code) do update set name = excluded.name, faculty_id = excluded.faculty_id
    returning id into v_dep;

    begin
      insert into public.programmes (department_id, code, name, award_title, award_level)
      values (v_dep, upper(trim(v_row ->> 'programme_code')), trim(v_row ->> 'programme_name'), trim(v_row ->> 'award_title'), v_lvl)
      on conflict (code) do update
        set department_id = excluded.department_id, name = excluded.name,
            award_title = excluded.award_title, award_level = excluded.award_level, active = true;
    exception
      when check_violation then
        raise exception 'Row %: a code or name is empty or has characters that are not allowed', v_n;
      when unique_violation then
        raise exception 'Row %: % already exists in % under another code', v_n, trim(v_row ->> 'programme_name'), trim(v_row ->> 'department_name');
    end;
  end loop;
  return v_n;
end $$;

-- Printed fields of programmes with issued certificates must never change underneath them.
create function private.freeze_issued_programme() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.name, new.award_title, new.award_level) is distinct from (old.name, old.award_title, old.award_level)
     and exists (select 1 from public.credentials where programme_id = old.id and status in ('approved', 'revoked', 'superseded')) then
    raise exception 'Programme % has issued certificates, so its name, award title and level cannot change', old.code;
  end if;
  return new;
end $$;

create trigger freeze_issued_programme before update on public.programmes
  for each row execute function private.freeze_issued_programme();

revoke execute on function public.import_reference_rows(jsonb) from public, anon;
revoke execute on function private.freeze_issued_programme() from public, anon, authenticated;
grant execute on function public.import_reference_rows(jsonb) to authenticated;
