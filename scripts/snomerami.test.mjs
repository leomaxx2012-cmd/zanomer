import test from "node:test";
import assert from "node:assert/strict";
import { snomeramiSaleText, snomeramiSources } from "./snomerami.mjs";

const sale = "📌 ПРОДАМ НОМЕРА 🚘 Номер: Е001НК163 🌎 Город: Самара 💰 Цена: 600 000 руб.";

test("the two regions sharing a channel are read once", () => {
  const handles = snomeramiSources.map(({ handle }) => handle);
  assert.equal(new Set(handles).size, 45);
  assert.equal(handles.filter(handle => handle === "snomerami17_19").length, 1);
});

test("a sale supplies its explicit plate, price and region without the contact field", () => {
  assert.equal(snomeramiSaleText(sale + " 📲 Связь: @example"), "Е001НК163 Цена: 600000");
  assert.equal(snomeramiSaleText(sale.replace("Е001НК163", "А952МР26")), "А952МР26 Цена: 600000");
});

test("purchase requests, incomplete plates and ambiguous prices are skipped", () => {
  const invalid = [
    sale.replace("ПРОДАМ", "КУПЛЮ"),
    sale.replace("Е001НК163", "Е001НК"),
    sale.replace("Е001НК163", "Е001НК6666"),
    sale.replace("600 000 руб.", "Договорная"),
    sale.replace("600 000 руб.", "600 000–800 000 руб."),
  ];
  for (const text of invalid) assert.equal(snomeramiSaleText(text), "");
});
