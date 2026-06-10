const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function upsertUser({ email, name, role, department, password }) {
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 2,
  });

  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      department,
      passwordHash,
      isActive: true,
      isApproved: true,
    },
    create: {
      email,
      name,
      role,
      department,
      passwordHash,
      isActive: true,
      isApproved: true,
    },
  });
}

async function main() {
  const password = 'password321';

  const sessionYear = Number(process.env.SESSION_YEAR_CURRENT) || new Date().getFullYear();

  await upsertUser({
    email: 'sujalsinha2001@gmail.com',
    name: 'Sujal Sinha',
    role: 'USER',
    department: 'Computer Science',
    password,
  });

  const adminUser = await upsertUser({
    email: 'sujalmilind300@gmail.com',
    name: 'Sujal Milind',
    role: 'ADMIN',
    department: 'Admin Block',
    password,
  });

  await upsertUser({
    email: 'inventory.manager@example.com',
    name: 'Inventory Manager',
    role: 'INVENTORY_MANAGER',
    department: 'Stores',
    password,
  });
  await upsertUser({
    email: 'krsujalsinha2003@gmail.com',
    name: 'KR Sujal Sinha',
    role: 'SUPER_ADMIN',
    department: 'Admin Block',
    password,
  });

  const items = [
    {
      name: 'A4 Paper Ream',
      category: 'Stationery',
      unit: 'reams',
      totalQuantity: 200,
      unitPrice: '250.00',
      description: '80gsm, 500 sheets per ream.',
    },
    {
      name: 'Stapler Pins (No. 10)',
      category: 'Stationery',
      unit: 'boxes',
      totalQuantity: 120,
      description: 'Standard size pins for office staplers.',
    },
    {
      name: 'USB Keyboard',
      category: 'IT & Electronics',
      unit: 'pieces',
      totalQuantity: 45,
      unitPrice: '850.00',
      description: 'Wired USB keyboards for labs.',
    },
    {
      name: 'Desktop Mouse',
      category: 'IT & Electronics',
      unit: 'pieces',
      totalQuantity: 60,
      unitPrice: '450.00',
      description: 'Optical USB mouse, 1200 DPI.',
    },
    {
      name: 'Whiteboard Marker (Black)',
      category: 'Consumables',
      unit: 'pieces',
      totalQuantity: 150,
      description: 'Low-odor dry erase markers.',
    },
    {
      name: 'Lab Gloves (Latex)',
      category: 'Laboratory',
      unit: 'boxes',
      totalQuantity: 80,
      description: 'Powder-free latex gloves, 100 pcs/box.',
    },
    {
      name: 'First Aid Kit',
      category: 'Medical',
      unit: 'kits',
      totalQuantity: 12,
      description: 'Basic first aid kit for departments.',
    },
    {
      name: 'Extension Board',
      category: 'Electrical & Maintenance',
      unit: 'pieces',
      totalQuantity: 35,
      description: '6-socket extension boards with surge protection.',
    },
    {
      name: 'Office Chair',
      category: 'Furniture',
      unit: 'pieces',
      totalQuantity: 20,
      unitPrice: '4200.00',
      description: 'Ergonomic chair with adjustable height.',
    },
    {
      name: 'Projector',
      category: 'Assets & Equipment',
      unit: 'pieces',
      totalQuantity: 8,
      unitPrice: '45000.00',
      description: 'Full HD projector for seminar halls.',
    },
    {
      name: 'Cleaning Detergent (5L)',
      category: 'Cleaning & Housekeeping',
      unit: 'containers',
      totalQuantity: 40,
      unitPrice: '600.00',
      description: 'Multi-surface cleaning detergent.',
    },
    {
      name: 'Sports Cones (Set of 10)',
      category: 'Sports',
      unit: 'sets',
      totalQuantity: 15,
      description: 'Training cones for outdoor sports.',
    },
    {
      name: 'Bed Sheet (Single)',
      category: 'Hostel',
      unit: 'pieces',
      totalQuantity: 100,
      description: 'Cotton single bed sheets, assorted colors.',
    },
    {
      name: 'Laboratory Beaker (500ml)',
      category: 'Laboratory',
      unit: 'pieces',
      totalQuantity: 70,
      description: 'Borosilicate glass beaker.',
    },
    {
      name: 'Transport Logbook',
      category: 'Transport',
      unit: 'pieces',
      totalQuantity: 25,
      description: 'Vehicle usage logbook, 200 pages.',
    },
  ];

  const normalizeSlug = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

  const adminId = adminUser.id;

  for (const item of items) {
    const slugBase = normalizeSlug(`${item.name}-${sessionYear}`);
    const slug = slugBase.length ? slugBase : `item-${sessionYear}-${Math.random().toString(36).slice(2, 8)}`;

    const updateData = {
      name: item.name,
      category: item.category,
      unit: item.unit,
      description: item.description,
      totalQuantity: item.totalQuantity,
      availableQty: item.totalQuantity,
      sessionYear,
      isActive: true,
      isStale: false,
      ...(item.unitPrice ? { unitPrice: item.unitPrice, currency: item.currency ?? 'INR' } : {}),
    };

    const createData = {
      name: item.name,
      slug,
      category: item.category,
      unit: item.unit,
      description: item.description,
      totalQuantity: item.totalQuantity,
      availableQty: item.totalQuantity,
      sessionYear,
      isActive: true,
      isStale: false,
      createdBy: adminId,
      ...(item.unitPrice ? { unitPrice: item.unitPrice, currency: item.currency ?? 'INR' } : {}),
    };

    await prisma.inventoryItem.upsert({ where: { slug }, update: updateData, create: createData });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Seed error:', error);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
