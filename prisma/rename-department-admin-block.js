// One-off data migration: renames the department value "Admin Block" to
// "Admission Cell" on existing User rows. Update-only — never deletes rows.
// Run:   node prisma/rename-department-admin-block.js
// Undo:  node prisma/rename-department-admin-block-undo.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FROM = 'Admin Block';
const TO = 'Admission Cell';

async function main() {
  const result = await prisma.user.updateMany({
    where: { department: FROM },
    data: { department: TO },
  });
  console.log(`Updated ${result.count} user(s): department "${FROM}" -> "${TO}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
