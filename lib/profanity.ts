// Keep these expressions in sync with supabase/message-profanity.sql.
export const prohibitedWordSource = String.raw`(?:ху[йяеиюії]|п[иі]зд|бл[яе]д|мраз|г[ао]ндон|п[ие]д[ао]р|идиот|^сук(?:а|и|е|у|ой|ою|ам|ами|ах)$|^сукин|^суч(?:к|ар|ен)|^курв|^бля$|^хул[ие]|^(?:(?:за|на|вы|до|от|под|по|пере|про|при|об|с|раз|у|не|недо|из|вз|в|о)[ъь]?){0,3}е[б6](?:[ауеилнтыо]|$)|йоб|^fuck|^shit|^bitch|asshole|bastard|^cunt|^dick(?:s|head)?$|^whore|^slut|huy|hui|huya|hue|pizd|^ebat|yob|blya|^suk[aiuy]|kurwa)`;
export const permittedWordSource = String.raw`^(?:себ[ея]$|себестоим|хулиган|(?:за|под|пере)?страху)`;
const prohibited = new RegExp(prohibitedWordSource, "u");
const permitted = new RegExp(permittedWordSource, "u");

export function containsProhibitedLanguage(body: string): boolean {
  const normalized = body.normalize("NFKC").toLowerCase().replace(/ё/g, "е")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "");
  return (normalized.match(/[a-zа-яіїєґ0-9]+/gu) ?? []).some(word => !permitted.test(word) && prohibited.test(word));
}
