// Reversal script for rename-department-admin-block.js.
// Renames the department value "Admission Cell" back to "Admin Block".
// Update-only — never deletes rows.
// Run: node prisma/rename-department-admin-block-undo.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FROM = 'Admission Cell';
const TO = 'Admin Block';

async function main() {
  const result = await prisma.user.updateMany({
    where: { department: FROM },
    data: { department: TO },
  });
  console.log(`Reverted ${result.count} user(s): department "${FROM}" -> "${TO}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
