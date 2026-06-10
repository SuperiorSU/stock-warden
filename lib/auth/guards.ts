import { ForbiddenError } from "@/lib/errors";

export function assertOwnership(resourceUserId: string, requestUserId: string) {
  if (resourceUserId !== requestUserId) {
    throw new ForbiddenError("You do not own this resource.");
  }
}
