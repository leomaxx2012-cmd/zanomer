begin;
do $$
declare
  seller uuid:=gen_random_uuid(); buyer uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); moderator uuid:=gen_random_uuid();
  listing uuid:=gen_random_uuid(); msg uuid:=gen_random_uuid(); report uuid:=gen_random_uuid();
  comment uuid:=gen_random_uuid(); comment_report uuid:=gen_random_uuid(); notice_id uuid;
  denied boolean; word text; amount integer;
begin
  foreach word in array array['хуи','ХУЙ','хуя','хуями','охуеть','нахуй','хуёвый','пиздец','пиздой','блядью','ебать','ебут','ёбаный','заебал','подъебать','суки','сукин','сучка','fuckers','huyi',U&'х\200Bуи'] loop
    if not public.contains_prohibited_language(word) then raise exception 'FAIL: prohibited form allowed: %',word; end if;
  end loop;
  foreach word in array array['Здравствуйте! Какая цена?','Номер А123ВС 777','Учебный пример','Колебания цены','Требуется оформление','Страхуй автомобиль','Себе и для себя','Себестоимость','Хулиганство','Небольшой торг','Сукно','Педикюр','Dickinson'] loop
    if public.contains_prohibited_language(word) then raise exception 'FAIL: harmless phrase blocked: %',word; end if;
  end loop;
  insert into auth.users(id) values(seller),(buyer),(other_user),(moderator);
  insert into public.auto_moderators(user_id) values(moderator);
  perform set_config('request.jwt.claim.sub',seller::text,true);
  insert into public.auto_listings(id,owner_id,plate_left,plate_digits,plate_right,region,price_rub,status) values(listing,seller,'А','127','ВС','77',100000,'active');
  insert into public.listing_messages(id,listing_id,sender_id,recipient_id,body) values(msg,listing,buyer,seller,'Test message for warning');
  insert into public.listing_message_reports(id,message_id,reason) values(report,msg,'Test warning complaint');
  insert into public.listing_public_comments(id,listing_id,author_id,author_name,body) values(comment,listing::text,other_user,'Test commenter','Test comment for warning');
  insert into public.listing_public_comment_reports(id,comment_id,reason) values(comment_report,comment,'Test comment complaint');
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  execute 'set local role authenticated';
  denied:=false;
  begin perform public.warn_user_from_report(report,'message','Test warning'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'FAIL: ordinary user can warn'; end if;
  perform set_config('request.jwt.claim.sub',moderator::text,true);
  denied:=false;
  begin perform public.warn_user_from_report(report,'message',' '); exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'FAIL: empty warning accepted'; end if;
  perform public.warn_user_from_report(report,'message','Пожалуйста, соблюдайте правила общения.');
  perform public.warn_user_from_report(comment_report,'comment','Пожалуйста, избегайте спама в комментариях.');
  denied:=false;
  begin perform public.warn_user_from_report(report,'message','Test duplicate warning'); exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'FAIL: same report warned twice'; end if;

  perform set_config('request.jwt.claim.sub',buyer::text,true);
  if public.is_current_user_banned() then raise exception 'FAIL: warning blocked user'; end if;
  select count(*) into amount from public.account_warning_notices;
  if amount<>1 then raise exception 'FAIL: warning privacy'; end if;
  select n.id into notice_id from public.get_unread_account_moderation_notice() n
  where n.owner_id=buyer and n.kind='warning' and n.reason='Пожалуйста, соблюдайте правила общения.' and n.expires_at is null;
  if notice_id is null then raise exception 'FAIL: missing warning text in account'; end if;
  denied:=false;
  begin update public.account_warning_notices set reason='Forged description' where id=notice_id; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'FAIL: user can edit warning'; end if;
  update public.account_warning_notices set read_at=now() where id=notice_id;
  if exists(select 1 from public.get_unread_account_moderation_notice()) then raise exception 'FAIL: read warning repeats'; end if;
  insert into public.listing_messages(listing_id,recipient_id,body) values(listing,seller,'Спасибо, буду соблюдать правила.');
  insert into public.listing_public_comments(listing_id,author_name,body) values(listing::text,'Test buyer','Спасибо за предупреждение.');
  denied:=false;
  begin insert into public.listing_messages(listing_id,recipient_id,body) values(listing,seller,'хуи');
  exception when raise_exception then if sqlerrm like '%запрещённые слова%' then denied:=true; else raise; end if; end;
  if not denied then raise exception 'FAIL: server accepted profanity in message'; end if;
  denied:=false;
  begin insert into public.listing_public_comments(listing_id,author_name,body) values(listing::text,'Test buyer','заебал');
  exception when raise_exception then if sqlerrm like '%запрещённые слова%' then denied:=true; else raise; end if; end;
  if not denied then raise exception 'FAIL: server accepted profanity in comment'; end if;
  execute 'reset role';
  if not exists(select 1 from public.listing_message_reports r where r.id=report and r.status='approved' and r.reviewed_by=moderator) then raise exception 'FAIL: message report not reviewed'; end if;
  if not exists(select 1 from public.listing_public_comment_reports r where r.id=comment_report and r.status='approved' and r.reviewed_by=moderator) then raise exception 'FAIL: comment report not reviewed'; end if;
end;
$$;
rollback;
select 'PASS: warnings, description delivery, privacy, no unwanted ban, report decisions and profanity in both chats and comments; all fixtures rolled back' as result;
