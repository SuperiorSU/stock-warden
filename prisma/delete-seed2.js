const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SEED2_DOMAIN = '@seed2.test';
const SEED2_SLUG_PREFIX = 'seed2-';

async function main() {
  // Collect the IDs we own so every delete is scoped — nothing outside these sets is touched.
  const seed2Users = await prisma.user.findMany({
    where: { email: { endsWith: SEED2_DOMAIN } },
    select: { id: true },
  });
  const userIds = seed2Users.map((u) => u.id);

  const seed2Items = await prisma.inventoryItem.findMany({
    where: { slug: { startsWith: SEED2_SLUG_PREFIX } },
    select: { id: true },
  });
  const itemIds = seed2Items.map((i) => i.id);

  const seed2Requests = await prisma.request.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const requestIds = seed2Requests.map((r) => r.id);

  if (userIds.length === 0 && itemIds.length === 0) {
    console.log('No seed2 data found — nothing to delete.');
    return;
  }

  console.log(`Found: ${userIds.length} users, ${itemIds.length} items, ${requestIds.length} requests`);

  // ── Step 1: Records that have no Prisma cascade and reference seed2 items ─
  const sh = await prisma.stockHistory.deleteMany({ where: { itemId: { in: itemIds } } });
  console.log(`Deleted ${sh.count} stock history records`);

  const sa = await prisma.stockAlert.deleteMany({ where: { itemId: { in: itemIds } } });
  console.log(`Deleted ${sa.count} stock alerts`);

  // ── Step 2: ExpenditureRecord has no Prisma FK — scope by requestId ───────
  const er = await prisma.expenditureRecord.deleteMany({ where: { requestId: { in: requestIds } } });
  console.log(`Deleted ${er.count} expenditure records`);

  // ── Step 3: Notifications linked to seed2 requests (no cascade from Request)
  const notif = await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  console.log(`Deleted ${notif.count} notifications`);

  // ── Step 4: Delete seed2 Users ────────────────────────────────────────────
  // Cascade from User automatically removes:
  //   UserSession, LoginAttempt (SetNull), AuditLog, StockAlert (userId),
  //   Request → RequestItem, RequestStatusHistory
  const del = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`Deleted ${del.count} seed2 users (+ cascaded sessions, audit logs, requests, request items, status history)`);

  // ── Step 5: Inventory items — safe now that RequestItem is gone ───────────
  const items = await prisma.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
  console.log(`Deleted ${items.count} seed2 inventory items`);

  console.log('\nSeed2 data removed. Existing data untouched.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Delete-seed2 error:', error);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
