export const RACM_FIELD_LABELS = {
  control_number: 'Control Number',
  area: 'Area',
  risk_heat: 'Risk Heat',
  standard_control_description: 'Standard Control Description',
  sub_process: 'Sub Process',
  risk_description: 'Risk Description',
  whether_fraud_risks_exist: 'Whether Fraud Risks Exist',
  control_objective: 'Control Objective',
  process_walkthrough: 'Process Activity and Walkthrough Details',
  control_relies_on_ipe: 'Does the Control Rely on IPE?',
  audit_evidence_accuracy: 'Audit Evidence of Accuracy and Completeness',
  ipe_reference: 'IPE Reference',
  key_control: 'Key Control',
  application_name: 'Application Name',
  control_performer: 'Control Performer',
  control_design_procs: 'Procedures to Evaluate Design and Implementation',
  control_type_fo: 'Type of control (Operational/Financial)',
  control_type_ma: 'Type of control (Manual/ Automated)',
  nature_of_control: 'Nature of Control',
  control_owner: 'Control Owner',
  control_frequency: 'Control Frequency',
  sample_size: 'Sample Size',
  sample_required: 'Sample Required',
  completeness: 'Completeness',
  existence_occurrence: 'Existence & Occurrence',
  rights_and_obligation: 'Rights and Obligations',
  valuation_and_allocation: 'Valuation & Allocation',
  presentation_and_disclosure: 'Presentation and Disclosure',
  control_design_conclusion: 'Conclusion on Design of Control',
  design_deficiency_desc: 'Description of Deficiency in Control Design',
  doc_uploaded_by_user: 'Doc Uploaded by User',
  remarks_by_user: 'Remarks by User',
  active: 'Active',
  approved_rejected: 'Approved/Rejected',
  status: 'Status',
  reason_by_approver: 'Reason by Approver',
}

// Requested display priority for "Control Details" section.
export const CONTROL_DETAIL_SEQUENCE = [
  'control_objective',
  'standard_control_description',
  'process_walkthrough',
  'control_type_fo',
  'control_relies_on_ipe',
  'ipe_reference',
  'audit_evidence_accuracy',
  'nature_of_control',
  'control_type_ma',
  'key_control',
  'application_name',
  'control_frequency',
  'control_performer',
  'control_owner',
  'whether_fraud_risks_exist',
]

export const orderControlDetailKeys = (keys, fallbackOrder = []) => {
  const preferredIndex = new Map(CONTROL_DETAIL_SEQUENCE.map((key, index) => [key, index]))
  const fallbackIndex = new Map(fallbackOrder.map((key, index) => [key, index]))

  return [...keys].sort((a, b) => {
    const aPreferred = preferredIndex.has(a)
    const bPreferred = preferredIndex.has(b)

    if (aPreferred && bPreferred) {
      return preferredIndex.get(a) - preferredIndex.get(b)
    }
    if (aPreferred) return -1
    if (bPreferred) return 1

    return (fallbackIndex.get(a) ?? Number.MAX_SAFE_INTEGER) - (fallbackIndex.get(b) ?? Number.MAX_SAFE_INTEGER)
  })
}
