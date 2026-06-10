let argon2Promise: Promise<typeof import("argon2")> | null = null;

async function loadArgon2() {
  if (!argon2Promise) {
    argon2Promise = import("argon2");
  }
  return argon2Promise;
}

export async function hashPassword(plain: string) {
  const argon2 = await loadArgon2();
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 2,
  });
}

export async function verifyPassword(hash: string, plain: string) {
  const argon2 = await loadArgon2();
  return argon2.verify(hash, plain);
}
