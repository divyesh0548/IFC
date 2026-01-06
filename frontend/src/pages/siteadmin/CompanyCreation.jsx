import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Siteadmin_navbar'
import { useSiteadminLogout } from '../../hooks/useSiteadminLogout'

function CompanyCreation() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    company_name: '',
    registered_email: '',
    registered_address: '',
    unique_identification_number: '',
    pan: '',
    gst: '',
    number_of_corporate_offices: '',
    number_of_factory_units: '',
    company_coordinator_email: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // GST Validation function
  const validateGST = (gst) => {
    if (!gst) return true // Allow empty for now
    
    // Check length
    if (gst.length !== 15) {
      return false
    }

    // Position 1-2: numeric
    if (!/^\d{2}/.test(gst)) {
      return false
    }

    // Position 3-13: alphanumeric (11 characters)
    if (!/^\d{2}[A-Z0-9]{11}/.test(gst)) {
      return false
    }

    // Position 14: "Z"
    if (gst[13] !== 'Z' && gst[13] !== 'z') {
      return false
    }

    // Position 15: digit
    if (!/^\d$/.test(gst[14])) {
      return false
    }

    // Full format validation
    if (!/^\d{2}[A-Z0-9]{11}[Zz]\d$/.test(gst)) {
      return false
    }

    return true
  }

  // Auto-fill PAN from GST
  const handleGSTChange = (e) => {
    const gstValue = e.target.value.toUpperCase()
    setFormData(prev => {
      const newData = { ...prev, gst: gstValue }
      
      // Auto-fill PAN from GST (positions 3-12 of GST = PAN)
      if (gstValue.length >= 12 && validateGST(gstValue)) {
        newData.pan = gstValue.substring(2, 12)
      } else if (gstValue.length < 12) {
        newData.pan = ''
      }
      
      return newData
    })

    // Validate GST
    if (gstValue && !validateGST(gstValue)) {
      setErrors(prev => ({
        ...prev,
        gst: 'Invalid GST number. Format: 2 digits + 11 alphanumeric + Z + 1 digit (15 characters total)'
      }))
    } else {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.gst
        return newErrors
      })
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required'
    }

    if (!formData.registered_email.trim()) {
      newErrors.registered_email = 'Registered email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.registered_email)) {
      newErrors.registered_email = 'Invalid email format'
    }

    if (!formData.registered_address.trim()) {
      newErrors.registered_address = 'Registered address is required'
    }

    if (!formData.unique_identification_number.trim()) {
      newErrors.unique_identification_number = 'Unique Identification Number is required'
    } else if (!/^\d+$/.test(formData.unique_identification_number)) {
      newErrors.unique_identification_number = 'Must be a number'
    }

    if (!formData.gst.trim()) {
      newErrors.gst = 'GST number is required'
    } else if (!validateGST(formData.gst)) {
      newErrors.gst = 'Invalid GST number. Format: 2 digits + 11 alphanumeric + Z + 1 digit (15 characters total)'
    }

    if (!formData.number_of_corporate_offices.trim()) {
      newErrors.number_of_corporate_offices = 'Number of Corporate Offices is required'
    } else if (!/^\d+$/.test(formData.number_of_corporate_offices) || parseInt(formData.number_of_corporate_offices) < 0) {
      newErrors.number_of_corporate_offices = 'Must be a positive number'
    }

    if (!formData.number_of_factory_units.trim()) {
      newErrors.number_of_factory_units = 'Number of Factory Unit/Warehouse/Other Facilities is required'
    } else if (!/^\d+$/.test(formData.number_of_factory_units) || parseInt(formData.number_of_factory_units) < 0) {
      newErrors.number_of_factory_units = 'Must be a positive number'
    }

    // Validate company coordinator email if provided
    if (formData.company_coordinator_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.company_coordinator_email)) {
      newErrors.company_coordinator_email = 'Invalid email format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch('http://localhost:3000/api/companies/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          company_name: formData.company_name,
          registered_email: formData.registered_email,
          registered_address: formData.registered_address,
          unique_identification_number: formData.unique_identification_number,
          gst: formData.gst,
          pan: formData.pan,
          number_of_corporate_offices: formData.number_of_corporate_offices,
          number_of_factory_units: formData.number_of_factory_units,
          company_coordinator_email: formData.company_coordinator_email || null
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        alert(`Company created successfully! Company Identifier: ${data.company.company_identifier}`)
        navigate('/siteadmin/dashboard')
      } else {
        setError(data.message || 'Failed to create company')
      }
    } catch (err) {
      console.error('Company creation error:', err)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = useSiteadminLogout()

  return (
    <div className="min-h-screen bg-primary hide-scrollbar overflow-y-auto overflow-x-hidden">
      <Navbar onLogout={handleLogout} header="Site Admin" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-secondary mb-8 text-center">
            Create Company
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Name */}
            <div>
              <label htmlFor="company_name" className="block text-sm font-medium text-secondary mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="company_name"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                required
                disabled={loading}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  errors.company_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter company name"
              />
              {errors.company_name && (
                <p className="mt-1 text-sm text-red-600">{errors.company_name}</p>
              )}
            </div>

            {/* Registered Email */}
            <div>
              <label htmlFor="registered_email" className="block text-sm font-medium text-secondary mb-2">
                Registered Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="registered_email"
                name="registered_email"
                value={formData.registered_email}
                onChange={handleChange}
                required
                disabled={loading}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  errors.registered_email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter registered email"
              />
              {errors.registered_email && (
                <p className="mt-1 text-sm text-red-600">{errors.registered_email}</p>
              )}
            </div>

            {/* Registered Address */}
            <div>
              <label htmlFor="registered_address" className="block text-sm font-medium text-secondary mb-2">
                Registered Address <span className="text-red-500">*</span>
              </label>
              <textarea
                id="registered_address"
                name="registered_address"
                value={formData.registered_address}
                onChange={handleChange}
                required
                disabled={loading}
                rows={3}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  errors.registered_address ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter registered address"
              />
              {errors.registered_address && (
                <p className="mt-1 text-sm text-red-600">{errors.registered_address}</p>
              )}
            </div>

            {/* Unique Identification Number */}
            <div>
              <label htmlFor="unique_identification_number" className="block text-sm font-medium text-secondary mb-2">
                Unique Identification Number <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="unique_identification_number"
                name="unique_identification_number"
                value={formData.unique_identification_number}
                onChange={handleChange}
                required
                disabled={loading}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  errors.unique_identification_number ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter unique identification number"
              />
              {errors.unique_identification_number && (
                <p className="mt-1 text-sm text-red-600">{errors.unique_identification_number}</p>
              )}
            </div>

            {/* GST */}
            <div>
              <label htmlFor="gst" className="block text-sm font-medium text-secondary mb-2">
                GST <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="gst"
                name="gst"
                value={formData.gst}
                onChange={handleGSTChange}
                required
                disabled={loading}
                maxLength={15}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed uppercase ${
                  errors.gst ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter GST number (15 characters)"
              />
              {errors.gst && (
                <p className="mt-1 text-sm text-red-600">{errors.gst}</p>
              )}
              {formData.gst && formData.gst.length === 15 && !errors.gst && (
                <p className="mt-1 text-sm text-green-600">Valid GST format</p>
              )}
            </div>

            {/* PAN (Auto-filled from GST) */}
            <div>
              <label htmlFor="pan" className="block text-sm font-medium text-secondary mb-2">
                PAN (Auto-filled from GST)
              </label>
              <input
                type="text"
                id="pan"
                name="pan"
                value={formData.pan}
                onChange={handleChange}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed uppercase"
                placeholder="Auto-filled from GST"
              />
            </div>

            {/* Number of Corporate Offices */}
            <div>
              <label htmlFor="number_of_corporate_offices" className="block text-sm font-medium text-secondary mb-2">
                Number of Corporate Offices <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="number_of_corporate_offices"
                name="number_of_corporate_offices"
                value={formData.number_of_corporate_offices}
                onChange={handleChange}
                required
                disabled={loading}
                min="0"
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  errors.number_of_corporate_offices ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter number of corporate offices"
              />
              {errors.number_of_corporate_offices && (
                <p className="mt-1 text-sm text-red-600">{errors.number_of_corporate_offices}</p>
              )}
            </div>

            {/* Number of Factory Unit/Warehouse/Other Facilities */}
            <div>
              <label htmlFor="number_of_factory_units" className="block text-sm font-medium text-secondary mb-2">
                Number of Factory Unit/Warehouse/Other Facilities <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="number_of_factory_units"
                name="number_of_factory_units"
                value={formData.number_of_factory_units}
                onChange={handleChange}
                required
                disabled={loading}
                min="0"
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  errors.number_of_factory_units ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter number of factory units/warehouse/other facilities"
              />
              {errors.number_of_factory_units && (
                <p className="mt-1 text-sm text-red-600">{errors.number_of_factory_units}</p>
              )}
            </div>

            {/* Company Coordinator Email */}
            <div>
              <label htmlFor="company_coordinator_email" className="block text-sm font-medium text-secondary mb-2">
                Company Coordinator Email
              </label>
              <input
                type="email"
                id="company_coordinator_email"
                name="company_coordinator_email"
                value={formData.company_coordinator_email}
                onChange={handleChange}
                disabled={loading}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  errors.company_coordinator_email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter company coordinator email (optional)"
              />
              {errors.company_coordinator_email && (
                <p className="mt-1 text-sm text-red-600">{errors.company_coordinator_email}</p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/siteadmin/dashboard')}
                disabled={loading}
                className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-md font-semibold hover:bg-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 cursor-pointer disabled:bg-gray-200 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-secondary text-primary py-3 rounded-md font-semibold hover:bg-hover transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Company'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CompanyCreation

