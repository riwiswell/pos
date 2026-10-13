-- Allow multiple regional variants of a language for a user, while preserving legacy data.
begin;

update public.language_profiles
set locale_code = case language_code
  when 'en' then 'en-US'
  when 'it' then 'it-IT'
  when 'pt' then 'pt-BR'
  when 'fr' then 'fr-FR'
  else language_code
end
where locale_code is null or btrim(locale_code) = '';

update public.language_profiles
set country_name = case locale_code
  when 'en-US' then 'Estados Unidos'
  when 'en-GB' then 'Reino Unido'
  when 'it-IT' then 'Italia'
  when 'pt-BR' then 'Brasil'
  when 'pt-PT' then 'Portugal'
  when 'fr-FR' then 'Francia'
  when 'fr-CA' then 'Canadá'
  else country_name
end
where country_name is null;

alter table public.language_profiles
  drop constraint if exists language_profiles_user_id_language_code_key;

alter table public.language_profiles
  add constraint language_profiles_user_language_locale_key
  unique (user_id, language_code, locale_code);

commit;
