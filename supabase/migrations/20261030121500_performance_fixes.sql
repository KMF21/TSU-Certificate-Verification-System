-- Performance fixes from the Supabase advisor.
-- 1. Evaluate the caller's identity once per query, not once per row.
-- 2. Index the staff and class columns that reference other tables.

drop policy "Staff read own profile, admins read all" on public.profiles;
create policy "Staff read own profile, admins read all" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy "Own or shared presets" on public.export_presets;
drop policy "Staff add own presets" on public.export_presets;
drop policy "Staff change own presets" on public.export_presets;
drop policy "Staff delete own presets" on public.export_presets;
create policy "Own or shared presets" on public.export_presets for select to authenticated
  using ((select private.is_staff()) and (owner_id = (select auth.uid()) or shared));
create policy "Staff add own presets" on public.export_presets for insert to authenticated
  with check ((select private.is_staff()) and owner_id = (select auth.uid()));
create policy "Staff change own presets" on public.export_presets for update to authenticated
  using ((select private.is_staff()) and owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Staff delete own presets" on public.export_presets for delete to authenticated
  using ((select private.is_staff()) and owner_id = (select auth.uid()));

-- Same treatment for the role checks on the busiest tables.
drop policy "Staff read records" on public.graduates;
drop policy "Officers add pending records" on public.graduates;
drop policy "Officers edit pending records" on public.graduates;
create policy "Staff read records" on public.graduates for select to authenticated using ((select private.is_staff()));
create policy "Officers add pending records" on public.graduates for insert to authenticated
  with check ((select private.can_write()) and status = 'pending');
create policy "Officers edit pending records" on public.graduates for update to authenticated
  using ((select private.can_write()) and status = 'pending')
  with check ((select private.can_write()) and status = 'pending');

drop policy "Audit visibility" on public.audit_log;
create policy "Audit visibility" on public.audit_log for select to authenticated
  using ((select private.is_admin()) or ((select private.is_staff()) and table_name = 'graduates'));

create index graduates_class_idx        on public.graduates (class_id);
create index graduates_created_by_idx   on public.graduates (created_by);
create index graduates_updated_by_idx   on public.graduates (updated_by);
create index graduates_approved_by_idx  on public.graduates (approved_by);
create index graduates_verified_by_idx  on public.graduates (verified_by);
create index import_batches_uploaded_by_idx on public.import_batches (uploaded_by);
create index import_batches_undone_by_idx   on public.import_batches (undone_by);

comment on table public.serial_counters is
  'Certificate serial counters. No policies on purpose: only the approve_records function reads or writes it.';
