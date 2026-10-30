-- Removes the 40 fictional test records. Real records are never flagged is_sample.
select set_config('app.action', 'delete', true), set_config('app.reason', 'Removing fictional test records', true);
delete from public.import_batch_changes c using public.graduates g where g.id = c.graduate_id and g.is_sample;
delete from public.graduates where is_sample;
