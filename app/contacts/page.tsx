'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'

type Contact = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  organisation: string | null
  categories: string[] | null
  lead_owner: string | null
  secondary_contacts: string | null
  other_contacts: string | null
  notes: string | null
}

const CATEGORY_OPTIONS = ['Events', 'Polling', 'Policy', 'Media', 'Political']
const LEAD_OPTIONS = ['Praful', 'Louisa', 'Jade', 'Kai', 'Ben', 'Dylan', 'Billie']

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [leadOwner, setLeadOwner] = useState('')
  const [secondaryContacts, setSecondaryContacts] = useState('')
  const [otherContacts, setOtherContacts] = useState('')
  const [notes, setNotes] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedLeadOwner, setSelectedLeadOwner] = useState('All')

  useEffect(() => {
    fetchContacts()
  }, [])

  async function fetchContacts() {
    const { data, error } = await supabase
      .from('contacts')
      .select(
        'id, first_name, last_name, email, phone, organisation, categories, lead_owner, secondary_contacts, other_contacts, notes'
      )
      .order('created_at', { ascending: false })

    if (error) {
      console.error('FETCH ERROR:', error)
      return
    }

    setContacts(data || [])
  }

  function resetForm() {
    setEditingId(null)
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setOrganisation('')
    setCategories([])
    setLeadOwner('')
    setSecondaryContacts('')
    setOtherContacts('')
    setNotes('')
  }

  function toggleCategory(category: string) {
    if (categories.includes(category)) {
      setCategories(categories.filter((c) => c !== category))
    } else {
      setCategories([...categories, category])
    }
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id)
    setFirstName(contact.first_name || '')
    setLastName(contact.last_name || '')
    setEmail(contact.email || '')
    setPhone(contact.phone || '')
    setOrganisation(contact.organisation || '')
    setCategories(contact.categories || [])
    setLeadOwner(contact.lead_owner || '')
    setSecondaryContacts(contact.secondary_contacts || '')
    setOtherContacts(contact.other_contacts || '')
    setNotes(contact.notes || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      organisation,
      full_name: `${firstName} ${lastName}`.trim(),
      categories,
      lead_owner: leadOwner || null,
      secondary_contacts: secondaryContacts,
      other_contacts: otherContacts,
      notes,
    }

    if (editingId) {
      const { error } = await supabase
        .from('contacts')
        .update(payload)
        .eq('id', editingId)

      if (error) {
        console.error('UPDATE ERROR:', error)
        alert(`Could not update contact: ${error.message}`)
        return
      }
    } else {
      const { error } = await supabase.from('contacts').insert([payload])

      if (error) {
        console.error('INSERT ERROR:', error)
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
      console.error('DELETE ERROR:', error)
      alert(`Could not delete contact: ${error.message}`)
      return
    }

    if (editingId === id) resetForm()
    fetchContacts()
  }

  function normalizeCategories(value: unknown): string[] {
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
          const firstNameValue = row['First Name'] || row['first_name'] || row['FirstName'] || ''
          const lastNameValue = row['Last Name'] || row['last_name'] || row['LastName'] || ''
          const emailValue = row['Email'] || row['email'] || ''
          const phoneValue = row['Phone'] || row['phone'] || row['Phone Number'] || ''
          const organisationValue =
            row['Organisation'] || row['organization'] || row['organisation'] || row['Organization'] || ''
          const categoriesValue =
            row['Categories'] || row['categories'] || row['Category'] || row['category'] || ''
          const leadOwnerValue =
            row['Lead Owner'] || row['lead_owner'] || row['Lead'] || row['lead'] || ''
          const secondaryContactsValue =
            row['Secondary Contacts'] || row['secondary_contacts'] || ''
          const otherContactsValue =
            row['Other Contacts'] || row['other_contacts'] || row['Other contacts'] || ''
          const notesValue = row['Notes'] || row['notes'] || row['Updates'] || row['updates'] || ''

          const first_name = String(firstNameValue).trim()
          const last_name = String(lastNameValue).trim()
          const email = String(emailValue).trim()
          const phone = String(phoneValue).trim()
          const organisation = String(organisationValue).trim()
          const categories = normalizeCategories(categoriesValue)
          const lead_owner = String(leadOwnerValue).trim()
          const secondary_contacts = String(secondaryContactsValue).trim()
          const other_contacts = String(otherContactsValue).trim()
          const notes = String(notesValue).trim()

          return {
            first_name,
            last_name,
            full_name: `${first_name} ${last_name}`.trim(),
            email,
            phone,
            organisation,
            categories,
            lead_owner,
            secondary_contacts,
            other_contacts,
            notes,
          }
        })
        .filter((row) => row.first_name || row.last_name || row.email)

      if (contactsToInsert.length === 0) {
        alert('No usable rows found in that spreadsheet.')
        return
      }

      const { error } = await supabase.from('contacts').insert(contactsToInsert)

      if (error) {
        console.error('UPLOAD ERROR:', error)
        alert(`Could not upload spreadsheet: ${error.message}`)
        return
      }

      alert(`Uploaded ${contactsToInsert.length} contacts successfully.`)
      fetchContacts()
    } catch (error) {
      console.error('FILE READ ERROR:', error)
      alert('Could not read that Excel file.')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  function exportFilteredToExcel() {
    const rows = filteredContacts.map((contact) => ({
      FirstName: contact.first_name || '',
      LastName: contact.last_name || '',
      Email: contact.email || '',
      Phone: contact.phone || '',
      Organisation: contact.organisation || '',
      Categories: (contact.categories || []).join('; '),
      LeadOwner: contact.lead_owner || '',
      SecondaryContacts: contact.secondary_contacts || '',
      OtherContacts: contact.other_contacts || '',
      Notes: contact.notes || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts')
    XLSX.writeFile(workbook, 'filtered-contacts.xlsx')
  }

  const filteredContacts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return contacts.filter((contact) => {
      const matchesSearch =
        q === '' ||
        `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase().includes(q) ||
        (contact.email || '').toLowerCase().includes(q) ||
        (contact.phone || '').toLowerCase().includes(q) ||
        (contact.organisation || '').toLowerCase().includes(q) ||
        (contact.notes || '').toLowerCase().includes(q) ||
        (contact.lead_owner || '').toLowerCase().includes(q) ||
        (contact.secondary_contacts || '').toLowerCase().includes(q)

      const matchesCategory =
        selectedCategory === 'All' ||
        (contact.categories || []).includes(selectedCategory)

      const matchesLeadOwner =
        selectedLeadOwner === 'All' ||
        contact.lead_owner === selectedLeadOwner

      return matchesSearch && matchesCategory && matchesLeadOwner
    })
  }, [contacts, searchTerm, selectedCategory, selectedLeadOwner])

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f5f7fb 0%, #ffffff 34%, #ffffff 100%)',
        color: '#0f172a',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#0b1f44',
          color: 'white',
          padding: '56px 24px 72px',
        }}
      >
        <div style={{ position: 'relative', maxWidth: '1100px', margin: '0 auto' }}>
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
              maxWidth: '760px',
              fontSize: 'clamp(34px, 5vw, 58px)',
              lineHeight: 1.04,
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            Contacts for events, polling, policy, media and political work.
          </h1>

          <p
            style={{
              marginTop: '18px',
              maxWidth: '700px',
              color: 'rgba(255,255,255,0.86)',
              fontSize: '18px',
              lineHeight: 1.6,
            }}
          >
            Search, filter, edit, delete, upload, and export the exact contact list you need.
          </p>
        </div>
      </section>

      <section
        style={{
          maxWidth: '1100px',
          margin: '-34px auto 0',
          padding: '0 24px 48px',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.05fr 0.95fr',
            gap: '24px',
            alignItems: 'start',
          }}
        >
          <div
            style={{
              background: 'white',
              border: '1px solid #dbe4f0',
              borderRadius: '24px',
              padding: '28px',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '18px', fontSize: '26px', color: '#0b1f44' }}>
              {editingId ? 'Edit contact' : 'Add contact'}
            </h2>

            <form onSubmit={saveContact}>
              <div style={{ display: 'grid', gap: '14px' }}>
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Organisation"
                  value={organisation}
                  onChange={(e) => setOrganisation(e.target.value)}
                  style={inputStyle}
                />

                <div
                  style={{
                    border: '1px solid #dbe4f0',
                    borderRadius: '18px',
                    padding: '16px',
                    background: '#f8fbff',
                  }}
                >
                  <p style={{ marginTop: 0, marginBottom: '12px', fontWeight: 600, color: '#0b1f44' }}>
                    Categories
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {CATEGORY_OPTIONS.map((cat) => {
                      const selected = categories.includes(cat)
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '999px',
                            border: selected ? '1px solid #143b8f' : '1px solid #c9d7ea',
                            background: selected ? '#143b8f' : 'white',
                            color: selected ? 'white' : '#0b1f44',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                        >
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <select
                  value={leadOwner}
                  onChange={(e) => setLeadOwner(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select lead owner</option>
                  {LEAD_OPTIONS.map((lead) => (
                    <option key={lead} value={lead}>
                      {lead}
                    </option>
                  ))}
                </select>

                <textarea
                  placeholder="Secondary contacts"
                  value={secondaryContacts}
                  onChange={(e) => setSecondaryContacts(e.target.value)}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />

                <textarea
                  placeholder="Other related contacts"
                  value={otherContacts}
                  onChange={(e) => setOtherContacts(e.target.value)}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />

                <textarea
                  placeholder="Notes / updates"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
                />

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button type="submit" style={primaryButtonStyle}>
                    {editingId ? 'Update contact' : 'Add contact'}
                  </button>

                  {editingId && (
                    <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div
            style={{
              background: 'white',
              border: '1px solid #dbe4f0',
              borderRadius: '24px',
              padding: '28px',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
            }}
          >
            <p
              style={{
                marginTop: 0,
                marginBottom: '8px',
                fontSize: '12px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#2563eb',
                fontWeight: 700,
              }}
            >
              Find contacts
            </p>

            <input
              type="text"
              placeholder="Search name, email, phone, organisation, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, marginBottom: '14px', width: '100%' }}
            />

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ ...inputStyle, width: '100%', marginBottom: '14px' }}
            >
              <option value="All">All categories</option>
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={selectedLeadOwner}
              onChange={(e) => setSelectedLeadOwner(e.target.value)}
              style={{ ...inputStyle, width: '100%', marginBottom: '16px' }}
            >
              <option value="All">All lead owners</option>
              {LEAD_OPTIONS.map((lead) => (
                <option key={lead} value={lead}>
                  {lead}
                </option>
              ))}
            </select>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '14px',
                marginBottom: '18px',
              }}
            >
              <MetricCard label="Total contacts" value={String(contacts.length)} />
              <MetricCard label="Filtered results" value={String(filteredContacts.length)} />
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <button type="button" onClick={exportFilteredToExcel} style={primaryButtonStyle}>
                Export filtered Excel
              </button>

              <label
                style={{
                  ...secondaryButtonStyle,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
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
        </div>

        <div
          style={{
            marginTop: '26px',
            background: 'white',
            border: '1px solid #dbe4f0',
            borderRadius: '24px',
            padding: '28px',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
          }}
        >
          <h2 style={{ margin: '0 0 18px', fontSize: '28px', color: '#0b1f44' }}>
            Contact list
          </h2>

          {filteredContacts.length === 0 ? (
            <div
              style={{
                borderRadius: '18px',
                padding: '22px',
                background: '#f8fbff',
                color: '#475569',
              }}
            >
              No matching contacts.
            </div>
          ) : (
            <ul style={{ display: 'grid', gap: '14px', padding: 0, listStyle: 'none', margin: 0 }}>
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
                  <strong style={{ display: 'block', fontSize: '18px', color: '#0b1f44', marginBottom: '6px' }}>
                    {contact.first_name || ''} {contact.last_name || ''}
                  </strong>
                  <div style={{ color: '#475569' }}>{contact.email || 'No email'}</div>
                  <div style={{ color: '#475569' }}>{contact.phone || 'No phone'}</div>
                  <div style={{ color: '#475569' }}>{contact.organisation || 'No organisation'}</div>
                  <div style={{ color: '#475569', marginBottom: '8px' }}>
                    <strong>Lead owner:</strong> {contact.lead_owner || 'None'}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {(contact.categories || []).map((category) => (
                      <span
                        key={category}
                        style={{
                          fontSize: '12px',
                          padding: '7px 10px',
                          borderRadius: '999px',
                          background: '#eaf1ff',
                          color: '#143b8f',
                          border: '1px solid #c9d7ea',
                          fontWeight: 600,
                        }}
                      >
                        {category}
                      </span>
                    ))}
                  </div>

                  {contact.secondary_contacts && (
                    <div style={{ marginBottom: '8px', color: '#334155' }}>
                      <strong>Secondary contacts:</strong> {contact.secondary_contacts}
                    </div>
                  )}

                  {contact.other_contacts && (
                    <div style={{ marginBottom: '8px', color: '#334155' }}>
                      <strong>Other contacts:</strong> {contact.other_contacts}
                    </div>
                  )}

                  {contact.notes && (
                    <div style={{ marginBottom: '12px', color: '#334155' }}>
                      <strong>Notes:</strong> {contact.notes}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => startEdit(contact)} style={secondaryButtonStyle}>
                      Edit
                    </button>

                    <button type="button" onClick={() => deleteContact(contact.id)} style={dangerButtonStyle}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid #dbe4f0',
        borderRadius: '18px',
        padding: '16px',
        background: '#f8fbff',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#64748b',
          marginBottom: '6px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#0b1f44',
          letterSpacing: '-0.03em',
        }}
      >
        {value}
      </div>
    </div>
  )
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
}

const dangerButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '12px',
  border: '1px solid #fecaca',
  background: '#fff1f2',
  color: '#b91c1c',
  cursor: 'pointer',
  fontWeight: 600,
}