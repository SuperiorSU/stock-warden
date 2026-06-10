export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

// Abbreviate large amounts to lakhs (L) and crores (Cr)
export function abbreviateINR(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_00_00_000) {
    return `${(amount / 1_00_00_000).toFixed(2)}Cr`
  }
  if (abs >= 1_00_000) {
    return `${(amount / 1_00_000).toFixed(2)}L`
  }
  if (abs >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`
  }
  return String(amount)
}

export default formatINR
