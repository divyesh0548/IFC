const { hashPassword, getPasswordPepper } = require('../utils/password');
let bootstrapPromise = null;
let prismaClient = null;

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

function getPrisma() {
  if (!prismaClient) {
    ({ prisma: prismaClient } = require('../lib/prisma'));
  }
  return prismaClient;
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
  const prisma = getPrisma();

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
  const { seedDefaultBusinessProcesses } = require('../utils/business_process_master');
  const result = await seedDefaultBusinessProcesses(DEFAULT_BUSINESS_PROCESSES);
  if (result.inserted === 0 && result.updated === 0) {
    console.log('[bootstrap] Default business processes already present. Skipping seed.');
    return;
  }

  console.log(`[bootstrap] Default business processes synced. Inserted: ${result.inserted}, Updated: ${result.updated}.`);
}

async function ensureDefaultRacmTemplates() {
  const { pool } = require('../utils/db');
  const {
    seedDefaultTemplatesForAllUnits,
    isRacmTemplateSchemaReady,
  } = require('../utils/racm_templates');
  const client = await pool.connect();

  try {
    if (!(await isRacmTemplateSchemaReady(client))) {
      console.warn('[bootstrap] racm_templates tables missing. Skipping RACM template seed.');
      return;
    }

    const result = await seedDefaultTemplatesForAllUnits(client);
    console.log(
      `[bootstrap] RACM templates synced. Scanned: ${result.scanned}, Created: ${result.created}.`
    );
  } finally {
    client.release();
  }
}

async function runBootstrap() {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    try {
      await ensureDefaultBusinessProcesses();
      await ensureAdminUserFromEnv();
      await ensureDefaultRacmTemplates();
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
