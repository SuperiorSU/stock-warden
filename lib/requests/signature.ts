export function buildRequestSignature(
  items: { itemId: string; quantity: number }[]
) {
  return items
    .slice()
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
    .map((item) => `${item.itemId}:${item.quantity}`)
    .join("|");
}
