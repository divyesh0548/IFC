import React, { useState, useEffect } from 'react'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import UnitUserSearchAutocomplete from '../../components/company_co/UnitUserSearchAutocomplete'

function Control_form() {
  const theme = useTheme()
  
  const [formData, setFormData] = useState({
    descriptionOfControl: '',
    process: '',
    subProcess: '',
    riskDescription: '',
    whetherFraudRisksExist: '',
    controlObjective: '',
    controlToAddressWhatCouldGoWrong: '',
    whetherManagementReviewControl: '',
    gapDescriptionAndResolution: '',
    informationProducedByEntity: '',
    relevantDataElementsOfIPE: '',
    typeOfControl: '',
    natureOfControl: '',
    typeOfRiskMitigationMethod: '',
    unit_id: '',
    processOwner: '',
    processOwnerUser: null,
    reviewerProcessSupervisor: '',
    controlFrequency: '',
    basisOfSampling: '',
    documentsToBeReviewed: '',
    typeOfRiskAssociated: '',
    financialReportingHead: '',
    checksPerformed: '',
    effectiveOrNotEffective: '',
    done: '',
    findings: '',
    // Assertions (boolean)
    completeness: false,
    existence_occurrence: false,
    rights_and_obligation: false,
    valuation_and_allocation: false,
    presentation_and_disclosure: false,
    due_date: '',
    reminder_frequency: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [unitOptions, setUnitOptions] = useState([])
  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false

    const fetchUnits = async () => {
      try {
        const response = await fetch(apiUrl('/api/company-co/assigned-units'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()

        if (!cancelled && response.ok && data.success) {
          const units = Array.isArray(data.units) ? data.units : []
          setUnitOptions(units)
          setFormData((prev) => ({
            ...prev,
            unit_id: prev.unit_id || units[0]?.unit_id || '',
          }))
        }
      } catch (fetchError) {
        console.error('Error fetching coordinator units:', fetchError)
        if (!cancelled) {
          setUnitOptions([])
        }
      }
    }

    fetchUnits()

    return () => {
      cancelled = true
    }
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'unit_id' ? { processOwner: '', processOwnerUser: null } : {}),
    }))
  }

  const handleAssertionToggle = (field) => (e) => {
    const checked = !!e.target.checked
    setFormData((prev) => ({
      ...prev,
      [field]: checked,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const dueDateValue = String(formData.due_date || '').trim()
      const reminderFrequencyValue = String(formData.reminder_frequency || '').trim()
      if ((dueDateValue && !reminderFrequencyValue) || (!dueDateValue && reminderFrequencyValue)) {
        setError('Please fill both Due Date and Reminder Frequency (or keep both empty).')
        setLoading(false)
        return
      }

      // TODO: Implement API call to save form data
      // const response = await fetch(apiUrl('/api/control-form'), {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   credentials: 'include',
      //   body: JSON.stringify(formData)
      // })

      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setSuccess('Form submitted successfully!')
      console.log('Form Data:', formData)
    } catch (err) {
      console.error('Form submission error:', err)
      setError('Failed to submit form. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFormData({
      descriptionOfControl: '',
      process: '',
      subProcess: '',
      riskDescription: '',
      whetherFraudRisksExist: '',
      controlObjective: '',
      controlToAddressWhatCouldGoWrong: '',
      whetherManagementReviewControl: '',
      gapDescriptionAndResolution: '',
      informationProducedByEntity: '',
      relevantDataElementsOfIPE: '',
      typeOfControl: '',
      natureOfControl: '',
      typeOfRiskMitigationMethod: '',
      unit_id: unitOptions[0]?.unit_id || '',
      processOwner: '',
      processOwnerUser: null,
      reviewerProcessSupervisor: '',
      controlFrequency: '',
      basisOfSampling: '',
      documentsToBeReviewed: '',
      typeOfRiskAssociated: '',
      financialReportingHead: '',
      checksPerformed: '',
      effectiveOrNotEffective: '',
      done: '',
      findings: '',
      due_date: '',
      reminder_frequency: '',
    })
    setError('')
    setSuccess('')
  }

  return (
    <div className="min-h-screen bg-primary py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-secondary mb-8 text-center">
            RACM
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <div className="border-b border-gray-300 pb-4">
              <h2 className="text-xl font-semibold text-secondary mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="descriptionOfControl" className="block text-sm font-medium text-secondary mb-2">
                    Description of Control
                  </label>
                  <input
                    type="text"
                    id="descriptionOfControl"
                    name="descriptionOfControl"
                    value={formData.descriptionOfControl}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter description of control"
                  />
                </div>

                <div>
                  <label htmlFor="process" className="block text-sm font-medium text-secondary mb-2">
                    Process
                  </label>
                  <input
                    type="text"
                    id="process"
                    name="process"
                    value={formData.process}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter process"
                  />
                </div>

                <div>
                  <label htmlFor="subProcess" className="block text-sm font-medium text-secondary mb-2">
                    Sub-process
                  </label>
                  <input
                    type="text"
                    id="subProcess"
                    name="subProcess"
                    value={formData.subProcess}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter sub-process"
                  />
                </div>

                <div>
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel id="control-form-unit-label">Unit</InputLabel>
                    <Select
                      labelId="control-form-unit-label"
                      id="unit_id"
                      name="unit_id"
                      value={formData.unit_id}
                      label="Unit"
                      onChange={handleChange}
                    >
                      {unitOptions.map((unit) => (
                        <MenuItem key={unit.unit_id} value={unit.unit_id}>
                          {unit.unit_name || unit.unit_id}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>

                <div>
                  <Box sx={{ mb: 2 }}>
                    <UnitUserSearchAutocomplete
                      unitId={formData.unit_id}
                      value={formData.processOwnerUser}
                      onChange={(user) => {
                        setFormData((prev) => ({
                          ...prev,
                          processOwnerUser: user,
                          processOwner: user?.email_id?.trim() || '',
                        }))
                      }}
                      prefetch
                      inDialog={false}
                      label="Process owner"
                      placeholder="Search by name or email..."
                      disabled={!formData.unit_id}
                      helperText={
                        formData.processOwner ||
                        (formData.unit_id ? 'Select a user from this unit' : 'Select a unit first')
                      }
                    />
                  </Box>
                </div>

                <div>
                  <label htmlFor="reviewerProcessSupervisor" className="block text-sm font-medium text-secondary mb-2">
                    Reviewer/ Process Supervisor
                  </label>
                  <input
                    type="text"
                    id="reviewerProcessSupervisor"
                    name="reviewerProcessSupervisor"
                    value={formData.reviewerProcessSupervisor}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter reviewer/process supervisor"
                  />
                </div>
              </div>
            </div>

            {/* Risk Assessment Section */}
            <div className="border-b border-gray-300 pb-4">
              <h2 className="text-xl font-semibold text-secondary mb-4">Risk Assessment</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="riskDescription" className="block text-sm font-medium text-secondary mb-2">
                    Risk Description / What Could Go Wrong (Misstatement, Misrepresentation, etc.)
                  </label>
                  <textarea
                    id="riskDescription"
                    name="riskDescription"
                    value={formData.riskDescription}
                    onChange={handleChange}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter risk description"
                  />
                </div>

                <div>
                  <label htmlFor="whetherFraudRisksExist" className="block text-sm font-medium text-secondary mb-2">
                    Whether fraud risks exist
                  </label>
                  <input
                    type="text"
                    id="whetherFraudRisksExist"
                    name="whetherFraudRisksExist"
                    value={formData.whetherFraudRisksExist}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Yes/No"
                  />
                </div>

                <div>
                  <label htmlFor="typeOfRiskAssociated" className="block text-sm font-medium text-secondary mb-2">
                    Type of risk associated with the process flow
                  </label>
                  <input
                    type="text"
                    id="typeOfRiskAssociated"
                    name="typeOfRiskAssociated"
                    value={formData.typeOfRiskAssociated}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter type of risk"
                  />
                </div>
              </div>
            </div>

            {/* Control Information Section */}
            <div className="border-b border-gray-300 pb-4">
              <h2 className="text-xl font-semibold text-secondary mb-4">Control Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="controlObjective" className="block text-sm font-medium text-secondary mb-2">
                    Control Objective
                  </label>
                  <input
                    type="text"
                    id="controlObjective"
                    name="controlObjective"
                    value={formData.controlObjective}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter control objective"
                  />
                </div>

                <div>
                  <label htmlFor="controlToAddressWhatCouldGoWrong" className="block text-sm font-medium text-secondary mb-2">
                    Control to address 'What could go wrong'
                  </label>
                  <input
                    type="text"
                    id="controlToAddressWhatCouldGoWrong"
                    name="controlToAddressWhatCouldGoWrong"
                    value={formData.controlToAddressWhatCouldGoWrong}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter control description"
                  />
                </div>

                <div>
                  <label htmlFor="whetherManagementReviewControl" className="block text-sm font-medium text-secondary mb-2">
                    Whether Management Review Control (MRC) or not
                  </label>
                  <input
                    type="text"
                    id="whetherManagementReviewControl"
                    name="whetherManagementReviewControl"
                    value={formData.whetherManagementReviewControl}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Yes/No"
                  />
                </div>

                <div>
                  <label htmlFor="typeOfControl" className="block text-sm font-medium text-secondary mb-2">
                    Type of Control (Preventive, detective)
                  </label>
                  <input
                    type="text"
                    id="typeOfControl"
                    name="typeOfControl"
                    value={formData.typeOfControl}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Preventive/Detective"
                  />
                </div>

                <div>
                  <label htmlFor="natureOfControl" className="block text-sm font-medium text-secondary mb-2">
                    Nature of Control (Manual or Automated)
                  </label>
                  <input
                    type="text"
                    id="natureOfControl"
                    name="natureOfControl"
                    value={formData.natureOfControl}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Manual/Automated"
                  />
                </div>

                <div>
                  <label htmlFor="controlFrequency" className="block text-sm font-medium text-secondary mb-2">
                    Control frequency (Recurring, weekly, monthly)
                  </label>
                  <input
                    type="text"
                    id="controlFrequency"
                    name="controlFrequency"
                    value={formData.controlFrequency}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter control frequency"
                  />
                </div>

                <div>
                  <label htmlFor="typeOfRiskMitigationMethod" className="block text-sm font-medium text-secondary mb-2">
                    Type of Risk Mitigation method exercised (Insurance, hedging, sign offs, approvals)
                  </label>
                  <input
                    type="text"
                    id="typeOfRiskMitigationMethod"
                    name="typeOfRiskMitigationMethod"
                    value={formData.typeOfRiskMitigationMethod}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter risk mitigation method"
                  />
                </div>
              </div>
            </div>

            {/* IPE and Data Section */}
            <div className="border-b border-gray-300 pb-4">
              <h2 className="text-xl font-semibold text-secondary mb-4">Information Produced by Entity (IPE)</h2>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="informationProducedByEntity" className="block text-sm font-medium text-secondary mb-2">
                    Information Produced by the Entity (IPE) implemented in the operation of the Control - Source data/ Report logic/ Report parameters
                  </label>
                  <textarea
                    id="informationProducedByEntity"
                    name="informationProducedByEntity"
                    value={formData.informationProducedByEntity}
                    onChange={handleChange}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter IPE information"
                  />
                </div>

                <div>
                  <label htmlFor="relevantDataElementsOfIPE" className="block text-sm font-medium text-secondary mb-2">
                    Relevant Data Elements of IPE
                  </label>
                  <input
                    type="text"
                    id="relevantDataElementsOfIPE"
                    name="relevantDataElementsOfIPE"
                    value={formData.relevantDataElementsOfIPE}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter relevant data elements"
                  />
                </div>
              </div>
            </div>

            {/* Reminder Settings Section */}
            <div className="border-b border-gray-300 pb-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-secondary">Reminder Settings</h2>
                  <p className="text-sm text-gray-500 mt-1">Optional</p>
                </div>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  disabled={loading || (!formData.due_date && !formData.reminder_frequency)}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      due_date: '',
                      reminder_frequency: '',
                    }))
                  }
                  sx={{ textTransform: 'none' }}
                >
                  Reset
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="due_date" className="block text-sm font-medium text-secondary mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    id="due_date"
                    name="due_date"
                    value={formData.due_date}
                    min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="reminder_frequency" className="block text-sm font-medium text-secondary mb-2">
                    Reminder Frequency
                  </label>
                  <select
                    id="reminder_frequency"
                    name="reminder_frequency"
                    value={formData.reminder_frequency}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  >
                    <option value="">Select reminder frequency</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Audit and Review Section */}
            <div className="border-b border-gray-300 pb-4">
              <h2 className="text-xl font-semibold text-secondary mb-4">Audit and Review</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="basisOfSampling" className="block text-sm font-medium text-secondary mb-2">
                    Basis of sampling
                  </label>
                  <input
                    type="text"
                    id="basisOfSampling"
                    name="basisOfSampling"
                    value={formData.basisOfSampling}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter basis of sampling"
                  />
                </div>

                <div>
                  <label htmlFor="documentsToBeReviewed" className="block text-sm font-medium text-secondary mb-2">
                    Documents to be reviewed as a part of DMS audit
                  </label>
                  <input
                    type="text"
                    id="documentsToBeReviewed"
                    name="documentsToBeReviewed"
                    value={formData.documentsToBeReviewed}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter documents to be reviewed"
                  />
                </div>
              </div>
            </div>

            {/* Financial Reporting Section */}
            <div className="border-b border-gray-300 pb-4">
              <h2 className="text-xl font-semibold text-secondary mb-4">Financial Reporting</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="financialReportingHead" className="block text-sm font-medium text-secondary mb-2">
                    Financial Reporting - Head in BS & PL
                  </label>
                  <input
                    type="text"
                    id="financialReportingHead"
                    name="financialReportingHead"
                    value={formData.financialReportingHead}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter financial reporting head"
                  />
                </div>

                <div>
                  <label htmlFor="checksPerformed" className="block text-sm font-medium text-secondary mb-2">
                    Checks performed
                  </label>
                  <input
                    type="text"
                    id="checksPerformed"
                    name="checksPerformed"
                    value={formData.checksPerformed}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter checks performed"
                  />
                </div>
              </div>
            </div>

            {/* Gap and Resolution Section */}
            <div className="border-b border-gray-300 pb-4">
              <h2 className="text-xl font-semibold text-secondary mb-4">Gap and Resolution</h2>
              <div>
                <label htmlFor="gapDescriptionAndResolution" className="block text-sm font-medium text-secondary mb-2">
                  Gap Description & Resolution
                </label>
                <textarea
                  id="gapDescriptionAndResolution"
                  name="gapDescriptionAndResolution"
                  value={formData.gapDescriptionAndResolution}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  placeholder="Enter gap description and resolution"
                />
              </div>
            </div>

            {/* Assertions (checkboxes) */}
            <div className="border-b border-gray-300 pb-4">
              <h2 className="text-xl font-semibold text-secondary mb-4">Assertions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'completeness', label: 'Completeness' },
                  { key: 'existence_occurrence', label: 'Existence & Occurrence' },
                  { key: 'rights_and_obligation', label: 'Rights and Obligations' },
                  { key: 'valuation_and_allocation', label: 'Valuation & Allocation' },
                  { key: 'presentation_and_disclosure', label: 'Presentation and Disclosure' },
                ].map((a) => (
                  <div
                    key={a.key}
                    className="flex items-center justify-between border border-gray-200 rounded-md px-4 py-2"
                  >
                    <span className="text-sm font-medium text-secondary">{a.label}</span>
                    <FormControlLabel
                      sx={{ m: 0 }}
                      control={
                        <Checkbox
                          checked={!!formData[a.key]}
                          onChange={handleAssertionToggle(a.key)}
                          disabled={loading}
                        />
                      }
                      label={formData[a.key] ? 'True' : 'False'}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Status and Findings Section */}
            <div>
              <h2 className="text-xl font-semibold text-secondary mb-4">Status and Findings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="effectiveOrNotEffective" className="block text-sm font-medium text-secondary mb-2">
                    Effective or Not Effective
                  </label>
                  <input
                    type="text"
                    id="effectiveOrNotEffective"
                    name="effectiveOrNotEffective"
                    value={formData.effectiveOrNotEffective}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Effective/Not Effective"
                  />
                </div>

                <div>
                  <label htmlFor="done" className="block text-sm font-medium text-secondary mb-2">
                    DONE
                  </label>
                  <input
                    type="text"
                    id="done"
                    name="done"
                    value={formData.done}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Yes/No"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="findings" className="block text-sm font-medium text-secondary mb-2">
                    Findings
                  </label>
                  <textarea
                    id="findings"
                    name="findings"
                    value={formData.findings}
                    onChange={handleChange}
                    rows="4"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter findings"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, pt: 3 }}>
              <Button
                type="submit"
                disabled={loading}
                variant="contained"
                color="secondary"
                fullWidth
                sx={{
                  flex: 1,
                  py: 1.5,
                  fontSize: theme.typography.customSizes.medium,
                  fontWeight: 600,
                  textTransform: 'none',
                }}
              >
                {loading ? 'Submitting...' : 'Submit Form'}
              </Button>
              <Button
                type="button"
                onClick={handleReset}
                disabled={loading}
                variant="contained"
                sx={{
                  flex: 1,
                  py: 1.5,
                  fontSize: theme.typography.customSizes.medium,
                  fontWeight: 600,
                  textTransform: 'none',
                  backgroundColor: '#6b7280',
                  color: '#ffffff',
                  '&:hover': {
                    backgroundColor: '#4b5563',
                  },
                }}
              >
                Reset Form
              </Button>
            </Box>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Control_form

// Form fields: 

// "Description of Control",	"Process",	"Sub-process",	"Risk Description / What Could Go Wrong (Misstatement, Misrepresentation, etc.)",	"Whether fraud risks exist",	"Control Objective",	Control to address 'What could go wrong'",	"Whether Management Review Control (MRC) or not",	"Gap Description & Resolution",	"Information Produced by the Entity (IPE) implemented in the operation of the Control - Source data/ Report logic/ Report parameters", 	"Relevant Data Elements of IPE",	"Type of Control  (Preventive, detective)",	"Nature of Control (Manual or Automated)",	"Type of Risk Mitigation method exercised (Insurance, hedging, sign offs, approvals)",	"Process owner",	"Reviewer/ Process Supervisor",	"Control frequency (Recurring, weekly, monthly)",	"Basis of sampling",	"Documents to be reviewed as a part of DMS audit",	"Type of risk associated with the process flow",	"Financial Reporting - Head in BS & PL",	"Checks performed",	"Effective or Not Effective",	"DONE",	"Findings"
