// Collect in the background; don't rebuild the UI for every historical page.
// Always return successful pages, including when a later request fails.
export async function collectCatalogPages<T>(initial: T[], total: number | null | undefined, size: number,
  fetchPage: (start: number) => PromiseLike<{ data: T[] | null; error: unknown }>, active = () => true) {
  const rows = [...initial];
  for (let start = rows.length; active() && (total == null || start < total); start += size) {
    try {
      const result = await fetchPage(start);
      if (result.error) return { data: rows, error: result.error };
      const page = result.data ?? [];
      rows.push(...page);
      if (page.length < size) break;
    } catch (error) { return { data: rows, error }; }
  }
  return { data: rows, error: null };
}
