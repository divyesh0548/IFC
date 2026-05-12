const path = require('path');
const { spawnSync } = require('child_process');
const { prisma } = require('../lib/prisma');
const { ensureDatabaseExists } = require('./ensureDatabase');
const { hashPassword, getPasswordPepper } = require('../utils/password');
let bootstrapPromise = null;

const backendRoot = path.join(__dirname, '..');
const DEFAULT_BUSINESS_PROCESSES = [
  { businessProcess: 'Purchase to Pay', businessProcessCode: 'P2P' },
  { businessProcess: 'Order to Cash', businessProcessCode: 'O2C' },
  { businessProcess: 'Hire to Retire', businessProcessCode: 'H2R' },
  { businessProcess: 'Capital Expenditure', businessProcessCode: 'CAPEX' },
  { businessProcess: 'Treasury', businessProcessCode: 'TRSY' },
  { businessProcess: 'Financial Statement Closure Process', businessProcessCode: 'FSCP' },
  { businessProcess: 'Information Technology General Controls', businessProcessCode: 'ITGC' },
  { businessProcess: 'Entity Level Controls', businessProcessCode: 'ELC' },
];

function runNpxPrisma(args) {
  const result = spawnSync('npx', ['prisma', ...args], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`\`npx prisma ${args.join(' ')}\` exited with code ${result.status}`);
  }
}

function runPrismaGenerate() {
  // In dev, running `prisma generate` on each boot causes nodemon restart loops
  // because the generated client files are written every time.
  if (process.env.RUN_PRISMA_GENERATE_ON_BOOT !== '1') { 
    console.log('[bootstrap] Skipping prisma generate on boot (set RUN_PRISMA_GENERATE_ON_BOOT=1 to enable).');
    return;
  }
  runNpxPrisma(['generate']);
}

async function ensureAdminUserFromEnv() {
  const adminEmail = String(process.env.ADMIN_EMAIL_ID || '').trim();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
  const adminRole = String(process.env.ADMIN_ROLE || 'siteadmin').trim() || 'siteadmin';

  if (!adminEmail || !adminPassword) {
    console.warn('[bootstrap] ADMIN_EMAIL_ID / ADMIN_PASSWORD not configured. Skipping admin seed.');
    return;
  }

  getPasswordPepper();

  const existing = await prisma.ifcUser.findFirst({
    where: {
      emailId: {
        equals: adminEmail,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  });

  if (existing) {
    console.log(`[bootstrap] Admin user already exists for ${adminEmail}. Skipping.`);
    return;
  }

  const adminPasswordHash = await hashPassword(adminPassword);

  await prisma.ifcUser.create({
    data: {
      emailId: adminEmail,
      password: adminPasswordHash,
      role: adminRole,
      companyIdentifier: null,
      tempLogin: false,
    },
  });

  console.log(`[bootstrap] Admin user created for ${adminEmail}.`);
}

async function ensureDefaultBusinessProcesses() {
  const existing = await prisma.busineesProcessCode.findMany({
    where: {
      businessProcessCode: {
        in: DEFAULT_BUSINESS_PROCESSES.map((item) => item.businessProcessCode),
      },
    },
    select: { businessProcessCode: true },
  });

  const existingCodes = new Set(existing.map((item) => String(item.businessProcessCode || '').trim().toUpperCase()));
  const missingRows = DEFAULT_BUSINESS_PROCESSES.filter(
    (item) => !existingCodes.has(String(item.businessProcessCode).trim().toUpperCase())
  );

  if (missingRows.length === 0) {
    console.log('[bootstrap] Default business processes already present. Skipping seed.');
    return;
  }

  await prisma.busineesProcessCode.createMany({
    data: missingRows,
  });
  console.log(`[bootstrap] Seeded ${missingRows.length} default business process row(s).`);
}

async function runBootstrap() {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    try {
      await ensureDatabaseExists();
      runPrismaGenerate();
      await ensureDefaultBusinessProcesses();
      await ensureAdminUserFromEnv();
    } catch (error) {
      console.error('[bootstrap] Startup bootstrap failed:', error);
      throw error;
    }
  })();

  try {
    await bootstrapPromise;
  } catch (error) {
    // Allow retry if caller handles failure and calls again.
    bootstrapPromise = null;
    throw error;
  }
}

module.exports = {
  runBootstrap,
};
