import React from 'react'
import IfcReportPage from '../../components/reports/IfcReportPage'

function CompanyAdminIfcReport() {
  return (
    <IfcReportPage
      endpoint="/api/company-admin/ifc-report"
      title="IFC Report"
      subtitle="Company-wide across all units. Live aggregates refresh on each load."
      backPath="/company_admin/racms"
    />
  )
}

export default CompanyAdminIfcReport
