export const CATALOG_CHANGED = "applications:changed";
export const announceChange = () =>
  window.dispatchEvent(new Event(CATALOG_CHANGED));
