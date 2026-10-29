import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded'
import { toast } from 'react-hot-toast'
import CompanyDetailsView from '../../components/company/CompanyDetailsView'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'
import { useOrganizationEmailWarning } from '../../hooks/useOrganizationEmailWarning'
import { getMobileValidationError, normalizeMobileDigits } from '../../utils/mobileValidation'

const defaultAdminForm = {
  email_id: '',
  mobile: '',
  emp_name: '',
}

function CompanyDetail() {
  const navigate = useNavigate()
  const { company_identifier } = useParams()

  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createAdminOpen, setCreateAdminOpen] = useState(false)
  const [createAdminSaving, setCreateAdminSaving] = useState(false)
  const [companyDeleteEnabled, setCompanyDeleteEnabled] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletePreview, setDeletePreview] = useState(null)
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false)
  const [deletingCompany, setDeletingCompany] = useState(false)
  const [adminForm, setAdminForm] = useState(defaultAdminForm)
  const [adminFormErrors, setAdminFormErrors] = useState({})
  const { getEmailWarning, getEmailWarningHelperTextSx } = useOrganizationEmailWarning()

  useSyncGlobalLoading(loading || createAdminSaving || deletingCompany)

  useEffect(() => {
    let cancelled = false
    const loadDeleteAvailability = async () => {
      try {
        const response = await fetch(apiUrl('/api/siteadmin/companies/delete-enabled'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()
        if (!cancelled && response.ok && data.success) {
          setCompanyDeleteEnabled(Boolean(data.enabled))
        }
      } catch (loadError) {
        console.error('Error checking company delete availability:', loadError)
      }
    }
    loadDeleteAvailability()
    return () => {
      cancelled = true
    }
  }, [])

  const loadCompany = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(apiUrl(`/api/siteadmin/companies/${company_identifier}`), {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch company data')
      }

      setCompany(data.data)
    } catch (fetchError) {
      console.error('Error loading company detail:', fetchError)
      setError(fetchError.message || 'Error fetching company data')
      setCompany(null)
    } finally {
      setLoading(false)
    }
  }, [company_identifier])

  useEffect(() => {
    loadCompany()
  }, [loadCompany])

  const handleOpenCreateAdmin = () => {
    setAdminForm(defaultAdminForm)
    setAdminFormErrors({})
    setCreateAdminOpen(true)
  }

  const deletePreviewRows = [
    ['Controls', deletePreview?.controls],
    ['Users', deletePreview?.users],
    ['Company admins', deletePreview?.company_admins],
    ['Coordinators', deletePreview?.coordinators],
    ['Approvers', deletePreview?.approvers],
    ['Process owners', deletePreview?.process_owners],
    ['Units', deletePreview?.units],
    ['Coordinator assignments', deletePreview?.coordinator_assignments],
    ['Approver assignments', deletePreview?.approver_assignments],
    ['Stored files', deletePreview?.files],
  ]

  const handleOpenDeleteDialog = async () => {
    setDeleteDialogOpen(true)
    setDeletePreview(null)
    setDeletePreviewLoading(true)
    try {
      const response = await fetch(
        apiUrl(`/api/siteadmin/companies/${encodeURIComponent(company_identifier)}/delete-preview`),
        { method: 'GET', credentials: 'include' }
      )
      const data = await response.json()
      if (!response.ok || !data.success) {
        toast.error(data.message || 'Failed to load delete details')
        setDeleteDialogOpen(false)
        return
      }
      setDeletePreview(data.data)
    } catch (previewError) {
      console.error('Error loading company delete preview:', previewError)
      toast.error('Failed to load delete details')
      setDeleteDialogOpen(false)
    } finally {
      setDeletePreviewLoading(false)
    }
  }

  const handleDeleteCompany = async () => {
    setDeletingCompany(true)
    try {
      const response = await fetch(apiUrl(`/api/siteadmin/companies/${encodeURIComponent(company_identifier)}`), {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        toast.error(data.message || 'Failed to delete company')
        setDeletingCompany(false)
        return
      }
      toast.success('Company deleted')
      navigate('/siteadmin/company-management')
    } catch (deleteError) {
      console.error('Error deleting company:', deleteError)
      toast.error('Failed to delete company')
      setDeletingCompany(false)
    }
  }

  const handleCloseCreateAdmin = () => {
    if (createAdminSaving) return
    setCreateAdminOpen(false)
    setAdminForm(defaultAdminForm)
    setAdminFormErrors({})
  }

  const handleAdminFormChange = (field, value) => {
    const nextValue = field === 'mobile' ? normalizeMobileDigits(value) : value
    setAdminForm((current) => ({ ...current, [field]: nextValue }))
    setAdminFormErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const validateAdminForm = () => {
    const nextErrors = {}
    const email = String(adminForm.email_id || '').trim()
    const mobile = normalizeMobileDigits(adminForm.mobile)

    if (!email) {
      nextErrors.email_id = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email_id = 'Invalid email format'
    }

    if (!mobile) {
      nextErrors.mobile = 'Mobile number is required'
    } else {
      const mobileError = getMobileValidationError(mobile)
      if (mobileError) {
        nextErrors.mobile = mobileError
      }
    }

    setAdminFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleCreateAdmin = async () => {
    if (!validateAdminForm()) return

    setCreateAdminSaving(true)
    try {
      const response = await fetch(apiUrl(`/api/siteadmin/companies/${encodeURIComponent(company_identifier)}/company-admins`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email_id: String(adminForm.email_id || '').trim(),
          mobile: normalizeMobileDigits(adminForm.mobile),
          emp_name: String(adminForm.emp_name || '').trim() || null,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create company admin')
      }

      toast.success('Company admin created successfully')
      setCreateAdminOpen(false)
      setAdminForm(defaultAdminForm)
      setAdminFormErrors({})
      await loadCompany()
    } catch (createError) {
      console.error('Create company admin error:', createError)
      toast.error(createError.message || 'Failed to create company admin')
    } finally {
      setCreateAdminSaving(false)
    }
  }

  const companyDetails = useMemo(() => {
    if (!company) return {}
    return {
      company_name: company.company_name,
      registered_email: company.registered_email,
      registered_address: company.registered_address,
      unique_identification_number: company.unique_identification_number,
      gst: company.gst,
      pan: company.pan,
      number_of_corporate_offices: company.number_of_corporate_offices,
      number_of_factory_units: company.number_of_factory_units,
    }
  }, [company])

  const units = useMemo(() => (
    Array.isArray(company?.company_units)
      ? company.company_units.map((unit) => ({
        unit_id: unit.unit_id,
        unit_name: unit.unit_name,
        unit_address: unit.unit_address,
      }))
      : []
  ), [company])

  return (
    <Box>
      <Box
        sx={{
          // px: { xs: 2.5, sm: 3 },
          mb: 2.5,
          pt: 2.5,
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Button
          onClick={() => navigate('/siteadmin/company-management')}
          startIcon={<ArrowBackIcon />}
          variant="text"
          sx={{
            alignSelf: { xs: 'stretch', sm: 'center' },
            justifyContent: 'flex-start',
            textTransform: 'none',
            fontWeight: 700,
            px: 2,
          }}
        >
          Back to Company Management
        </Button>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
        {companyDeleteEnabled ? (
          <Button
            onClick={handleOpenDeleteDialog}
            variant="outlined"
            color="error"
            disabled={loading || Boolean(error) || deletingCompany}
            sx={{
              alignSelf: { xs: 'stretch', sm: 'center' },
              textTransform: 'none',
              fontWeight: 700,
              px: 2.25,
            }}
          >
            Delete Company
          </Button>
        ) : null}
        <Button
          onClick={handleOpenCreateAdmin}
          startIcon={<PersonAddAlt1RoundedIcon />}
          variant="contained"
          color="secondary"
          disabled={loading || Boolean(error) || deletingCompany}
          sx={{
            alignSelf: { xs: 'stretch', sm: 'center' },
            textTransform: 'none',
            fontWeight: 700,
            px: 2.25,
          }}
        >
          Create Company Admin
        </Button>
        </Box>
      </Box>
      <CompanyDetailsView
        companyName={company?.company_name}
        companyIdentifier={company?.company_identifier || company_identifier}
        companyDetails={companyDetails}
        companyAdmins={Array.isArray(company?.company_admins) ? company.company_admins : []}
        units={units}
        linkedUnitIds={[]}
        showLinkedUnitLegend={false}
        loading={loading}
        error={error}
      />
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!deletingCompany) setDeleteDialogOpen(false)
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Delete company</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {`This permanently deletes ${company?.company_name || 'this company'} and the records below, including stored files, coordinator assignments, and approver assignments.`}
          </DialogContentText>
          {deletePreviewLoading ? (
            <DialogContentText>Loading counts...</DialogContentText>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 3, rowGap: 0.75 }}>
              {deletePreviewRows.map(([label, value]) => (
                <Box key={label} sx={{ display: 'contents' }}>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right' }}>{Number(value || 0)}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deletingCompany}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteCompany}
            color="error"
            variant="contained"
            disabled={deletingCompany || deletePreviewLoading || !deletePreview}
          >
            {deletingCompany ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={createAdminOpen}
        onClose={handleCloseCreateAdmin}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Create Company Admin
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'grid', gap: 2, pt: 2.5 }}>
          <TextField
            label="Email"
            value={adminForm.email_id}
            onChange={(event) => handleAdminFormChange('email_id', event.target.value)}
            error={Boolean(adminFormErrors.email_id)}
            helperText={adminFormErrors.email_id || getEmailWarning(adminForm.email_id) || ' '}
            FormHelperTextProps={{
              sx: adminFormErrors.email_id ? undefined : getEmailWarningHelperTextSx(adminForm.email_id),
            }}
            disabled={createAdminSaving}
            fullWidth
            required
          />
          <TextField
            label="Mobile Number"
            value={adminForm.mobile}
            onChange={(event) => handleAdminFormChange('mobile', event.target.value)}
            error={Boolean(adminFormErrors.mobile) || Boolean(adminForm.mobile && getMobileValidationError(adminForm.mobile))}
            helperText={
              adminFormErrors.mobile
              || (adminForm.mobile && getMobileValidationError(adminForm.mobile))
              || 'Enter a valid 10-digit mobile number.'
            }
            disabled={createAdminSaving}
            inputProps={{ inputMode: 'numeric', maxLength: 10 }}
            fullWidth
            required
          />
          <TextField
            label="Name"
            value={adminForm.emp_name}
            onChange={(event) => handleAdminFormChange('emp_name', event.target.value)}
            error={Boolean(adminFormErrors.emp_name)}
            helperText={adminFormErrors.emp_name || 'Optional'}
            disabled={createAdminSaving}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={handleCloseCreateAdmin} disabled={createAdminSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateAdmin}
            disabled={createAdminSaving}
            variant="contained"
            color="secondary"
          >
            {createAdminSaving ? 'Creating...' : 'Create Admin'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CompanyDetail
