export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function withSlugSuffix(base: string) {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}
