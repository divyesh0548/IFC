const {
  getSampleSizeByFrequency,
  resolveControlFrequencyCategory,
  calculateSampleRequired,
  SUPPORTED_CONTROL_FREQUENCY_CATEGORIES,
  parseSampleSize,
} = require('./sample_required');

async function loadUnitFrequencySampleSizeMap(clientOrPool, companyIdentifier, unitId) {
  const companyId = String(companyIdentifier || '').trim();
  const unit = String(unitId || '').trim();
  if (!companyId || !unit) {
    return new Map();
  }

  const result = await clientOrPool.query(
    `
      SELECT frequency_key, sample_size
      FROM company_frequency_sample_size
      WHERE company_identifier = $1
        AND unit_id = $2
    `,
    [companyId, unit]
  );

  const map = new Map();
  for (const row of result.rows) {
    const key = String(row.frequency_key || '').trim();
    const size = Number(row.sample_size);
    if (key && Number.isFinite(size)) {
      map.set(key, size);
    }
  }

  return map;
}

function resolveUnitDefaultSampleSize(controlFrequency, unitConfigMap) {
  const category = resolveControlFrequencyCategory(controlFrequency);
  if (!category) {
    return null;
  }

  const configured = unitConfigMap?.get(category.key);
  if (configured != null && Number.isFinite(configured)) {
    return configured;
  }

  return category.sampleSize;
}

function getCategoryByFrequencyKey(frequencyKey) {
  const key = String(frequencyKey || '').trim();
  return SUPPORTED_CONTROL_FREQUENCY_CATEGORIES.find((item) => item.key === key) || null;
}

function validateSampleSizeValue(controlFrequencyOrKey, sampleSize) {
  const category = resolveControlFrequencyCategory(controlFrequencyOrKey)
    || getCategoryByFrequencyKey(controlFrequencyOrKey);
  if (!category) {
    return { ok: false, message: 'Unsupported control frequency' };
  }

  const parsed = parseSampleSize(sampleSize);
  if (parsed === null) {
    return { ok: false, message: 'Sample size must be a positive integer' };
  }

  if (parsed < category.sampleSize) {
    return {
      ok: false,
      message: `Sample size cannot be lower than ${category.sampleSize} for ${category.value}`,
      minimum: category.sampleSize,
    };
  }

  if (category.maxSampleSize != null && parsed > category.maxSampleSize) {
    return {
      ok: false,
      message: `Sample size cannot exceed ${category.maxSampleSize} for ${category.value}`,
      maximum: category.maxSampleSize,
      minimum: category.sampleSize,
    };
  }

  return {
    ok: true,
    sampleSize: parsed,
    minimum: category.sampleSize,
    maximum: category.maxSampleSize ?? null,
    category,
  };
}

function buildSampleSizeForFrequency(controlFrequency, createdAt, sampleSize) {
  const validation = validateSampleSizeValue(controlFrequency, sampleSize);
  if (!validation.ok) {
    return validation;
  }

  const sampleRequired = calculateSampleRequired(
    controlFrequency,
    createdAt,
    validation.sampleSize
  );

  if (!sampleRequired) {
    return {
      ok: false,
      message: `Unable to generate sample intervals for ${validation.category.value} with sample size ${validation.sampleSize}. Try a lower value.`,
      minimum: validation.minimum,
    };
  }

  return {
    ok: true,
    sampleSize: validation.sampleSize,
    sampleRequired,
    minimum: validation.minimum,
  };
}

async function resolveEffectiveSampleSizeForUnit(clientOrPool, {
  companyIdentifier,
  unitId,
  controlFrequency,
  explicitSampleSize,
}) {
  const category = resolveControlFrequencyCategory(controlFrequency);
  if (!category) {
    return { ok: false, message: 'Unsupported control frequency' };
  }

  if (explicitSampleSize !== undefined && explicitSampleSize !== null && String(explicitSampleSize).trim() !== '') {
    return validateSampleSizeValue(controlFrequency, explicitSampleSize);
  }

  const unitMap = await loadUnitFrequencySampleSizeMap(clientOrPool, companyIdentifier, unitId);
  const defaultSize = resolveUnitDefaultSampleSize(controlFrequency, unitMap);
  if (defaultSize === null) {
    return { ok: false, message: 'Unsupported control frequency' };
  }

  return {
    ok: true,
    sampleSize: defaultSize,
    minimum: category.sampleSize,
  };
}

function buildUnitSampleSizeConfigResponse(unitConfigMap) {
  return SUPPORTED_CONTROL_FREQUENCY_CATEGORIES.map(({ key, value, sampleSize, maxSampleSize }) => {
    const configured = unitConfigMap.get(key);
    return {
      frequency_key: key,
      frequency_label: value,
      minimum_sample_size: sampleSize,
      maximum_sample_size: maxSampleSize ?? null,
      configured_sample_size: configured ?? null,
      effective_sample_size: configured ?? sampleSize,
    };
  });
}

module.exports = {
  loadUnitFrequencySampleSizeMap,
  resolveUnitDefaultSampleSize,
  validateSampleSizeValue,
  buildSampleSizeForFrequency,
  resolveEffectiveSampleSizeForUnit,
  buildUnitSampleSizeConfigResponse,
  getMinimumSampleSize: getSampleSizeByFrequency,
};
