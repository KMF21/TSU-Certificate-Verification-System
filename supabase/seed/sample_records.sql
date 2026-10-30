-- 40 FICTIONAL graduate records for testing. Not real people.
-- Remove them all with supabase/seed/remove_sample_records.sql.
insert into public.graduates (full_name, reg_number, programme_id, cgpa, class_id, remark, graduation_session,
  senate_approval_date, status, source, is_sample, certificate_serial, verify_code, key_id, approved_at)
select v.full_name, v.reg_number, p.id, v.cgpa, dc.id, v.remark, v.graduation_session, v.senate_approval_date::date,
  v.status::public.record_status, v.source::public.record_source, true, v.certificate_serial, v.verify_code, v.key_id,
  case when v.status = 'approved' then v.senate_approval_date::date + time '12:00' end
from (values
  ('JAURO Ibrahim Kyari', 'TSU/PG/22/ECO/0001', 'MSC-ECONO', 3.07, null, null, '2024/2025', '2025-11-20', 'approved', 'live', 'TSU/PG/2025/000001', '6jxjdmkqeyefcake', 'tsu-demo-2026'),
  ('ISA Mary Kyari', 'TSU/PG/21/PH/0002', 'MPH-PH', 3.18, 'Distinction', 'Graduated with distinction', '2023/2024', '2024-12-12', 'approved', 'live', 'TSU/PG/2024/000001', 'mp73sf7whky87puw', 'tsu-demo-2026'),
  ('JOSEPH Rebecca Joy', 'TSU/PG/22/CS/0003', 'MSC-CS', 4.78, 'Merit', 'Graduated', '2024/2025', '2025-11-20', 'approved', 'live', 'TSU/PG/2025/000002', 'sv5g2evzcd5shc48', 'tsu-demo-2026'),
  ('AGBU Naomi Ladi', 'TSU/PG/20/HIS/0004', 'MA-HISTO', 3.18, 'Pass', 'Graduated', '2022/2023', '2023-11-09', 'approved', 'live', 'TSU/PG/2023/000001', 'czxdgqwjh3md6jvj', 'tsu-demo-2026'),
  ('KASSAM Comfort Yakubu', 'TSU/PG/21/ERM/0005', 'MSC-ERM', 3.69, 'Merit', 'Graduated', '2023/2024', '2024-12-12', 'approved', 'live', 'TSU/PG/2024/000002', 'b92zw5nsrem5abp5', 'tsu-demo-2026'),
  ('EMMANUEL Zainab', 'TSU/PG/19/PH/0006', 'MPH-PH', 4.76, 'Credit', 'Graduated', '2021/2022', '2022-11-17', 'approved', 'live', 'TSU/PG/2022/000001', 'ezgpwfxcgck2kqv3', 'tsu-demo-2026'),
  ('YAKUBU Musa Yakubu', 'TSU/PG/21/SC/0007', 'MSC-SC', 4.77, 'Credit', 'Graduated', '2023/2024', '2024-12-12', 'approved', 'live', 'TSU/PG/2024/000003', 'dfhm5btmy9z9kere', 'tsu-demo-2026'),
  ('GARBA Sani Tanko', 'TSU/PG/22/ERM/0008', 'MSC-ERM', 3.07, null, 'Graduated', '2024/2025', '2025-11-20', 'approved', 'live', 'TSU/PG/2025/000003', 'khdh3e8dcdxfxxes', 'tsu-demo-2026'),
  ('ISHAKU Blessing Musa', 'TSU/PG/20/PA/0009', 'PGD-PA', 4.20, null, 'Graduated', '2022/2023', '2023-11-09', 'approved', 'live', 'TSU/PG/2023/000002', '92t64jb537axbfxh', 'tsu-demo-2026'),
  ('JIBRIN Samuel Danjuma', 'TSU/PG/21/MC/0010', 'MSC-MC', 3.56, 'Merit', 'Graduated', '2023/2024', '2024-12-12', 'approved', 'live', 'TSU/PG/2024/000004', 'hbswrrun3nwzhf4z', 'tsu-demo-2026'),
  ('MAMMAN Haruna Danjuma', 'TSU/PG/20/ECO/0011', 'MSC-ECONO', 3.81, 'Pass', 'Graduated', '2022/2023', '2023-11-09', 'approved', 'live', 'TSU/PG/2023/000003', 'ac8ea6gbjbab4kct', 'tsu-demo-2026'),
  ('GARBA Blessing Saidu', 'TSU/PG/19/ECO/0012', 'PHD-ECONO', 4.67, 'Credit', 'Graduated', '2021/2022', '2022-11-17', 'approved', 'live', 'TSU/PG/2022/000002', 'v5w5s6s6fpsxkdyk', 'tsu-demo-2026'),
  ('ISHAKU Zainab Danjuma', 'TSU/PG/20/GC/0013', 'MED-GC', 4.60, 'Distinction', 'Graduated', '2022/2023', '2023-11-09', 'approved', 'live', 'TSU/PG/2023/000004', '6kva2xbrztfurqzr', 'tsu-demo-2026'),
  ('ABUBAKAR Samuel Tanko', 'TSU/PG/22/MC/0014', 'MSC-MC', 4.70, 'Merit', 'Graduated', '2024/2025', '2025-11-20', 'approved', 'live', 'TSU/PG/2025/000004', 'jn43xqa88ba8qxdr', 'tsu-demo-2026'),
  ('YAKUBU Samuel Asabe', 'TSU/PG/19/AP/0015', 'PHD-AP', 3.43, 'Merit', null, '2021/2022', '2022-11-17', 'approved', 'live', 'TSU/PG/2022/000003', '4nk9gv8836veyhus', 'tsu-demo-2026'),
  ('TANKO Mary Musa', 'TSU/PG/19/EE/0016', 'MENG-EE', 4.49, 'Merit', 'Graduated', '2021/2022', null, 'pending', 'live', null, null, null),
  ('BITRUS Hauwa Joy', 'TSU/PG/21/ECO/0017', 'MSC-ECONO', 3.00, 'Credit', 'Graduated', '2023/2024', null, 'pending', 'live', null, null, null),
  ('AUDU Fatima', 'TSU/PG/22/PA/0018', 'PGD-PA', 4.87, null, 'Graduated', '2024/2025', null, 'pending', 'live', null, null, null),
  ('ABUBAKAR Emmanuel Danjuma', 'TSU/PG/22/CS/0019', 'PHD-CS', 3.34, null, null, null, null, 'pending', 'live', null, null, null),
  ('IBRAHIM Daniel Ngufan', 'TSU/PG/20/ECO/0020', 'MSC-ECONO', 4.52, 'Pass', 'Graduated', '2022/2023', null, 'pending', 'live', null, null, null),
  ('ADAMU Peter Ladi', 'TSU/PG/20/ECO/0021', 'MSC-ECONO', 4.03, 'Distinction', 'Graduated', null, null, 'pending', 'live', null, null, null),
  ('IBRAHIM Esther Joy', 'TSU/PG/20/EE/0022', 'MENG-EE', 4.07, 'Merit', 'Graduated', '2022/2023', null, 'pending', 'live', null, null, null),
  ('BAKO Samuel', 'TSU/PG/21/MC/0023', 'MSC-MC', 3.16, 'Merit', null, '2023/2024', null, 'pending', 'live', null, null, null),
  ('KASSAM Abdullahi Kyari', 'TSU/PG/20/GC/0024', 'MED-GC', 3.27, 'Merit', 'Graduated', '2022/2023', '2023-11-09', 'approved', 'legacy', null, null, null),
  ('DANLADI Esther Kyari', 'TSU/PG/19/ECO/0025', 'PHD-ECONO', 3.23, 'Credit', 'Graduated', '2021/2022', '2022-11-17', 'approved', 'legacy', null, null, null),
  ('BAKO Daniel Asabe', 'TSU/PG/19/PA/0026', 'PGD-PA', 4.68, 'Distinction', null, '2021/2022', '2022-11-17', 'approved', 'legacy', null, null, null),
  ('NUHU Grace Bala', 'TSU/PG/20/BA/0027', 'MBA-BA', 4.06, 'Credit', 'Graduated', '2022/2023', '2023-11-09', 'approved', 'legacy', null, null, null),
  ('YAKUBU Victor Musa', 'TSU/PG/20/CS/0028', 'MSC-CS', 4.63, 'Credit', 'Graduated', '2022/2023', '2023-11-09', 'approved', 'legacy', null, null, null),
  ('MUSA Rebecca Yakubu', 'TSU/PG/19/PA/0029', 'PGD-PA', 4.31, 'Pass', 'Graduated', '2021/2022', '2022-11-17', 'approved', 'legacy', null, null, null),
  ('ISA Aisha Tanko', 'TSU/PG/19/HIS/0030', 'MA-HISTO', 4.55, 'Merit', 'Graduated with distinction', '2021/2022', '2022-11-17', 'approved', 'legacy', null, null, null),
  ('BITRUS Ruth Saidu', 'TSU/PG/19/CS/0031', 'PGD-CS', 3.31, 'Distinction', 'Graduated', '2021/2022', '2022-11-17', 'approved', 'legacy', null, null, null),
  ('ISA Daniel Rahila', 'TSU/PG/19/SC/0032', 'MSC-SC', 4.61, 'Pass', 'Graduated', '2021/2022', '2022-11-17', 'approved', 'legacy', null, null, null),
  ('EMMANUEL Esther Danjuma', 'TSU/PG/20/HIS/0033', 'MA-HISTO', 3.09, 'Credit', 'Graduated', '2022/2023', '2023-11-09', 'approved', 'legacy', null, null, null),
  ('MUSA Daniel Joy', 'TSU/PG/19/CS/0034', 'PGD-CS', 4.19, 'Credit', null, '2021/2022', '2022-11-17', 'approved', 'legacy', null, null, null),
  ('BITRUS Mary Saidu', 'TSU/PG/20/EE/0035', 'MENG-EE', 3.98, 'Credit', 'Graduated', '2022/2023', '2023-11-09', 'approved', 'legacy', null, null, null),
  ('DANLADI Rebecca Ngufan', 'TSU/PG/20/CS/0036', 'MSC-CS', 4.32, 'Credit', 'Graduated with distinction', '2022/2023', '2023-11-09', 'approved', 'legacy', null, null, null),
  ('ISHAKU Grace Bala', 'TSU/PG/19/HIS/0037', 'MA-HISTO', 3.14, 'Distinction', 'Graduated', '2021/2022', null, 'pending', 'legacy', null, null, null),
  ('IBRAHIM Daniel Kyari', 'TSU/PG/20/AP/0038', 'PHD-AP', 4.52, 'Merit', 'Graduated', '2022/2023', null, 'pending', 'legacy', null, null, null),
  ('JOSEPH Haruna Asabe', 'TSU/PG/19/ERM/0039', 'MSC-ERM', 3.23, null, 'Graduated', null, null, 'pending', 'legacy', null, null, null),
  ('SULEIMAN Abdullahi Bala', 'TSU/PG/19/CS/0040', 'PHD-CS', 4.76, null, 'Graduated', '2021/2022', null, 'pending', 'legacy', null, null, null)
) v(full_name, reg_number, programme_code, cgpa, class_label, remark, graduation_session, senate_approval_date,
    status, source, certificate_serial, verify_code, key_id)
join public.programmes p on p.code = v.programme_code
left join public.degree_classes dc on dc.label = v.class_label and dc.level is null;

-- Legacy records already checked against documents.
update public.graduates set verification_status = 'verified', verified_at = approved_at
where is_sample and reg_number in ('TSU/PG/19/SC/0032', 'TSU/PG/20/HIS/0033', 'TSU/PG/19/CS/0034', 'TSU/PG/20/EE/0035', 'TSU/PG/20/CS/0036');

insert into public.serial_counters (series, last_value) values
('PG-2022', 3), ('PG-2023', 4), ('PG-2024', 4), ('PG-2025', 4)
on conflict (series) do update set last_value = greatest(public.serial_counters.last_value, excluded.last_value);
