const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../lib/prisma');
const { requestControlSummary } = require('./ollama_client');
const { isKeyControlValue } = require('../utils/key_control_classification');

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isManualKeyControl(row) {
  const controlTypeMa = normalizeValue(row.controlTypeMa);

  return isKeyControlValue(row.keyControl) && controlTypeMa === 'manual';
}

function toLlMInputRow(row) {
  return {
    controlNumber: String(row.controlNumber || '').trim(),
    businessProcess: String(row.businessProcess || '').trim(),
    subProcess: String(row.subProcess || '').trim(),
    riskDescription: String(row.riskDescription || '').trim(),
    controlObjective: String(row.controlObjective || '').trim(),
    standardControlDescription: String(row.standardControlDescription || '').trim(),
    natureOfControl: String(row.natureOfControl || '').trim(),
    controlFrequency: String(row.controlFrequency || '').trim(),
    whetherFraudRisksExist: String(row.whetherFraudRisksExist || '').trim(),
    controlTypeFo: String(row.controlTypeFo || '').trim(),
    controlTypeMa: String(row.controlTypeMa || '').trim(),
    keyControl: String(row.keyControl || '').trim(),
    riskHeat: String(row.riskHeat || '').trim(),
    controlReliesOnIpe: String(row.controlReliesOnIpe || '').trim(),
    applicationName: String(row.applicationName || '').trim(),
  };
}

function printSectionDivider(label) {
  console.log('');
  console.log('='.repeat(80));
  console.log(label);
  console.log('='.repeat(80));
}

async function fetchCompanyControlForms(companyIdentifier) {
  return prisma.controlForm.findMany({
    where: {
      companyIdentifier,
    },
    select: {
      controlNumber: true,
      businessProcess: true,
      subProcess: true,
      riskDescription: true,
      controlObjective: true,
      standardControlDescription: true,
      natureOfControl: true,
      controlFrequency: true,
      whetherFraudRisksExist: true,
      controlTypeFo: true,
      controlTypeMa: true,
      keyControl: true,
      riskHeat: true,
      controlReliesOnIpe: true,
      applicationName: true,
    },
    orderBy: [
      { businessProcess: 'asc' },
      { controlNumber: 'asc' },
    ],
  });
}

async function main() {
  const companyIdentifier = String(process.argv[2] || '').trim();

  if (!companyIdentifier) {
    console.error('Usage: node llm_racm_summary/generate_company_racm_rationalisation.js <company_identifier>');
    process.exitCode = 1;
    return;
  }

  console.log(`Fetching RACMs for company_identifier=${companyIdentifier}`);

  const allRows = await fetchCompanyControlForms(companyIdentifier);
  const filteredRows = allRows.filter(isManualKeyControl);

  if (filteredRows.length === 0) {
  console.log('No manual + key controls found for the provided company_identifier.');
    return;
  }

  console.log(`Found ${filteredRows.length} matching manual + key controls.`);

  for (const row of filteredRows) {
    const businessProcess = String(row.businessProcess || '').trim() || 'Unspecified Business Process';
    printSectionDivider(`Business Process: ${businessProcess} | Control: ${String(row.controlNumber || '').trim()}`);

    const llmResult = await requestControlSummary({
      companyIdentifier,
      businessProcess,
      control: toLlMInputRow(row),
    });

    console.log(JSON.stringify(llmResult, null, 2));
  }
}

main()
  .catch((error) => {
    console.error('Failed to generate RACM rationalisation summary.');
    if (error?.code === 'ECONNREFUSED') {
      console.error('Database connection was refused. Confirm Postgres/RDS is reachable with the host and port from backend/.env.');
      console.error(`Resolved DB host: ${process.env.DB_HOST || '(empty)'}`);
      console.error(`Resolved DB port: ${process.env.DB_PORT || '(empty)'}`);
    }
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
