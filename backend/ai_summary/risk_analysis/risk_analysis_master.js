const fs = require('fs');
const path = require('path');

const RISK_ANALYSIS_BUSINESS_PROCESS_FILES = [
  {
    businessProcess: 'Capital Expenditure',
    jsonFile: path.resolve(__dirname, 'base_data', 'CAP_Ex.json'),
    aliases: ['capital expenditure', 'capex'],
  },
];

const RISK_ANALYSIS_MASTER_FILES = Object.freeze(
  RISK_ANALYSIS_BUSINESS_PROCESS_FILES.reduce((accumulator, entry) => {
    const filePath = String(entry?.jsonFile || '').trim();
    const supportedNames = [entry?.businessProcess, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])];

    for (const name of supportedNames) {
      const normalizedName = normalizeBusinessProcessKey(name);
      if (normalizedName && filePath) {
        accumulator[normalizedName] = filePath;
      }
    }

    return accumulator;
  }, {})
);

function normalizeBusinessProcessKey(value) {
  return String(value || '').trim().toLowerCase();
}

function listRiskAnalysisBusinessProcesses() {
  return RISK_ANALYSIS_BUSINESS_PROCESS_FILES.map((entry) => ({
    businessProcess: entry.businessProcess,
    jsonFile: path.basename(entry.jsonFile),
  }));
}

function resolveRiskAnalysisMasterFilePath(businessProcess) {
  return RISK_ANALYSIS_MASTER_FILES[normalizeBusinessProcessKey(businessProcess)] || null;
}

function loadRiskAnalysisMasterByBusinessProcess(businessProcess) {
  const filePath = resolveRiskAnalysisMasterFilePath(businessProcess);
  if (!filePath) {
    const error = new Error('Risk Analysis is not available for this Business Process');
    error.statusCode = 400;
    error.code = 'RISK_ANALYSIS_NOT_AVAILABLE';
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const wrappedError = new Error(`Failed to read risk analysis master file: ${error.message}`);
    wrappedError.statusCode = 500;
    throw wrappedError;
  }

  const subProcesses = Array.isArray(parsed?.sub_processes) ? parsed.sub_processes : [];
  if (subProcesses.length === 0) {
    const error = new Error('Risk analysis master file does not contain any sub-process definitions.');
    error.statusCode = 500;
    throw error;
  }

  return {
    filePath,
    master: parsed,
  };
}

module.exports = {
  RISK_ANALYSIS_BUSINESS_PROCESS_FILES,
  RISK_ANALYSIS_MASTER_FILES,
  listRiskAnalysisBusinessProcesses,
  resolveRiskAnalysisMasterFilePath,
  loadRiskAnalysisMasterByBusinessProcess,
};
