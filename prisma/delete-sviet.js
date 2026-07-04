const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SLUG_PREFIX = 'sviet-hist-';

// Emails of users CREATED by seed-sviet.js (not pre-existing ones).
// hpadmission@sviet.ac.in (Akshay Kumar) already existed — excluded from deletion.
// ankur gill, pertik garg, admin, both IMs are also pre-existing and never included.
const NAMED_NEW_EMAILS = [
  'ankurgill6@gmail.com',
  'manikdhiman@sviet.ac.in',
  'tarandeepsingh@sviet.ac.in',
  'hr@sviet.ac.in',
  'principalsvce@sviet.ac.in',
  'rupinderkaur.ap@sviet.ac.in',
];

async function main() {
  // Collect all seed-sviet user IDs:
  // 1. Named new users (exact email list above)
  // 2. Placeholder users (email ends with .hist@sviet.ac.in)
  const seedUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: NAMED_NEW_EMAILS } },
        { email: { endsWith: '.hist@sviet.ac.in' } },
      ],
    },
    select: { id: true, email: true },
  });
  const userIds = seedUsers.map(u => u.id);

  // Collect all seed-sviet item IDs
  const seedItems = await prisma.inventoryItem.findMany({
    where: { slug: { startsWith: SLUG_PREFIX } },
    select: { id: true, name: true },
  });
  const itemIds = seedItems.map(i => i.id);

  // Collect all seed-sviet request IDs (requests made by seed users)
  const seedRequests = await prisma.request.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const requestIds = seedRequests.map(r => r.id);

  if (userIds.length === 0 && itemIds.length === 0) {
    console.log('No seed-sviet data found — nothing to delete.');
    return;
  }

  console.log(`Found: ${userIds.length} users, ${itemIds.length} items, ${requestIds.length} requests`);
  console.log('Users that will be removed:', seedUsers.map(u => u.email).join(', '));

  // ── FK-safe deletion order ───────────────────────────────────────────────────

  // StockHistory: no Prisma cascade from InventoryItem
  const sh = await prisma.stockHistory.deleteMany({ where: { itemId: { in: itemIds } } });
  console.log(`Deleted ${sh.count} stock history records`);

  // StockAlert: no cascade from InventoryItem
  const sa = await prisma.stockAlert.deleteMany({ where: { itemId: { in: itemIds } } });
  console.log(`Deleted ${sa.count} stock alerts`);

  // ExpenditureRecord: no Prisma FK — scope by requestId
  const er = await prisma.expenditureRecord.deleteMany({ where: { requestId: { in: requestIds } } });
  console.log(`Deleted ${er.count} expenditure records`);

  // Notification: no cascade from Request — delete by userId (all belong to seed users)
  const notif = await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  console.log(`Deleted ${notif.count} notifications`);

  // AuditLog created by admin for seed requests — scope by entityId
  const al = await prisma.auditLog.deleteMany({ where: { entityId: { in: requestIds } } });
  console.log(`Deleted ${al.count} audit logs (request-scoped)`);

  // Delete seed users → cascades: UserSession, LoginAttempt, AuditLog (userId),
  //   StockAlert (userId), Notification (userId), Request → RequestItem, RequestStatusHistory
  const del = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`Deleted ${del.count} seed-sviet users (+ cascaded sessions, requests, request items, status history)`);

  // InventoryItems — safe now that RequestItem cascade deleted with Requests
  const items = await prisma.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
  console.log(`Deleted ${items.count} seed-sviet inventory items`);

  console.log('\nSeed-sviet data removed. All pre-existing data untouched.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('delete-sviet error:', err);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
