import { createClient } from '@supabase/supabase-js';
const db = createClient('https://qiqnbjdgkhbtfpxqtpio.supabase.co', 'sb_publishable_F-nhmdzQnvxe3stusjD-NA_i1-AOXOB', { auth: { persistSession: false }, global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(25000) }) } });
const groups = new Map();
let rows = 0;
const letters = { A:'А', B:'В', E:'Е', K:'К', M:'М', H:'Н', O:'О', P:'Р', C:'С', T:'Т', Y:'У', X:'Х' };
const normalize = value => String(value ?? '').toUpperCase().replace(/[ABEKMHOPCTYX]/g, c => letters[c]).replace(/[^А-Я0-9]/g, '');
for (const table of ['auto_listings', 'partner_listings']) {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from(table).select('id,plate_left,plate_digits,plate_right,region,vehicle_type,price_rub').eq('status', 'active').order('id').range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const row of data) {
      rows++;
      const plate = normalize(`${row.plate_left ?? ''}${row.plate_digits ?? ''}${row.plate_right ?? ''}`);
      const region = String(row.region ?? '').split(' · ').at(-1).trim().match(/\d{1,3}$/)?.[0];
      if (!plate || !region) continue;
      const key = `${row.vehicle_type}|${plate}|${region}|${Number(row.price_rub)}`;
      const entry = groups.get(key) ?? { plate, region, priceRub:Number(row.price_rub), vehicleType: row.vehicle_type, ids: [] };
      entry.ids.push(`${table}:${row.id}`);
      groups.set(key, entry);
    }
    if (data.length < 1000) break;
  }
}
const duplicates = [...groups.values()].filter(g => g.ids.length > 1).sort((a,b) => b.ids.length - a.ids.length);
console.log(JSON.stringify({ rows, duplicateGroups: duplicates.length, excessRowsWithinGroups: duplicates.reduce((sum,g) => sum + g.ids.length - 1, 0), examples: duplicates.slice(0,3).map(g => ({ ...g, count:g.ids.length, ids:g.ids.slice(0,3) })), recordsChanged:false }));
