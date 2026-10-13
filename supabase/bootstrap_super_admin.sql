-- Run ONCE in the Supabase SQL editor to create the first Super Admin.
-- 1. Authentication > Users > Add user > Create new user
--    (their email, a strong password, tick "Auto Confirm User").
-- 2. Replace the email and name below, then run this.
-- Every later account is created from the staff area by a Super Admin.
insert into public.profiles (user_id, full_name, email, role)
select id, 'Full Name Here', email, 'super_admin'
from auth.users
where email = 'ict.admin@tsuniversity.edu.ng'
on conflict (user_id) do update set role = 'super_admin', active = true;
