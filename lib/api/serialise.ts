import { Prisma } from "@prisma/client";

/**
 * Converts Prisma.Decimal and BigInt values to plain numbers before JSON
 * serialisation. Call this on every API response that touches Prisma data.
 */
export function serialise<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) => {
      if (value instanceof Prisma.Decimal) return Number(value);
      if (typeof value === "bigint") return Number(value);
      return value;
    })
  );
}
