-- Read helpers for the staff screens. Both run with the caller's rights,
-- so row-level security still decides what each person can see.

-- One flat row per record with its programme, department, faculty and class,
-- so the records table and exports can filter on any of them.
create view public.register_view with (security_invoker = on) as
select
  g.id,
  g.full_name,
  g.reg_number,
  g.cgpa,
  g.remark,
  g.graduation_session,
  g.senate_approval_date,
  g.status,
  g.source,
  g.verification_status,
  g.import_batch_id,
  g.is_sample,
  g.certificate_serial,
  g.verify_code,
  g.created_by,
  g.created_at,
  g.updated_by,
  g.updated_at,
  g.approved_by,
  g.approved_at,
  g.verified_by,
  g.verified_at,
  g.class_id,
  dc.label       as class_of_degree,
  p.id           as programme_id,
  p.code         as programme_code,
  p.name         as programme_name,
  p.award_title,
  p.level,
  d.id           as department_id,
  d.name         as department_name,
  f.id           as faculty_id,
  f.name         as faculty_name
from public.graduates g
join public.programmes p on p.id = g.programme_id
join public.departments d on d.id = p.department_id
join public.faculties f on f.id = d.faculty_id
left join public.degree_classes dc on dc.id = g.class_id;

revoke all on public.register_view from anon, authenticated;
grant select on public.register_view to authenticated;

-- Dashboard figures in one round trip.
create function public.register_stats() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'total',              (select count(*) from public.graduates),
    'pending',            (select count(*) from public.graduates where status = 'pending'),
    'approved',           (select count(*) from public.graduates where status = 'approved'),
    'legacy_unverified',  (select count(*) from public.graduates where source = 'legacy' and verification_status = 'unverified'),
    'sample',             (select count(*) from public.graduates where is_sample),
    'by_session', coalesce((
      select jsonb_agg(jsonb_build_object('session', s, 'approved', a, 'pending', p) order by s desc)
      from (
        select coalesce(graduation_session, 'Not set') s,
               count(*) filter (where status = 'approved') a,
               count(*) filter (where status = 'pending') p
        from public.graduates group by 1
      ) x), '[]'::jsonb),
    'by_faculty', coalesce((
      select jsonb_agg(jsonb_build_object('faculty', fname, 'approved', a, 'pending', p) order by a + p desc, fname)
      from (
        select f.name fname,
               count(*) filter (where g.status = 'approved') a,
               count(*) filter (where g.status = 'pending') p
        from public.graduates g
        join public.programmes pr on pr.id = g.programme_id
        join public.departments d on d.id = pr.department_id
        join public.faculties f on f.id = d.faculty_id
        group by f.name
      ) y), '[]'::jsonb)
  )
$$;

revoke execute on function public.register_stats() from public, anon;
grant execute on function public.register_stats() to authenticated;
