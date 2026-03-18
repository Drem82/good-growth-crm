'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'

type Contact = {
  id: string
  first_name: string | null
  last_name: string | null
  organisation: string | null
  job_role: string | null
  email: string | null
  email_2: string | null
  phone: string | null
  sector: string | null
  primary_category: string | null
  secondary_categories: string[] | null
  prospecting_client: boolean | null
  lead_owner: string | null
  notes: string | null
}

const CATEGORY_OPTIONS = ['Events', 'Polling', 'Policy', 'Media', 'Political']
const LEAD_OPTIONS = ['Praful', 'Louisa', 'Jade', 'Kai', 'Ben', 'Dylan', 'Billie']
const SECTOR_OPTIONS = [
  'Advisory Board',
  'Broadcast',
  'Columnists',
  'Corporate',
  'GGF',
  'House of Lords',
  'Journalist',
  'Labour Party',
  'Labour Stakeholders',
  'Media',
  'MP Staff',
  'Parliamentarians',
  'Parliamentary Staffer',
  'Print',
  'SpAds',
  'Think Tanks',
  'Third Sector',
]

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'profiles'>('table')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [jobRole, setJobRole] = useState('')
  const [email, setEmail] = useState('')
  const [email2, setEmail2] = useState('')
  const [phone, setPhone] = useState('')
  const [sector, setSector] = useState('')
  const [primaryCategory, setPrimaryCategory] = useState('')
  const [secondaryCategories, setSecondaryCategories] = useState<string[]>([])
  const [prospectingClient, setProspectingClient] = useState(false)
  const [leadOwner, setLeadOwner] = useState('')
  const [notes, setNotes] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPrimaryCategory, setSelectedPrimaryCategory] = useState('All')
  const [selectedSecondaryCategory, setSelectedSecondaryCategory] = useState('All')
  const [selectedLeadOwner, setSelectedLeadOwner] = useState('All')
  const [selectedSector, setSelectedSector] = useState('All')
  const [selectedProspectingClient, setSelectedProspectingClient] = useState('All')

  const [bulkLeadOwner, setBulkLeadOwner] = useState('')
  const [bulkSector, setBulkSector] = useState('')
  const [bulkProspectingClient, setBulkProspectingClient] = useState('')

  useEffect(() => {
    fetchContacts()
  }, [])

  async function fetchContacts() {
    const { data, error } = await supabase
      .from('contacts')
      .select(
        'id, first_name, last_name, organisation, job_role, email, email_2, phone, sector, primary_category, secondary_categories, prospecting_client, lead_owner, notes'
      )
      .order('last_name', { ascending: true })

    if (error) {
      console.error('FETCH ERROR:', error)
      alert(error.message)
      return
    }

    setContacts(data || [])
  }

  function resetForm() {
    setEditingId(null)
    setFirstName('')
    setLastName('')
    setOrganisation('')
    setJobRole('')
    setEmail('')
    setEmail2('')
    setPhone('')
    setSector('')
    setPrimaryCategory('')
    setSecondaryCategories([])
    setProspectingClient(false)
    setLeadOwner('')
    setNotes('')
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id)
    setFirstName(contact.first_name || '')
    setLastName(contact.last_name || '')
    setOrganisation(contact.organisation || '')
    setJobRole(contact.job_role || '')
    setEmail(contact.email || '')
    setEmail2(contact.email_2 || '')
    setPhone(contact.phone || '')
    setSector(contact.sector || '')
    setPrimaryCategory(contact.primary_category || '')
    setSecondaryCategories(contact.secondary_categories || [])
    setProspectingClient(Boolean(contact.prospecting_client))
    setLeadOwner(contact.lead_owner || '')
    setNotes(contact.notes || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handlePrimaryCategoryChange(value: string) {
    setPrimaryCategory(value)
    setSecondaryCategories((prev) => prev.filter((c) => c !== value))
  }

  function toggleSecondaryCategory(category: string) {
    if (category === primaryCategory) return

    setSecondaryCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: `${firstName} ${lastName}`.trim() || null,
      organisation: organisation || null,
      job_role: jobRole || null,
      email: email || null,
      email_2: email2 || null,
      phone: phone || null,
      sector: sector || null,
      primary_category: primaryCategory || null,
      secondary_categories: secondaryCategories,
      prospecting_client: prospectingClient,
      lead_owner: leadOwner || null,
      notes: notes || null,
    }

    if (editingId) {
      const { error } = await supabase
        .from('contacts')
        .update(payload)
        .eq('id', editingId)

      if (error) {
        alert(`Could not update contact: ${error.message}`)
        return
      }
    } else {
      const { error } = await supabase.from('contacts').insert([payload])

      if (error) {
        alert(`Could not save contact: ${error.message}`)
        return
      }
    }

    resetForm()
    fetchContacts()
  }

  async function deleteContact(id: string) {
    const confirmed = window.confirm('Delete this contact?')
    if (!confirmed) return

    const { error } = await supabase.from('contacts').delete().eq('id', id)

    if (error) {
      alert(`Could not delete contact: ${error.message}`)
      return
    }

    setSelectedIds((prev) => prev.filter((x) => x !== id))
    if (editingId === id) resetForm()
    fetchContacts()
  }

  function normalizeSecondaryCategories(value: unknown): string[] {
    if (!value) return []
    return String(value)
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

      const contactsToInsert = rows
        .map((row) => {
          const first_name = String(row['First Name'] || row['first_name'] || '').trim()
          const last_name = String(row['Last Name'] || row['last_name'] || '').trim()
          const organisation = String(row['Organisation'] || row['organisation'] || '').trim()
          const job_role = String(row['Role'] || row['Job Role'] || row['job_role'] || '').trim()
          const email = String(row['Email'] || row['email'] || '').trim()
          const email_2 = String(row['Email 2'] || row['email_2'] || '').trim()
          const phone = String(row['Phone'] || row['phone'] || '').trim()
          const sector = String(row['Sector'] || row['sector'] || '').trim()
          const primary_category = String(
            row['Primary Category'] || row['primary_category'] || ''
          ).trim()

          const secondary_categories = normalizeSecondaryCategories(
            row['Secondary Categories'] || row['secondary_categories'] || ''
          ).filter((c) => c !== primary_category)

          const prospectValue =
            row['Prospecting Client'] || row['prospecting_client'] || ''

          const prospecting_client =
            String(prospectValue).toLowerCase() === 'true' ||
            String(prospectValue).toLowerCase() === 'yes' ||
            String(prospectValue).toLowerCase() === 'y' ||
            String(prospectValue) === '1'

          const lead_owner = String(row['Lead'] || row['lead_owner'] || '').trim()
          const notes = String(row['Notes'] || row['notes'] || '').trim()

          return {
            first_name: first_name || null,
            last_name: last_name || null,
            full_name: `${first_name} ${last_name}`.trim() || null,
            organisation: organisation || null,
            job_role: job_role || null,
            email: email || null,
            email_2: email_2 || null,
            phone: phone || null,
            sector: sector || null,
            primary_category: primary_category || null,
            secondary_categories,
            prospecting_client,
            lead_owner: lead_owner || null,
            notes: notes || null,
          }
        })
        .filter((row) => row.first_name || row.last_name || row.email)

      if (contactsToInsert.length === 0) {
        alert('No usable rows found in that spreadsheet.')
        return
      }

      const { error } = await supabase.from('contacts').insert(contactsToInsert)

      if (error) {
        alert(`Could not upload spreadsheet: ${error.message}`)
        return
      }

      alert(`Uploaded ${contactsToInsert.length} contacts successfully.`)
      fetchContacts()
    } catch {
      alert('Could not read that Excel file.')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const filteredContacts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return contacts.filter((contact) => {
      const matchesSearch =
        q === '' ||
        `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase().includes(q) ||
        (contact.organisation || '').toLowerCase().includes(q) ||
        (contact.job_role || '').toLowerCase().includes(q) ||
        (contact.email || '').toLowerCase().includes(q) ||
        (contact.email_2 || '').toLowerCase().includes(q) ||
        (contact.phone || '').toLowerCase().includes(q) ||
        (contact.sector || '').toLowerCase().includes(q) ||
        (contact.notes || '').toLowerCase().includes(q)

      const matchesPrimary =
        selectedPrimaryCategory === 'All' ||
        contact.primary_category === selectedPrimaryCategory

      const matchesSecondary =
        selectedSecondaryCategory === 'All' ||
        (contact.secondary_categories || []).includes(selectedSecondaryCategory)

      const matchesLead =
        selectedLeadOwner === 'All' ||
        contact.lead_owner === selectedLeadOwner

      const matchesSector =
        selectedSector === 'All' ||
        contact.sector === selectedSector

      const matchesProspecting =
        selectedProspectingClient === 'All' ||
        (selectedProspectingClient === 'Yes' && contact.prospecting_client === true) ||
        (selectedProspectingClient === 'No' && !contact.prospecting_client)

      return (
        matchesSearch &&
        matchesPrimary &&
        matchesSecondary &&
        matchesLead &&
        matchesSector &&
        matchesProspecting
      )
    })
  }, [
    contacts,
    searchTerm,
    selectedPrimaryCategory,
    selectedSecondaryCategory,
    selectedLeadOwner,
    selectedSector,
    selectedProspectingClient,
  ])

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  function toggleSelectAllFiltered() {
    const filteredIds = filteredContacts.map((c) => c.id)
    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])))
    }
  }

  async function bulkUpdateLead() {
    if (!bulkLeadOwner) return alert('Choose a lead first.')
    if (selectedIds.length === 0) return

    const { error } = await supabase
      .from('contacts')
      .update({ lead_owner: bulkLeadOwner })
      .in('id', selectedIds)

    if (error) return alert(error.message)

    alert('Lead updated ✅')
    setSelectedIds([])
    setBulkLeadOwner('')
    fetchContacts()
  }

  async function bulkUpdateSector() {
    if (!bulkSector) return alert('Choose a sector first.')
    if (selectedIds.length === 0) return

    const { error } = await supabase
      .from('contacts')
      .update({ sector: bulkSector })
      .in('id', selectedIds)

    if (error) return alert(error.message)

    alert('Sector updated ✅')
    setSelectedIds([])
    setBulkSector('')
    fetchContacts()
  }

  async function bulkUpdateProspecting() {
    if (!bulkProspectingClient) return alert('Choose Yes or No first.')
    if (selectedIds.length === 0) return

    const value = bulkProspectingClient === 'Yes'

    const { error } = await supabase
      .from('contacts')
      .update({ prospecting_client: value })
      .in('id', selectedIds)

    if (error) return alert(error.message)

    alert('Prospecting status updated ✅')
    setSelectedIds([])
    setBulkProspectingClient('')
    fetchContacts()
  }

  async function bulkDelete() {
    if (selectedIds.length === 0) return

    const confirmed = window.confirm('Delete selected contacts?')
    if (!confirmed) return

    const { error } = await supabase.from('contacts').delete().in('id', selectedIds)

    if (error) return alert(error.message)

    alert('Deleted ✅')
    setSelectedIds([])
    fetchContacts()
  }

  function exportFilteredToExcel() {
    const rows = filteredContacts.map((contact) => ({
      'First Name': contact.first_name || '',
      'Last Name': contact.last_name || '',
      Organisation: contact.organisation || '',
      Role: contact.job_role || '',
      Email: contact.email || '',
      'Email 2': contact.email_2 || '',
      Phone: contact.phone || '',
      Sector: contact.sector || '',
      'Primary Category': contact.primary_category || '',
      'Secondary Categories': (contact.secondary_categories || []).join('; '),
      'Prospecting Client': contact.prospecting_client ? 'Yes' : 'No',
      Lead: contact.lead_owner || '',
      Notes: contact.notes || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts')
    XLSX.writeFile(workbook, 'filtered-contacts.xlsx')
  }

  const filteredIds = filteredContacts.map((c) => c.id)
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id))

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          background: '#0b1f44',
          color: 'white',
          padding: '40px 16px 56px',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-block',
              border: '1px solid rgba(255,255,255,0.28)',
              borderRadius: '999px',
              padding: '8px 14px',
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '20px',
            }}
          >
            Good Growth Foundation CRM
          </div>

          <h1
            style={{
              margin: 0,
              maxWidth: '860px',
              fontSize: 'clamp(30px, 5vw, 54px)',
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            Table-first CRM for media, policy, events, polling and political contacts.
          </h1>
        </div>
      </section>

      <section
        style={{
          maxWidth: '1280px',
          margin: '-30px auto 0',
          padding: '0 14px 32px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '24px',
          }}
        >
          <div style={cardStyle}>
            <h2 style={cardTitle}>{editingId ? 'Edit contact' : 'Add contact'}</h2>

            <form onSubmit={saveContact}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '14px',
                }}
              >
                <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Organisation" value={organisation} onChange={(e) => setOrganisation(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Role" value={jobRole} onChange={(e) => setJobRole(e.target.value)} style={inputStyle} />
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
                <input type="email" placeholder="Email 2" value={email2} onChange={(e) => setEmail2(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />

                <select value={sector} onChange={(e) => setSector(e.target.value)} style={inputStyle}>
                  <option value="">Select sector</option>
                  {SECTOR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <select value={primaryCategory} onChange={(e) => handlePrimaryCategoryChange(e.target.value)} style={inputStyle}>
                  <option value="">Select primary category</option>
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <select value={leadOwner} onChange={(e) => setLeadOwner(e.target.value)} style={inputStyle}>
                  <option value="">Select lead</option>
                  {LEAD_OPTIONS.map((lead) => (
                    <option key={lead} value={lead}>
                      {lead}
                    </option>
                  ))}
                </select>

                <label style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={prospectingClient}
                    onChange={(e) => setProspectingClient(e.target.checked)}
                  />
                  <span>Prospecting client</span>
                </label>
              </div>

              <div
                style={{
                  marginTop: '14px',
                  border: '1px solid #dbe4f0',
                  borderRadius: '18px',
                  padding: '16px',
                  background: '#f8fbff',
                }}
              >
                <p style={{ marginTop: 0, marginBottom: '12px', fontWeight: 600, color: '#0b1f44' }}>
                  Secondary categories
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {CATEGORY_OPTIONS.filter((category) => category !== primaryCategory).map((category) => {
                    const selected = secondaryCategories.includes(category)

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleSecondaryCategory(category)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '999px',
                          border: selected ? '1px solid #143b8f' : '1px solid #c9d7ea',
                          background: selected ? '#143b8f' : 'white',
                          color: selected ? 'white' : '#0b1f44',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      >
                        {category}
                      </button>
                    )
                  })}
                </div>
              </div>

              <textarea
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical', marginTop: '14px', width: '100%' }}
              />

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
                <button type="submit" style={primaryButtonStyle}>
                  {editingId ? 'Update contact' : 'Add contact'}
                </button>

                {editingId && (
                  <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <input
                type="text"
                placeholder="Search name, email, role, organisation, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={inputStyle}
              />

              <select value={selectedPrimaryCategory} onChange={(e) => setSelectedPrimaryCategory(e.target.value)} style={inputStyle}>
                <option value="All">All primary categories</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select value={selectedSecondaryCategory} onChange={(e) => setSelectedSecondaryCategory(e.target.value)} style={inputStyle}>
                <option value="All">All secondary categories</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select value={selectedLeadOwner} onChange={(e) => setSelectedLeadOwner(e.target.value)} style={inputStyle}>
                <option value="All">All leads</option>
                {LEAD_OPTIONS.map((lead) => (
                  <option key={lead} value={lead}>
                    {lead}
                  </option>
                ))}
              </select>

              <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)} style={inputStyle}>
                <option value="All">All sectors</option>
                {SECTOR_OPTIONS.map((sectorOption) => (
                  <option key={sectorOption} value={sectorOption}>
                    {sectorOption}
                  </option>
                ))}
              </select>

              <select value={selectedProspectingClient} onChange={(e) => setSelectedProspectingClient(e.target.value)} style={inputStyle}>
                <option value="All">All prospecting statuses</option>
                <option value="Yes">Prospecting client = Yes</option>
                <option value="No">Prospecting client = No</option>
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                marginBottom: '18px',
              }}
            >
              <h2 style={{ margin: 0, color: '#0b1f44' }}>Contacts</h2>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setViewMode('table')} style={viewMode === 'table' ? activeToggleStyle : toggleStyle}>
                  Table
                </button>
                <button type="button" onClick={() => setViewMode('profiles')} style={viewMode === 'profiles' ? activeToggleStyle : toggleStyle}>
                  Profiles
                </button>
                <button type="button" onClick={exportFilteredToExcel} style={secondaryButtonStyle}>
                  Export filtered Excel
                </button>
                <label style={secondaryButtonStyle}>
                  {isUploading ? 'Uploading...' : 'Upload Excel'}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelUpload}
                    style={{ display: 'none' }}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div
                style={{
                  background: '#0b1f44',
                  color: 'white',
                  padding: '14px',
                  borderRadius: '14px',
                  marginBottom: '14px',
                  display: 'grid',
                  gap: '10px',
                }}
              >
                <div>{selectedIds.length} selected</div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '10px',
                  }}
                >
                  <select value={bulkLeadOwner} onChange={(e) => setBulkLeadOwner(e.target.value)} style={bulkInputStyle}>
                    <option value="">Change lead...</option>
                    {LEAD_OPTIONS.map((lead) => (
                      <option key={lead} value={lead}>
                        {lead}
                      </option>
                    ))}
                  </select>

                  <button type="button" onClick={bulkUpdateLead} style={bulkButtonStyle}>
                    Apply lead
                  </button>

                  <select value={bulkSector} onChange={(e) => setBulkSector(e.target.value)} style={bulkInputStyle}>
                    <option value="">Change sector...</option>
                    {SECTOR_OPTIONS.map((sectorOption) => (
                      <option key={sectorOption} value={sectorOption}>
                        {sectorOption}
                      </option>
                    ))}
                  </select>

                  <button type="button" onClick={bulkUpdateSector} style={bulkButtonStyle}>
                    Apply sector
                  </button>

                  <select value={bulkProspectingClient} onChange={(e) => setBulkProspectingClient(e.target.value)} style={bulkInputStyle}>
                    <option value="">Prospecting...</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>

                  <button type="button" onClick={bulkUpdateProspecting} style={bulkButtonStyle}>
                    Apply prospecting
                  </button>

                  <button type="button" onClick={bulkDelete} style={bulkDeleteStyle}>
                    Delete selected
                  </button>
                </div>
              </div>
            )}

            {viewMode === 'table' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #dbe4f0', textAlign: 'left' }}>
                      <th style={thStyle}>
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                        />
                      </th>
                      <th style={thStyle}>First Name</th>
                      <th style={thStyle}>Last Name</th>
                      <th style={thStyle}>Organisation</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Email 2</th>
                      <th style={thStyle}>Phone</th>
                      <th style={thStyle}>Sector</th>
                      <th style={thStyle}>Primary</th>
                      <th style={thStyle}>Secondary</th>
                      <th style={thStyle}>Prospecting</th>
                      <th style={thStyle}>Lead</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((contact) => (
                      <tr key={contact.id} style={{ borderBottom: '1px solid #eef2f7', verticalAlign: 'top' }}>
                        <td style={tdStyle}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(contact.id)}
                            onChange={() => toggleSelect(contact.id)}
                          />
                        </td>
                        <td style={tdStyle}>{contact.first_name || ''}</td>
                        <td style={tdStyle}>{contact.last_name || ''}</td>
                        <td style={tdStyle}>{contact.organisation || ''}</td>
                        <td style={tdStyle}>{contact.job_role || ''}</td>
                        <td style={tdStyle}>{contact.email || ''}</td>
                        <td style={tdStyle}>{contact.email_2 || ''}</td>
                        <td style={tdStyle}>{contact.phone || ''}</td>
                        <td style={tdStyle}>{contact.sector || ''}</td>
                        <td style={tdStyle}>{contact.primary_category || ''}</td>
                        <td style={tdStyle}>{(contact.secondary_categories || []).join(', ')}</td>
                        <td style={tdStyle}>{contact.prospecting_client ? 'Yes' : 'No'}</td>
                        <td style={tdStyle}>{contact.lead_owner || ''}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => startEdit(contact)} style={miniButtonStyle}>
                              Edit
                            </button>
                            <button type="button" onClick={() => deleteContact(contact.id)} style={miniDeleteStyle}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredContacts.length === 0 && (
                  <div style={{ paddingTop: '12px', color: '#64748b' }}>No matching contacts.</div>
                )}
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '14px' }}>
                {filteredContacts.map((contact) => (
                  <li
                    key={contact.id}
                    style={{
                      border: '1px solid #dbe4f0',
                      borderRadius: '18px',
                      padding: '18px',
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <strong style={{ display: 'block', fontSize: '18px', color: '#0b1f44', marginBottom: '6px' }}>
                          {contact.first_name || ''} {contact.last_name || ''}
                        </strong>
                        <div>{contact.organisation || 'No organisation'}</div>
                        <div>{contact.job_role || 'No role'}</div>
                        <div>{contact.email || 'No email'}</div>
                        <div>{contact.email_2 || 'No second email'}</div>
                        <div>{contact.phone || 'No phone'}</div>
                        <div><strong>Sector:</strong> {contact.sector || 'None'}</div>
                        <div><strong>Primary:</strong> {contact.primary_category || 'None'}</div>
                        <div><strong>Secondary:</strong> {(contact.secondary_categories || []).join(', ') || 'None'}</div>
                        <div><strong>Prospecting:</strong> {contact.prospecting_client ? 'Yes' : 'No'}</div>
                        <div><strong>Lead:</strong> {contact.lead_owner || 'None'}</div>
                        <div><strong>Notes:</strong> {contact.notes || 'None'}</div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'start' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(contact.id)}
                          onChange={() => toggleSelect(contact.id)}
                        />
                        <button type="button" onClick={() => startEdit(contact)} style={miniButtonStyle}>
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteContact(contact.id)} style={miniDeleteStyle}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #dbe4f0',
  borderRadius: '24px',
  padding: '20px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
}

const cardTitle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: '18px',
  fontSize: '26px',
  color: '#0b1f44',
}

const inputStyle: React.CSSProperties = {
  padding: '13px 14px',
  border: '1px solid #c9d7ea',
  borderRadius: '14px',
  fontSize: '15px',
  outline: 'none',
  background: 'white',
  color: '#0f172a',
}

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '6px 2px',
  color: '#0f172a',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '14px 18px',
  border: 'none',
  borderRadius: '14px',
  background: '#0b1f44',
  color: 'white',
  cursor: 'pointer',
  fontSize: '15px',
  fontWeight: 600,
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '12px',
  border: '1px solid #c9d7ea',
  background: 'white',
  color: '#0b1f44',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '14px',
}

const toggleStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '12px',
  border: '1px solid #c9d7ea',
  background: 'white',
  color: '#0b1f44',
  cursor: 'pointer',
  fontWeight: 600,
}

const activeToggleStyle: React.CSSProperties = {
  ...toggleStyle,
  border: '1px solid #143b8f',
  background: '#143b8f',
  color: 'white',
}

const miniButtonStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid #c9d7ea',
  background: 'white',
  color: '#0b1f44',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '13px',
}

const miniDeleteStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid #fecaca',
  background: '#fff1f2',
  color: '#b91c1c',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '13px',
}

const bulkInputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: 'none',
  fontSize: '14px',
}

const bulkButtonStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: 'none',
  background: 'white',
  color: '#0b1f44',
  cursor: 'pointer',
  fontWeight: 600,
}

const bulkDeleteStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: 'none',
  background: '#dc2626',
  color: 'white',
  cursor: 'pointer',
  fontWeight: 600,
}

const thStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: '13px',
  color: '#475569',
  fontWeight: 700,
}

const tdStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: '14px',
}