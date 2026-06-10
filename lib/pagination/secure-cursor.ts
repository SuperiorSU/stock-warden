import { createHmac, timingSafeEqual } from "crypto";
import { ValidationError } from "@/lib/errors";

export function encodeCursor(id: string, createdAt: Date) {
  const payload = `${id}:${createdAt.toISOString()}`;
  const sig = createHmac("sha256", process.env.CURSOR_SECRET ?? "")
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function decodeCursor(cursor: string) {
  const decoded = Buffer.from(cursor, "base64url").toString();
  const parts = decoded.split(":");
  if (parts.length < 3) {
    throw new ValidationError("Invalid cursor.");
  }
  const id = parts[0];
  const sig = parts[parts.length - 1];
  const createdAtStr = parts.slice(1, -1).join(":");
  const payload = `${id}:${createdAtStr}`;
  const expected = createHmac("sha256", process.env.CURSOR_SECRET ?? "")
    .update(payload)
    .digest("hex")
    .slice(0, 16);

  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new ValidationError("Invalid cursor.");
  }

  const createdAt = new Date(createdAtStr);
  if (Number.isNaN(createdAt.getTime())) {
    throw new ValidationError("Invalid cursor.");
  }

  return { id, createdAt };
}
