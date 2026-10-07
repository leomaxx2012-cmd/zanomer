-- Integration test: everything, including test account and payments, is rolled back.
-- No YooKassa calls or real charges. Run after plus-favorites.sql.
begin;
do $$
declare account uuid := gen_random_uuid(); payment uuid; own_listing uuid; promotion_end timestamptz; benefits jsonb; notices integer; fixed_time timestamptz;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(account,'plus-test-'||account||'@example.invalid','{"username":"Plus integration test"}'::jsonb);
  perform set_config('request.jwt.claim.sub',account::text,true);
  insert into public.partner_listings(id,plate_left,plate_digits,plate_right,region,vehicle_type,price_rub,source_name,source_url,status)
    values('plus-test-'||account,'А','123','АА','Москва · 77','car',200000,'Integration test','https://example.invalid/plus-test','active');
  perform public.set_favorite_price_watch('plus-test-'||account,true);
  update partner_listings set price_rub=190000 where id='plus-test-'||account;
  if exists(select 1 from app_notifications where owner_id=account and kind='price-drop') then raise exception 'Free account got Plus alert'; end if;
  insert into service_payments(owner_id,service_code,amount_kopecks,status,paid_at) values(account,'plus_month',19900,'pending',null) returning id into payment;
  benefits:=get_payment_benefits();
  if (benefits->>'highlights')::integer<>0 then raise exception 'Pending payment credited'; end if;
  update service_payments set status='succeeded',paid_at=now() where id=payment;
  benefits:=get_payment_benefits();
  if (benefits->>'highlights')::integer<>1 then raise exception 'One period must give one bonus'; end if;
  select paid_at into fixed_time from service_payments where id=payment;
  update service_payments set status='succeeded',paid_at=now()+interval '1 hour' where id=payment;
  if (select paid_at from service_payments where id=payment) is distinct from fixed_time then raise exception 'Webhook retry changed paid time'; end if;
  if (get_payment_benefits()->>'highlights')::integer<>1 then raise exception 'Webhook retry duplicated bonus'; end if;
  update partner_listings set price_rub=180000 where id='plus-test-'||account;
  select count(*) into notices from app_notifications where owner_id=account and kind='price-drop';
  if notices<>1 then raise exception 'Price drop did not create exactly one notice'; end if;
  update partner_listings set price_rub=180000 where id='plus-test-'||account;
  update partner_listings set price_rub=185000 where id='plus-test-'||account;
  if (select count(*) from app_notifications where owner_id=account and kind='price-drop')<>1 then raise exception 'Unchanged/increased price created notice'; end if;
  insert into service_payments(owner_id,service_code,amount_kopecks,status,paid_at) values(account,'plus_month',19900,'succeeded',now());
  benefits:=get_payment_benefits();
  if (benefits->>'highlights')::integer<>2 or (benefits->>'plus_until')::timestamptz<now()+interval '59 days' then raise exception 'Renewal bonus/extension failed'; end if;
  insert into auto_listings(owner_id,plate_left,plate_digits,plate_right,region,vehicle_type,price_rub,status)
    values(account,'А','123','АА','Москва · 77','car',200000,'active') returning id into own_listing;
  promotion_end := apply_listing_promotion(own_listing,'highlight');
  if promotion_end < now()+interval '47 hours' or promotion_end > now()+interval '49 hours'
     or (get_payment_benefits()->>'highlights')::integer<>1 then raise exception 'Bonus spending/duration failed'; end if;
  perform public.set_favorite_price_watch('plus-test-'||account,false);
  update partner_listings set price_rub=170000 where id='plus-test-'||account;
  if (select count(*) from app_notifications where owner_id=account and kind='price-drop')<>1 then raise exception 'Removed favorite created notice'; end if;
end $$;
rollback;
select 'PASS: bonus, 48h promotion, renewal, payment retry, price drop, free account, removed favorite; all test data rolled back' as result;
