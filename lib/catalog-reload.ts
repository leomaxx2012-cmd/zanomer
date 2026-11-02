// Serialized into +html so it runs before Expo Router reads the initial URL.
// Keep this function self-contained: the inline script has no module imports.
export function clearReloadedPlateSearch() {
  try {
    const entries = window.performance.getEntriesByType('navigation');
    if (!entries.length || (entries[0] as PerformanceNavigationTiming).type !== 'reload') return;
    const url = new URL(window.location.href);
    if (!['/', '/index.html', '/catalog', '/catalog/', '/catalog.html'].includes(url.pathname)) return;
    let changed = false;
    for (const key of ['left', 'digits', 'right']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    // Missing timing APIs or restricted history must never prevent startup.
  }
}
