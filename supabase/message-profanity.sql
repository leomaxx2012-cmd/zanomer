begin;
create or replace function public.contains_prohibited_language(body text)
returns boolean language sql immutable set search_path=public as $$
  select exists(
    select 1 from regexp_split_to_table(
      regexp_replace(replace(lower(normalize(coalesce(body,''),NFKC)),'ё','е'),U&'[\200B-\200F\202A-\202E\2060-\206F\FEFF]','','g'),
      '[^a-zа-яіїєґ0-9]+'
    ) as word
    where word !~ $permitted$^(?:себ[ея]$|себестоим|хулиган|(?:за|под|пере)?страху)$permitted$
    and word ~ $prohibited$(?:ху[йяеиюії]|п[иі]зд|бл[яе]д|мраз|г[ао]ндон|п[ие]д[ао]р|идиот|^сук(?:а|и|е|у|ой|ою|ам|ами|ах)$|^сукин|^суч(?:к|ар|ен)|^курв|^бля$|^хул[ие]|^(?:(?:за|на|вы|до|от|под|по|пере|про|при|об|с|раз|у|не|недо|из|вз|в|о)[ъь]?){0,3}е[б6](?:[ауеилнтыо]|$)|йоб|^fuck|^shit|^bitch|asshole|bastard|^cunt|^dick(?:s|head)?$|^whore|^slut|huy|hui|huya|hue|pizd|^ebat|yob|blya|^suk[aiuy]|kurwa)$prohibited$
  );
$$;
revoke all on function public.contains_prohibited_language(text) from public,anon;
grant execute on function public.contains_prohibited_language(text) to authenticated;

create or replace function public.reject_prohibited_chat_message()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.contains_prohibited_language(new.body) then raise exception 'Сообщение содержит запрещённые слова'; end if;
  return new;
end;
$$;
create or replace function public.reject_prohibited_public_comment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.contains_prohibited_language(new.body) then raise exception 'Комментарий содержит запрещённые слова'; end if;
  return new;
end;
$$;
revoke all on function public.reject_prohibited_chat_message() from public,anon,authenticated;
revoke all on function public.reject_prohibited_public_comment() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
