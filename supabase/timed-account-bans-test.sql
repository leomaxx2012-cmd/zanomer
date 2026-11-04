-- Test fixtures never survive this transaction.
begin;
do $$
declare
  seller uuid:=gen_random_uuid(); buyer uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); moderator uuid:=gen_random_uuid();
  listing uuid:=gen_random_uuid(); msg uuid:=gen_random_uuid(); msg2 uuid:=gen_random_uuid();
  report uuid:=gen_random_uuid(); report2 uuid:=gen_random_uuid(); comment uuid:=gen_random_uuid(); comment_report uuid:=gen_random_uuid();
  ends_at timestamptz; denied boolean; notice_id uuid; amount integer;
begin
  insert into auth.users(id) values(seller),(buyer),(other_user),(moderator);
  insert into public.auto_moderators(user_id) values(moderator);
  perform set_config('request.jwt.claim.sub',seller::text,true);
  insert into public.auto_listings(id,owner_id,plate_left,plate_digits,plate_right,region,price_rub,status) values(listing,seller,'А','125','ВС','77',100000,'active');
  insert into public.listing_messages(id,listing_id,sender_id,recipient_id,body) values(msg,listing,buyer,seller,'Test first message'),(msg2,listing,buyer,seller,'Test second message');
  insert into public.listing_message_reports(id,message_id,reason) values(report,msg,'Test complaint'),(report2,msg2,'Test second complaint');
  insert into public.listing_public_comments(id,listing_id,author_id,author_name,body) values(comment,listing::text,other_user,'Test user','Test comment');
  insert into public.listing_public_comment_reports(id,comment_id,reason) values(comment_report,comment,'Test comment complaint');

  perform set_config('request.jwt.claim.sub',buyer::text,true);
  execute 'set local role authenticated';
  denied:=false;
  begin perform public.ban_user_from_report(report,'message',15,'Test reason'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'FAIL: non-moderator can ban'; end if;
  perform set_config('request.jwt.claim.sub',moderator::text,true);
  denied:=false;
  begin perform public.ban_user_from_report(report,'message',0,'Test reason'); exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'FAIL: zero duration accepted'; end if;
  denied:=false;
  begin perform public.ban_user_from_report(report,'message',-1,'Test reason'); exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'FAIL: negative duration accepted'; end if;
  select b.expires_at into ends_at from public.ban_user_from_report(report,'message',15,'Test duration reason') b;
  if ends_at is distinct from now()+interval '15 minutes' then raise exception 'FAIL: incorrect custom expiry'; end if;
  select b.expires_at into ends_at from public.ban_user_from_report(comment_report,'comment',1440,'Test comment reason') b;
  if ends_at is distinct from now()+interval '1 day' then raise exception 'FAIL: incorrect comment ban expiry'; end if;

  perform set_config('request.jwt.claim.sub',buyer::text,true);
  if not public.is_current_user_banned() then raise exception 'FAIL: timed ban inactive'; end if;
  select count(*) into amount from public.get_my_ban_status() b where b.reason='Test duration reason';
  if amount<>1 then raise exception 'FAIL: own ban reason missing'; end if;
  select count(*) into amount from public.account_ban_notices;
  if amount<>1 then raise exception 'FAIL: own notices missing or other users notices visible'; end if;
  select n.id into notice_id from public.account_ban_notices n where n.owner_id=buyer and n.reason='Test duration reason' and n.expires_at=now()+interval '15 minutes' and n.read_at is null;
  if notice_id is null then raise exception 'FAIL: no persistent ban message'; end if;
  denied:=false;
  begin update public.account_ban_notices set reason='Forged reason' where id=notice_id; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'FAIL: user can edit notice contents'; end if;
  update public.account_ban_notices set read_at=now() where id=notice_id;
  denied:=false;
  begin insert into public.listing_messages(listing_id,recipient_id,body) values(listing,seller,'Test blocked message'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'FAIL: timed ban permits messages'; end if;
  denied:=false;
  begin insert into public.listing_public_comments(listing_id,author_name,body) values(listing::text,'Test buyer','Test blocked comment'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'FAIL: timed ban permits comments'; end if;

  execute 'reset role';
  update public.auto_banned_users set expires_at=now()-interval '1 second' where user_id=buyer;
  execute 'set local role authenticated';
  if public.is_current_user_banned() or exists(select 1 from public.get_my_ban_status()) then raise exception 'FAIL: expired ban still active'; end if;
  insert into public.listing_messages(listing_id,recipient_id,body) values(listing,seller,'Test message after expiry');
  insert into public.listing_public_comments(listing_id,author_name,body) values(listing::text,'Test buyer','Test comment after expiry');

  perform set_config('request.jwt.claim.sub',moderator::text,true);
  select b.expires_at into ends_at from public.ban_user_from_report(report2,'message',null,'Test permanent reason') b;
  if ends_at is not null then raise exception 'FAIL: permanent ban has expiry'; end if;
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  if not public.is_current_user_banned() then raise exception 'FAIL: permanent ban inactive'; end if;
  if not exists(select 1 from public.get_my_ban_status() b where b.reason='Test permanent reason' and b.expires_at is null) then raise exception 'FAIL: permanent ban reason missing'; end if;
  execute 'reset role';
end;
$$;
rollback;
select 'PASS: custom and permanent bans, notices, privacy, validation and automatic expiry; all fixtures rolled back' as result;
