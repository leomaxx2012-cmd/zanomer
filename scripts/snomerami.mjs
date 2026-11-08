// Official regional Telegram channels listed at:
// https://snomerami.ru/prodazha-gos-nomerov-v-soc-setyah
export const snomeramiSources = [
  ["snomerami01", "Республика Адыгея"],
  ["snomerami02", "Республика Башкортостан"],
  ["snomerami05", "Республика Дагестан"],
  ["snomerami07", "Кабардино-Балкарская Республика"],
  ["snomerami13", "Республика Мордовия"],
  ["snomerami16", "Республика Татарстан"],
  ["snomerami17_19", "Тыва и Хакасия"],
  ["snomerami18", "Удмуртская Республика"],
  ["snomerami21", "Чувашская республика"],
  ["snomerami23", "Краснодарский край"],
  ["snomerami124", "Красноярский край"],
  ["snomerami26", "Ставропольский край"],
  ["snomerami30", "Астраханская область"],
  ["snomerami31", "Белгородская область"],
  ["snomerami32", "Брянская область"],
  ["snomerami33", "Владимирская область"],
  ["snomerami34", "Волгоградская область"],
  ["snomerami36", "Воронежская область"],
  ["snomerami38", "Иркутская область"],
  ["snomerami39", "Калининградская область"],
  ["snomerami42", "Кемеровская область"],
  ["snomerami45", "Курганская область"],
  ["snomerami48", "Липецкая область"],
  ["snomerami52", "Нижегородская область"],
  ["snomerami54", "Новосибирская область"],
  ["snomerami55", "Омская область"],
  ["snomerami58", "Пензенская область"],
  ["snomerami59", "Пермский край"],
  ["snomerami61", "Ростовская область"],
  ["snomerami62", "Рязанская область"],
  ["snomerami163", "Самарская область"],
  ["snomerami64", "Саратовская область"],
  ["snomerami96", "Свердловская область"],
  ["snomerami67", "Смоленская область"],
  ["snomerami68", "Тамбовская область"],
  ["snomerami70", "Томская область"],
  ["snomerami71", "Тульская область"],
  ["snomerami72", "Тюменская область"],
  ["snomerami74", "Челябинская область"],
  ["snomerami", "Москва и МО"],
  ["snomerami78", "Санкт-Петербург и ЛО"],
  ["snomerami180", "Донецк и ДНР"],
  ["snomerami181", "Луганск и ЛНР"],
  ["snomerami82", "Республика Крым"],
  ["snomerami86", "Ханты-Мансийский АО"],
].map(([handle, region]) => ({ handle, name: "Snomerami · " + region, format: "snomerami" }));

// The network posts purchase requests and ads alongside offers for sale.
// Its sale template has one labelled plate and one labelled ruble price.
export function snomeramiSaleText(text) {
  const offer = text.match(/^(?:📌\s*)?продам\s+номера?\s+(?:🚘\s*)?номер:\s*([АВЕКМНОРСТУХABCEHKMOPTXY\d\s]+?)\s+(?:(?:🌎\s*)?город:\s*[\p{L}\s.,()-]{1,100}?\s+)?(?:💰\s*)?цена:\s*(\d{1,3}(?:[ ,]\d{3})+|\d+)(?=\s*(?:₽|руб\.?(?=\s|$)|📲|$))/iu);
  if (!offer) return "";
  const [, plate, price] = offer;
  const compactPlate = plate.replace(/\s+/g, "");
  const letters = "[АВЕКМНОРСТУХABCEHKMOPTXY]";
  const platePattern = new RegExp("^(?:" + letters + "\\d{3}" + letters + "{2}|\\d{4}" + letters + "{2}|" + letters + "{2}\\d{4})\\d{2,3}$", "iu");
  if (!platePattern.test(compactPlate)) return "";
  return compactPlate + " Цена: " + price.replace(/[ ,]/g, "");
}
