const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

const SEED2_DOMAIN = '@seed2.test';
const SEED2_SLUG_PREFIX = 'seed2-';

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 2 });
}

function toSlug(name, year) {
  return `${SEED2_SLUG_PREFIX}${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}-${year}`;
}

async function main() {
  const sessionYear = Number(process.env.SESSION_YEAR_CURRENT) || new Date().getFullYear();
  const passwordHash = await hashPassword('dummypass123');

  // ─── Users ────────────────────────────────────────────────────────────────
  console.log('Creating seed2 users...');

  const usersInput = [
    { email: `student.riya${SEED2_DOMAIN}`,       name: 'Riya Sharma',     role: 'USER',              department: 'Electronics Engineering' },
    { email: `student.arjun${SEED2_DOMAIN}`,      name: 'Arjun Mehta',     role: 'USER',              department: 'Mechanical Engineering' },
    { email: `faculty.priya${SEED2_DOMAIN}`,      name: 'Dr. Priya Nair',  role: 'USER',              department: 'Chemistry' },
    { email: `hod.kumar${SEED2_DOMAIN}`,          name: 'Prof. Kumar Singh', role: 'USER',             department: 'Computer Science' },
    { email: `storekeeper.ramesh${SEED2_DOMAIN}`, name: 'Ramesh Gupta',    role: 'INVENTORY_MANAGER', department: 'Stores' },
    { email: `deputy.admin${SEED2_DOMAIN}`,       name: 'Anjali Verma',    role: 'ADMIN',             department: 'Admin Block' },
  ];

  const users = [];
  for (const u of usersInput) {
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: { name: u.name, role: u.role, department: u.department, passwordHash, isActive: true, isApproved: true },
      create: { email: u.email, name: u.name, role: u.role, department: u.department, passwordHash, isActive: true, isApproved: true },
    });
    users.push(user);
  }

  const [uRiya, uArjun, uPriya, uKumar, uRamesh, uAnjali] = users;
  const adminId   = uAnjali.id;
  const storeId   = uRamesh.id;

  // ─── Inventory items ──────────────────────────────────────────────────────
  console.log('Creating seed2 inventory items...');

  const itemsInput = [
    { name: 'Ballpoint Pen (Blue)',     category: 'Stationery',            unit: 'pieces',    totalQuantity: 300, unitPrice: '15.00',    description: 'Blue ink ballpoint pens for office use.' },
    { name: 'Ink Cartridge (Black)',    category: 'IT & Electronics',      unit: 'pieces',    totalQuantity: 50,  unitPrice: '1200.00',  description: 'Compatible black ink cartridge for laser printers.' },
    { name: 'Compound Microscope',      category: 'Laboratory',            unit: 'pieces',    totalQuantity: 10,  unitPrice: '18000.00', description: '40x–1000x compound microscope for biology lab.' },
    { name: 'Badminton Racket',         category: 'Sports',                unit: 'pieces',    totalQuantity: 20,  unitPrice: '750.00',   description: 'Lightweight aluminium badminton racket.' },
    { name: 'Hand Sanitizer 500ml',     category: 'Medical',               unit: 'bottles',   totalQuantity: 60,  unitPrice: '180.00',   description: '70% alcohol hand sanitizer.' },
    { name: 'Filing Cabinet 4-Drawer',  category: 'Furniture',             unit: 'pieces',    totalQuantity: 6,   unitPrice: '8500.00',  description: 'Steel 4-drawer filing cabinet with lock.' },
    { name: 'HDMI Cable 2m',            category: 'IT & Electronics',      unit: 'pieces',    totalQuantity: 40,  unitPrice: '350.00',   description: '2-metre HDMI 2.0 cable.' },
    { name: 'Chalk Box White',          category: 'Consumables',           unit: 'boxes',     totalQuantity: 200,                        description: '100 sticks per box, white chalk.' },
    { name: 'Pillow Cover White',       category: 'Hostel',                unit: 'pieces',    totalQuantity: 80,                         description: 'Plain white cotton pillow covers for hostel.' },
    { name: 'Safety Goggles',           category: 'Laboratory',            unit: 'pieces',    totalQuantity: 50,  unitPrice: '120.00',   description: 'Anti-fog safety goggles for lab use.' },
  ];

  const inv = [];
  for (const item of itemsInput) {
    const slug = toSlug(item.name, sessionYear);
    const common = {
      name: item.name, category: item.category, unit: item.unit,
      description: item.description, totalQuantity: item.totalQuantity,
      availableQty: item.totalQuantity, sessionYear, isActive: true, isStale: false,
      ...(item.unitPrice ? { unitPrice: item.unitPrice, currency: 'INR' } : {}),
    };
    const record = await prisma.inventoryItem.upsert({
      where:  { slug },
      update: common,
      create: { ...common, slug, createdBy: adminId },
    });
    inv.push(record);
  }

  const [iPen, iCartridge, iMicroscope, iBadminton, iSanitizer, iCabinet, iHDMI, iChalk, iPillow, iGoggles] = inv;

  // ─── Initial stock history ────────────────────────────────────────────────
  console.log('Creating stock history...');

  await prisma.stockHistory.createMany({
    data: [
      { itemId: iPen.id,        changeType: 'ADDED', quantityDelta: 300, quantityAfter: 300, changedBy: adminId, notes: 'Initial stock loaded.', createdAt: daysAgo(30) },
      { itemId: iCartridge.id,  changeType: 'ADDED', quantityDelta: 50,  quantityAfter: 50,  changedBy: adminId, notes: 'Initial stock loaded.', createdAt: daysAgo(30) },
      { itemId: iMicroscope.id, changeType: 'ADDED', quantityDelta: 10,  quantityAfter: 10,  changedBy: adminId, notes: 'Procured from vendor.',  createdAt: daysAgo(30) },
      { itemId: iBadminton.id,  changeType: 'ADDED', quantityDelta: 20,  quantityAfter: 20,  changedBy: adminId, notes: 'Initial stock loaded.', createdAt: daysAgo(30) },
      { itemId: iSanitizer.id,  changeType: 'ADDED', quantityDelta: 60,  quantityAfter: 60,  changedBy: adminId, notes: 'Health dept requisition.', createdAt: daysAgo(30) },
      { itemId: iCabinet.id,    changeType: 'ADDED', quantityDelta: 6,   quantityAfter: 6,   changedBy: adminId, notes: 'Purchased for dept offices.', createdAt: daysAgo(30) },
      { itemId: iHDMI.id,       changeType: 'ADDED', quantityDelta: 40,  quantityAfter: 40,  changedBy: adminId, notes: 'IT dept stock.',        createdAt: daysAgo(30) },
      { itemId: iChalk.id,      changeType: 'ADDED', quantityDelta: 200, quantityAfter: 200, changedBy: adminId, notes: 'Annual chalk procurement.', createdAt: daysAgo(30) },
      { itemId: iPillow.id,     changeType: 'ADDED', quantityDelta: 80,  quantityAfter: 80,  changedBy: adminId, notes: 'Hostel inventory.',     createdAt: daysAgo(30) },
      { itemId: iGoggles.id,    changeType: 'ADDED', quantityDelta: 50,  quantityAfter: 50,  changedBy: adminId, notes: 'Lab safety equipment.', createdAt: daysAgo(30) },
    ],
  });

  // ─── Request 1: APPROVED — Riya: pens + chalk ────────────────────────────
  console.log('Creating seed2 requests...');

  const req1 = await prisma.request.create({
    data: {
      userId: uRiya.id, status: 'APPROVED', sessionYear,
      notes: 'Needed for semester project documentation.',
      adminId, adminNotes: 'Approved for CS dept usage.',
      createdAt: daysAgo(20), processedAt: daysAgo(18),
    },
  });
  const ri1a = await prisma.requestItem.create({
    data: { requestId: req1.id, itemId: iPen.id,   quantityReq: 20, quantityAllocated: 20, quantityFul: 20 },
  });
  const ri1b = await prisma.requestItem.create({
    data: { requestId: req1.id, itemId: iChalk.id, quantityReq: 5,  quantityAllocated: 5,  quantityFul: 5  },
  });
  await prisma.requestStatusHistory.createMany({
    data: [
      { requestId: req1.id, toStatus: 'REQUESTED', changedBy: uRiya.id,   createdAt: daysAgo(20) },
      { requestId: req1.id, fromStatus: 'REQUESTED', toStatus: 'PENDING',  changedBy: adminId,    createdAt: daysAgo(19) },
      { requestId: req1.id, fromStatus: 'PENDING',   toStatus: 'APPROVED', changedBy: adminId, notes: 'Approved.', createdAt: daysAgo(18) },
    ],
  });
  await prisma.stockHistory.createMany({
    data: [
      { itemId: iPen.id,   changeType: 'FULFILLED', quantityDelta: -20, quantityAfter: 280, changedBy: storeId, requestId: req1.id, notes: 'Fulfilled for Riya Sharma.', createdAt: daysAgo(17) },
      { itemId: iChalk.id, changeType: 'FULFILLED', quantityDelta: -5,  quantityAfter: 195, changedBy: storeId, requestId: req1.id, notes: 'Fulfilled for Riya Sharma.', createdAt: daysAgo(17) },
    ],
  });
  await prisma.expenditureRecord.create({
    data: { requestId: req1.id, requestItemId: ri1a.id, itemId: iPen.id, itemName: 'Ballpoint Pen (Blue)', category: 'Stationery', unitPrice: '15.00', quantityFulfilled: 20, totalAmount: '300.00', sessionYear, approvedAt: daysAgo(18), approvedBy: adminId, department: uRiya.department },
  });
  await prisma.inventoryItem.update({ where: { id: iPen.id },   data: { availableQty: 280 } });
  await prisma.inventoryItem.update({ where: { id: iChalk.id }, data: { availableQty: 195 } });

  // ─── Request 2: APPROVED — Arjun: HDMI cables ────────────────────────────
  const req2 = await prisma.request.create({
    data: {
      userId: uArjun.id, status: 'APPROVED', sessionYear,
      notes: 'For mechanical lab projector setup.',
      adminId, adminNotes: 'Approved — lab necessity.',
      createdAt: daysAgo(15), processedAt: daysAgo(13),
    },
  });
  const ri2 = await prisma.requestItem.create({
    data: { requestId: req2.id, itemId: iHDMI.id, quantityReq: 4, quantityAllocated: 4, quantityFul: 4 },
  });
  await prisma.requestStatusHistory.createMany({
    data: [
      { requestId: req2.id, toStatus: 'REQUESTED', changedBy: uArjun.id, createdAt: daysAgo(15) },
      { requestId: req2.id, fromStatus: 'REQUESTED', toStatus: 'APPROVED', changedBy: adminId, createdAt: daysAgo(13) },
    ],
  });
  await prisma.stockHistory.create({
    data: { itemId: iHDMI.id, changeType: 'FULFILLED', quantityDelta: -4, quantityAfter: 36, changedBy: storeId, requestId: req2.id, createdAt: daysAgo(12) },
  });
  await prisma.expenditureRecord.create({
    data: { requestId: req2.id, requestItemId: ri2.id, itemId: iHDMI.id, itemName: 'HDMI Cable 2m', category: 'IT & Electronics', unitPrice: '350.00', quantityFulfilled: 4, totalAmount: '1400.00', sessionYear, approvedAt: daysAgo(13), approvedBy: adminId, department: uArjun.department },
  });
  await prisma.inventoryItem.update({ where: { id: iHDMI.id }, data: { availableQty: 36 } });

  // ─── Request 3: APPROVED — Dr. Priya: goggles + microscope ───────────────
  const req3 = await prisma.request.create({
    data: {
      userId: uPriya.id, status: 'APPROVED', sessionYear,
      notes: 'Chemistry lab semester requirement.',
      adminId, adminNotes: 'Essential lab safety equipment.',
      inventoryManagerId: storeId,
      createdAt: daysAgo(12), processedAt: daysAgo(10), inventoryProcessedAt: daysAgo(9),
    },
  });
  const ri3a = await prisma.requestItem.create({
    data: { requestId: req3.id, itemId: iGoggles.id,    quantityReq: 15, quantityAllocated: 15, quantityFul: 15 },
  });
  const ri3b = await prisma.requestItem.create({
    data: { requestId: req3.id, itemId: iMicroscope.id, quantityReq: 2,  quantityAllocated: 2,  quantityFul: 2  },
  });
  await prisma.requestStatusHistory.createMany({
    data: [
      { requestId: req3.id, toStatus: 'REQUESTED', changedBy: uPriya.id, createdAt: daysAgo(12) },
      { requestId: req3.id, fromStatus: 'REQUESTED', toStatus: 'PENDING',  changedBy: adminId, createdAt: daysAgo(11) },
      { requestId: req3.id, fromStatus: 'PENDING',   toStatus: 'APPROVED', changedBy: adminId, createdAt: daysAgo(10) },
    ],
  });
  await prisma.stockHistory.createMany({
    data: [
      { itemId: iGoggles.id,    changeType: 'FULFILLED', quantityDelta: -15, quantityAfter: 35, changedBy: storeId, requestId: req3.id, createdAt: daysAgo(9) },
      { itemId: iMicroscope.id, changeType: 'FULFILLED', quantityDelta: -2,  quantityAfter: 8,  changedBy: storeId, requestId: req3.id, createdAt: daysAgo(9) },
    ],
  });
  await prisma.expenditureRecord.createMany({
    data: [
      { requestId: req3.id, requestItemId: ri3a.id, itemId: iGoggles.id,    itemName: 'Safety Goggles',      category: 'Laboratory', unitPrice: '120.00',   quantityFulfilled: 15, totalAmount: '1800.00',  sessionYear, approvedAt: daysAgo(10), approvedBy: adminId, department: uPriya.department },
      { requestId: req3.id, requestItemId: ri3b.id, itemId: iMicroscope.id, itemName: 'Compound Microscope', category: 'Laboratory', unitPrice: '18000.00', quantityFulfilled: 2,  totalAmount: '36000.00', sessionYear, approvedAt: daysAgo(10), approvedBy: adminId, department: uPriya.department },
    ],
  });
  await prisma.inventoryItem.update({ where: { id: iGoggles.id },    data: { availableQty: 35 } });
  await prisma.inventoryItem.update({ where: { id: iMicroscope.id }, data: { availableQty: 8  } });

  // ─── Request 4: REJECTED — Kumar: filing cabinets ────────────────────────
  const req4 = await prisma.request.create({
    data: {
      userId: uKumar.id, status: 'REJECTED', sessionYear,
      notes: 'Replacement for damaged cabinets in CS lab.',
      adminId, adminNotes: 'Budget not available this quarter.',
      createdAt: daysAgo(10), processedAt: daysAgo(8),
    },
  });
  await prisma.requestItem.create({
    data: { requestId: req4.id, itemId: iCabinet.id, quantityReq: 3 },
  });
  await prisma.requestStatusHistory.createMany({
    data: [
      { requestId: req4.id, toStatus: 'REQUESTED', changedBy: uKumar.id, createdAt: daysAgo(10) },
      { requestId: req4.id, fromStatus: 'REQUESTED', toStatus: 'REJECTED', changedBy: adminId, notes: 'Budget constraint.', createdAt: daysAgo(8) },
    ],
  });

  // ─── Request 5: CANCELLED — Riya: sanitizer ──────────────────────────────
  const req5 = await prisma.request.create({
    data: {
      userId: uRiya.id, status: 'CANCELLED', sessionYear,
      notes: 'Hand sanitizer for lab benches.',
      createdAt: daysAgo(7), cancelledAt: daysAgo(6),
    },
  });
  await prisma.requestItem.create({
    data: { requestId: req5.id, itemId: iSanitizer.id, quantityReq: 5 },
  });
  await prisma.requestStatusHistory.createMany({
    data: [
      { requestId: req5.id, toStatus: 'REQUESTED',  changedBy: uRiya.id, createdAt: daysAgo(7) },
      { requestId: req5.id, fromStatus: 'REQUESTED', toStatus: 'CANCELLED', changedBy: uRiya.id, notes: 'No longer needed.', createdAt: daysAgo(6) },
    ],
  });

  // ─── Request 6: REQUESTED — Arjun: badminton rackets ─────────────────────
  const req6 = await prisma.request.create({
    data: {
      userId: uArjun.id, status: 'REQUESTED', sessionYear,
      notes: 'For inter-college sports event.',
      createdAt: daysAgo(2),
    },
  });
  await prisma.requestItem.create({
    data: { requestId: req6.id, itemId: iBadminton.id, quantityReq: 6 },
  });
  await prisma.requestStatusHistory.create({
    data: { requestId: req6.id, toStatus: 'REQUESTED', changedBy: uArjun.id, createdAt: daysAgo(2) },
  });

  // ─── Request 7: PENDING — Kumar: cartridges ───────────────────────────────
  const req7 = await prisma.request.create({
    data: {
      userId: uKumar.id, status: 'PENDING', sessionYear,
      notes: 'Printer cartridges for CS department office.',
      adminId, adminNotes: 'Reviewing budget allocation.',
      createdAt: daysAgo(4),
    },
  });
  await prisma.requestItem.create({
    data: { requestId: req7.id, itemId: iCartridge.id, quantityReq: 3, quantityAllocated: 3 },
  });
  await prisma.requestStatusHistory.createMany({
    data: [
      { requestId: req7.id, toStatus: 'REQUESTED', changedBy: uKumar.id, createdAt: daysAgo(4) },
      { requestId: req7.id, fromStatus: 'REQUESTED', toStatus: 'PENDING', changedBy: adminId, createdAt: daysAgo(3) },
    ],
  });

  // ─── Stock alerts ─────────────────────────────────────────────────────────
  console.log('Creating stock alerts...');

  await prisma.stockAlert.createMany({
    data: [
      { itemId: iMicroscope.id, userId: storeId, message: 'Compound microscope stock is low (8 units remaining).', isRead: false, createdAt: daysAgo(9) },
      { itemId: iCabinet.id,    userId: storeId, message: 'Filing cabinet stock is critically low (6 units).', isRead: true, resolvedAt: daysAgo(1), createdAt: daysAgo(9) },
    ],
  });

  // ─── Notifications ────────────────────────────────────────────────────────
  console.log('Creating notifications...');

  await prisma.notification.createMany({
    data: [
      { userId: uRiya.id,  requestId: req1.id, type: 'REQUEST_APPROVED',  title: 'Request Approved',       message: 'Your request for pens and chalk has been approved.',                       isRead: true,  createdAt: daysAgo(18) },
      { userId: uArjun.id, requestId: req2.id, type: 'REQUEST_APPROVED',  title: 'Request Approved',       message: 'Your HDMI cable request has been approved.',                               isRead: true,  createdAt: daysAgo(13) },
      { userId: uPriya.id, requestId: req3.id, type: 'REQUEST_APPROVED',  title: 'Request Approved',       message: 'Your lab equipment request has been approved.',                            isRead: true,  createdAt: daysAgo(10) },
      { userId: uKumar.id, requestId: req4.id, type: 'REQUEST_REJECTED',  title: 'Request Rejected',       message: 'Your filing cabinet request was rejected due to budget constraints.',       isRead: false, createdAt: daysAgo(8)  },
      { userId: uRiya.id,  requestId: req5.id, type: 'REQUEST_CANCELLED', title: 'Request Cancelled',      message: 'Your sanitizer request has been cancelled.',                               isRead: true,  createdAt: daysAgo(6)  },
      { userId: uArjun.id, requestId: req6.id, type: 'REQUEST_CREATED',   title: 'Request Submitted',      message: 'Your request for badminton rackets has been submitted.',                   isRead: false, createdAt: daysAgo(2)  },
      { userId: uKumar.id, requestId: req7.id, type: 'REQUEST_PENDING',   title: 'Request Under Review',   message: 'Your printer cartridge request is under review.',                          isRead: false, createdAt: daysAgo(3)  },
      { userId: storeId,   requestId: req1.id, type: 'STOCK_ALERT',       title: 'Items to Fulfil',        message: 'Request #1 approved — please fulfil pens and chalk for Riya Sharma.',      isRead: true,  createdAt: daysAgo(18) },
      { userId: storeId,                        type: 'STOCK_ALERT',       title: 'Low Stock: Microscope',  message: 'Compound microscope stock has fallen to 8 units.',                         isRead: false, createdAt: daysAgo(9)  },
    ],
  });

  // ─── Audit logs ───────────────────────────────────────────────────────────
  console.log('Creating audit logs...');

  await prisma.auditLog.createMany({
    data: [
      { userId: adminId,  action: 'CREATE',          entity: 'InventoryItem', entityId: iPen.id,        metadata: { name: 'Ballpoint Pen (Blue)', qty: 300 },              createdAt: daysAgo(30) },
      { userId: adminId,  action: 'CREATE',          entity: 'InventoryItem', entityId: iMicroscope.id, metadata: { name: 'Compound Microscope', qty: 10 },                createdAt: daysAgo(30) },
      { userId: adminId,  action: 'APPROVE_REQUEST', entity: 'Request',       entityId: req1.id,        metadata: { approvedFor: uRiya.id,  items: ['Pen', 'Chalk'] },    createdAt: daysAgo(18) },
      { userId: adminId,  action: 'APPROVE_REQUEST', entity: 'Request',       entityId: req2.id,        metadata: { approvedFor: uArjun.id, items: ['HDMI Cable'] },      createdAt: daysAgo(13) },
      { userId: adminId,  action: 'APPROVE_REQUEST', entity: 'Request',       entityId: req3.id,        metadata: { approvedFor: uPriya.id, items: ['Goggles', 'Microscope'] }, createdAt: daysAgo(10) },
      { userId: adminId,  action: 'REJECT_REQUEST',  entity: 'Request',       entityId: req4.id,        metadata: { reason: 'Budget constraint' },                         createdAt: daysAgo(8)  },
      { userId: storeId,  action: 'FULFIL_REQUEST',  entity: 'Request',       entityId: req1.id,        metadata: { items: ['Ballpoint Pen (Blue)', 'Chalk Box White'] },  createdAt: daysAgo(17) },
      { userId: storeId,  action: 'FULFIL_REQUEST',  entity: 'Request',       entityId: req2.id,        metadata: { items: ['HDMI Cable 2m'] },                            createdAt: daysAgo(12) },
      { userId: storeId,  action: 'FULFIL_REQUEST',  entity: 'Request',       entityId: req3.id,        metadata: { items: ['Safety Goggles', 'Compound Microscope'] },   createdAt: daysAgo(9)  },
      { userId: uRiya.id, action: 'CANCEL_REQUEST',  entity: 'Request',       entityId: req5.id,        metadata: { reason: 'No longer needed' },                          createdAt: daysAgo(6)  },
    ],
  });

  console.log('\nSeed2 complete.');
  console.log('  Users:             6   (email domain @seed2.test)');
  console.log('  Inventory items:   10  (slug prefix seed2-)');
  console.log('  Requests:          7   (APPROVED x3, PENDING x1, REQUESTED x1, REJECTED x1, CANCELLED x1)');
  console.log('  Expenditure rows:  4');
  console.log('  Stock history:     17+');
  console.log('  Notifications:     9');
  console.log('  Audit logs:        10');
  console.log('\n  Password for all seed2 users: dummypass123');
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Seed2 error:', error);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
