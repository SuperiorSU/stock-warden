import { Prisma } from '@prisma/client'

export function toNumber(d: Prisma.Decimal | null | undefined): number | null {
  if (d === null || d === undefined) return null
  try {
    return d.toNumber()
  } catch {
    return Number(d as unknown as string)
  }
}

export default toNumber
