-- Staff account roles, managed by Super Admins through one audited function.
create function public.save_staff_profile(
  p_user_id uuid, p_full_name text, p_email text, p_role public.app_role, p_active boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.current_app_role() is distinct from 'super_admin' then
    raise exception 'Only a Super Admin can manage staff accounts' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'No sign-in account exists for that user';
  end if;
  if p_user_id = auth.uid() and (p_role <> 'super_admin' or not p_active) then
    raise exception 'You can’t remove your own Super Admin access. Ask another Super Admin.';
  end if;
  insert into public.profiles (user_id, full_name, email, role, active)
  values (p_user_id, trim(p_full_name), lower(trim(p_email)), p_role, p_active)
  on conflict (user_id) do update
    set full_name = excluded.full_name, email = excluded.email, role = excluded.role, active = excluded.active;
end $$;

revoke execute on function public.save_staff_profile(uuid, text, text, public.app_role, boolean) from public, anon;
grant execute on function public.save_staff_profile(uuid, text, text, public.app_role, boolean) to authenticated;
