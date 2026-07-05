export function getCurrentSessionYear(): number {
  const configured = Number(process.env.SESSION_YEAR_CURRENT);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return new Date().getFullYear();
}
