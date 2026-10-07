const letters = { A:'А', B:'В', C:'С', E:'Е', H:'Н', K:'К', M:'М', O:'О', P:'Р', T:'Т', X:'Х', Y:'У', V:'В' };
export const normalizePlate = value => String(value ?? '').toUpperCase().replace(/[ABCEHKMOPTXYV]/g, c => letters[c]).replace(/[^А-Я0-9]/g, '');
export const regionCode = value => String(value ?? '').trim().match(/\d{1,3}$/)?.[0]?.replace(/^0+(?=\d)/, '') ?? '';
export function plateIdentity(row) {
  return `${row.vehicle_type}|${normalizePlate(`${row.plate_left ?? ''}${row.plate_digits ?? ''}${row.plate_right ?? ''}`)}|${regionCode(row.region)}`;
}
export const offerIdentity = row => `${plateIdentity(row)}|${Number(row.price_rub)}`;
export class CatalogIndex {
  constructor(rows = []) { this.rows = rows; }
  sameSource(row) {
    return this.rows.find(item => item.table === 'partner_listings' && item.source_url === row.source_url && plateIdentity(item) === plateIdentity(row));
  }
  duplicate(row) {
    return this.rows.some(item => item.status === 'active' && offerIdentity(item) === offerIdentity(row));
  }
  remember(row) {
    this.rows = this.rows.filter(item => !(item.table === 'partner_listings' && item.id === row.id));
    this.rows.push({ ...row, table: 'partner_listings' });
  }
}
export async function loadCatalogIndex(db) {
  const rows = [];
  for (const table of ['partner_listings', 'auto_listings']) {
    for (let offset = 0; ; offset += 1000) {
      const columns = 'id,plate_left,plate_digits,plate_right,region,vehicle_type,price_rub,status' + (table === 'partner_listings' ? ',source_url' : '');
      const { data, error } = await db.from(table).select(columns).order('id').range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data.map(row => ({ ...row, table })));
      if (data.length < 1000) break;
    }
  }
  return new CatalogIndex(rows);
}
