import React, { useState } from 'react'

function Control_form() {
  
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
    processOwner: '',
    reviewerProcessSupervisor: '',
    controlFrequency: '',
    basisOfSampling: '',
    documentsToBeReviewed: '',
    typeOfRiskAssociated: '',
    financialReportingHead: '',
    checksPerformed: '',
    effectiveOrNotEffective: '',
    done: '',
    findings: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      // TODO: Implement API call to save form data
      // const response = await fetch('http://localhost:3000/api/control-form', {
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
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess('')
      }, 5000)
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
      processOwner: '',
      reviewerProcessSupervisor: '',
      controlFrequency: '',
      basisOfSampling: '',
      documentsToBeReviewed: '',
      typeOfRiskAssociated: '',
      financialReportingHead: '',
      checksPerformed: '',
      effectiveOrNotEffective: '',
      done: '',
      findings: ''
    })
    setError('')
    setSuccess('')
  }

  return (
    <div className="min-h-screen bg-primary py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-secondary mb-8 text-center">
            Control Form
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
                  <label htmlFor="processOwner" className="block text-sm font-medium text-secondary mb-2">
                    Process owner
                  </label>
                  <input
                    type="text"
                    id="processOwner"
                    name="processOwner"
                    value={formData.processOwner}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Enter process owner"
                  />
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
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-secondary text-primary py-2 px-4 rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Submitting...' : 'Submit Form'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Reset Form
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Control_form

// Form fields: 

// "Description of Control",	"Process",	"Sub-process",	"Risk Description / What Could Go Wrong (Misstatement, Misrepresentation, etc.)",	"Whether fraud risks exist",	"Control Objective",	Control to address 'What could go wrong'",	"Whether Management Review Control (MRC) or not",	"Gap Description & Resolution",	"Information Produced by the Entity (IPE) implemented in the operation of the Control - Source data/ Report logic/ Report parameters", 	"Relevant Data Elements of IPE",	"Type of Control  (Preventive, detective)",	"Nature of Control (Manual or Automated)",	"Type of Risk Mitigation method exercised (Insurance, hedging, sign offs, approvals)",	"Process owner",	"Reviewer/ Process Supervisor",	"Control frequency (Recurring, weekly, monthly)",	"Basis of sampling",	"Documents to be reviewed as a part of DMS audit",	"Type of risk associated with the process flow",	"Financial Reporting - Head in BS & PL",	"Checks performed",	"Effective or Not Effective",	"DONE",	"Findings"
