-- Regression checks using disposable fixtures. Always rolls back all test rows.
begin;
do $$
declare
  seller uuid := gen_random_uuid(); buyer uuid := gen_random_uuid(); other_buyer uuid := gen_random_uuid();
  moderator uuid := gen_random_uuid(); listing uuid := gen_random_uuid(); other_listing uuid := gen_random_uuid();
  reported_message uuid := gen_random_uuid(); report uuid := gen_random_uuid();
  comment uuid := gen_random_uuid(); comment_report uuid := gen_random_uuid();
  rejected_comment uuid := gen_random_uuid(); rejected_report uuid := gen_random_uuid();
  amount integer; denied boolean;
begin
  insert into auth.users(id) values (seller), (buyer), (other_buyer), (moderator);
  insert into public.auto_moderators(user_id) values (moderator);
  perform set_config('request.jwt.claim.sub', seller::text, true);
  insert into public.auto_listings(id,owner_id,plate_left,plate_digits,plate_right,region,price_rub,status)
  values (listing,seller,'А','123','ВС','77',100000,'active'), (other_listing,seller,'А','124','ВС','77',100000,'active');
  insert into public.listing_messages(id,listing_id,sender_id,recipient_id,body) values
  (reported_message,listing,buyer,seller,'Test reported message'),
  (gen_random_uuid(),listing,seller,buyer,'Test reply'),
  (gen_random_uuid(),listing,other_buyer,seller,'Test other buyer'),
  (gen_random_uuid(),listing,seller,other_buyer,'Test other reply'),
  (gen_random_uuid(),other_listing,buyer,seller,'Test other listing');
  insert into public.listing_message_reports(id,message_id,reason) values (report,reported_message,'Test complaint');
  insert into public.listing_public_comments(id,listing_id,author_id,author_name,body) values
  (comment,listing::text,buyer,'Test buyer','Test comment'),
  (rejected_comment,listing::text,other_buyer,'Test other buyer','Test second comment');
  insert into public.listing_public_comment_reports(id,comment_id,reason) values
  (comment_report,comment,'Test comment complaint'), (rejected_report,rejected_comment,'Test rejected complaint');

  perform set_config('request.jwt.claim.sub', other_buyer::text, true);
  execute 'set local role authenticated';
  denied := false;
  begin perform public.get_pending_listing_reports(); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL: non-moderator can read reports'; end if;
  denied := false;
  begin perform public.get_reported_listing_chat(report); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL: non-moderator can read reported chat'; end if;
  denied := false;
  begin perform public.review_listing_public_comment_report(comment_report,'approved',true); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL: non-moderator can review or ban'; end if;
  denied := false;
  begin insert into public.listing_message_reports(message_id,reason) values(reported_message,'Test forged complaint'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL: outsider can report another conversation'; end if;

  perform set_config('request.jwt.claim.sub', moderator::text, true);
  select count(*) into amount from public.get_reported_listing_chat(report);
  if amount <> 2 then raise exception 'FAIL: expected exactly 2 messages, got %', amount; end if;
  if exists(select 1 from public.get_reported_listing_chat(report) m where m.sender_id=other_buyer or m.recipient_id=other_buyer or m.listing_id<>listing) then
    raise exception 'FAIL: unrelated chat leaked';
  end if;
  select count(*) into amount from public.get_pending_listing_reports() r where r.id in (report,comment_report,rejected_report);
  if amount <> 3 then raise exception 'FAIL: message/comment queue incomplete'; end if;
  perform public.review_listing_public_comment_report(rejected_report,'rejected',false);
  perform public.review_listing_public_comment_report(comment_report,'approved',true);
  denied := false;
  begin perform public.review_listing_public_comment_report(comment_report,'rejected',false); exception when raise_exception then denied := true; end;
  if not denied then raise exception 'FAIL: processed comment report can be reviewed twice'; end if;
  execute 'reset role';
  if not exists(select 1 from public.listing_public_comment_reports r where r.id=comment_report and r.status='approved' and r.reviewed_by=moderator and r.reviewed_at is not null) then
    raise exception 'FAIL: missing comment review audit';
  end if;

  perform set_config('request.jwt.claim.sub', buyer::text, true);
  execute 'set local role authenticated';
  denied := false;
  begin insert into public.listing_messages(listing_id,recipient_id,body) values (listing,seller,'Test blocked message'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL: banned user can send a message'; end if;
  denied := false;
  begin insert into public.listing_public_comments(listing_id,author_name,body) values (listing::text,'Test buyer','Test blocked comment'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL: banned user can send a comment'; end if;
  perform set_config('request.jwt.claim.sub', other_buyer::text, true);
  insert into public.listing_messages(listing_id,recipient_id,body) values (listing,seller,'Test allowed message');
  insert into public.listing_public_comments(listing_id,author_name,body) values (listing::text,'Test other buyer','Test allowed comment');

  perform set_config('request.jwt.claim.sub', moderator::text, true);
  perform public.ban_user_from_message_report(report);
  execute 'reset role';
  if not exists(select 1 from public.listing_message_reports r where r.id=report and r.status='approved') then raise exception 'FAIL: message report ban not recorded'; end if;
end;
$$;
rollback;
select 'PASS: report queue, review rights, conversation isolation, ban enforcement and allowed messages; all fixtures rolled back' as result;
