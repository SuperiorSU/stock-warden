export function generateInvoiceNumber(sessionYear: number) {
  const suffix = String(Date.now()).slice(-6);
  return `CIMS-${sessionYear}-${suffix}`;
}

export function generateReceiptNumber(sessionYear: number) {
  const suffix = String(Date.now()).slice(-6);
  return `CIMS-R-${sessionYear}-${suffix}`;
}
