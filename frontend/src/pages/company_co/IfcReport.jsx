import React from 'react'
import IfcReportPage from '../../components/reports/IfcReportPage'

function CompanyCoIfcReport() {
  return (
    <IfcReportPage
      endpoint="/api/company-co/ifc-report"
      title="IFC Report"
      subtitle="Scoped to your assigned units. Live aggregates refresh on each load."
      backPath="/company-co/racm-management"
    />
  )
}

export default CompanyCoIfcReport
