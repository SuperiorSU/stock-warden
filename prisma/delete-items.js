const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const stockHistory = await prisma.stockHistory.deleteMany({});
  console.log(`Deleted ${stockHistory.count} stock history records`);

  const stockAlerts = await prisma.stockAlert.deleteMany({});
  console.log(`Deleted ${stockAlerts.count} stock alerts`);

  const requestItems = await prisma.requestItem.deleteMany({});
  console.log(`Deleted ${requestItems.count} request items`);

  const items = await prisma.inventoryItem.deleteMany({});
  console.log(`Deleted ${items.count} inventory items`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Delete error:', error);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
