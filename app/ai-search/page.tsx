'use client'

import { useState } from 'react'

type Contact = {
  id?: string
  first_name: string | null
  last_name: string | null
  email: string | null
  email_2?: string | null
  phone: string | null
  organisation: string | null
  job_role: string | null
  primary_category: string | null
  secondary_categories: string[] | null
  prospecting_client: boolean | null
  lead_owner: string | null
  notes: string | null
  topic_areas?: string | null
  _score?: number
}

type AIResponse = {
  action?: 'search' | 'create_contact' | 'recommend_contacts'
  answer?: string
  results?: Contact[]
  contact?: Contact | null
  error?: string
}

export default function AISearchPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')
  const [results, setResults] = useState<Contact[]>([])
  const [contactPreview, setContactPreview] = useState<Contact | null>(null)
  const [actionType, setActionType] = useState<string>('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setAnswer('')
    setResults([])
    setContactPreview(null)
    setActionType('')

    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      const data: AIResponse = await res.json()

      if (!res.ok) {
        alert(data.error || 'AI search failed')
        return
      }

      setActionType(data.action || '')
      setAnswer(data.answer || '')
      setResults(data.results || [])
      setContactPreview(data.contact || null)
    } catch {
      alert('Could not run AI search')
    } finally {
      setLoading(false)
    }
  }

  async function confirmAddContact() {
    if (!contactPreview) return

    const confirmed = window.confirm('Add this contact?')
    if (!confirmed) return

    try {
      const res = await fetch('/api/add-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactPreview),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to add contact')
        return
      }

      alert('Contact added ✅')
      setContactPreview(null)
      setQuery('')
    } catch {
      alert('Error adding contact')
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '24px',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '10px', color: '#0b1f44' }}>
          AI Search
        </h1>
        <p style={{ color: '#475569', marginBottom: '24px' }}>
          Ask the CRM in plain English.
        </p>

        <form
          onSubmit={handleSearch}
          style={{
            background: 'white',
            border: '1px solid #dbe4f0',
            borderRadius: '18px',
            padding: '18px',
            marginBottom: '24px',
          }}
        >
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Example: Give me a list of journalists that we should share our welfare policy press release with"
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '14px',
              border: '1px solid #c9d7ea',
              borderRadius: '14px',
              resize: 'vertical',
              fontSize: '15px',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '14px',
              padding: '14px 18px',
              border: 'none',
              borderRadius: '14px',
              background: '#0b1f44',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {loading ? 'Searching...' : 'Ask the CRM'}
          </button>
        </form>

        {actionType && (
          <div
            style={{
              marginBottom: '16px',
              color: '#475569',
              fontSize: '14px',
              textTransform: 'capitalize',
            }}
          >
            Mode: {actionType.replace('_', ' ')}
          </div>
        )}

        {answer && (
          <div
            style={{
              background: 'white',
              border: '1px solid #dbe4f0',
              borderRadius: '18px',
              padding: '18px',
              marginBottom: '24px',
            }}
          >
            <h2 style={{ marginTop: 0, color: '#0b1f44' }}>Summary</h2>
            <p style={{ marginBottom: 0, color: '#334155', lineHeight: 1.6 }}>{answer}</p>
          </div>
        )}

        {contactPreview && (
          <div
            style={{
              background: 'white',
              border: '2px solid #2563eb',
              borderRadius: '18px',
              padding: '18px',
              marginBottom: '24px',
            }}
          >
            <h2 style={{ marginTop: 0, color: '#0b1f44' }}>Contact preview</h2>
            <p style={{ color: '#475569', marginTop: 0 }}>
              The AI thinks you want to create this contact.
            </p>

            <div style={{ display: 'grid', gap: '8px', color: '#334155' }}>
              <div>
                <strong>Name:</strong> {contactPreview.first_name || ''} {contactPreview.last_name || ''}
              </div>
              <div>
                <strong>Email:</strong> {contactPreview.email || 'None'}
              </div>
              <div>
                <strong>Phone:</strong> {contactPreview.phone || 'None'}
              </div>
              <div>
                <strong>Organisation:</strong> {contactPreview.organisation || 'None'}
              </div>
              <div>
                <strong>Job role:</strong> {contactPreview.job_role || 'None'}
              </div>
              <div>
                <strong>Primary category:</strong> {contactPreview.primary_category || 'None'}
              </div>
              <div>
                <strong>Secondary categories:</strong>{' '}
                {(contactPreview.secondary_categories || []).join(', ') || 'None'}
              </div>
              <div>
                <strong>Lead owner:</strong> {contactPreview.lead_owner || 'None'}
              </div>
              <div>
                <strong>Prospecting client:</strong>{' '}
                {contactPreview.prospecting_client ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>Topic areas:</strong> {contactPreview.topic_areas || 'None'}
              </div>
              <div>
                <strong>Notes:</strong> {contactPreview.notes || 'None'}
              </div>
            </div>

            <button
              onClick={confirmAddContact}
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                border: 'none',
                borderRadius: '12px',
                background: '#16a34a',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Confirm add contact
            </button>
          </div>
        )}

        {results.length > 0 && (
          <div
            style={{
              background: 'white',
              border: '1px solid #dbe4f0',
              borderRadius: '18px',
              padding: '18px',
            }}
          >
            <h2 style={{ marginTop: 0, color: '#0b1f44' }}>
              {actionType === 'recommend_contacts' ? 'Recommended contacts' : 'Results'}
            </h2>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '14px' }}>
              {results.map((contact) => (
                <li
                  key={contact.id}
                  style={{
                    border: '1px solid #dbe4f0',
                    borderRadius: '14px',
                    padding: '14px',
                  }}
                >
                  <strong>
                    {contact.first_name || ''} {contact.last_name || ''}
                  </strong>
                  <div>{contact.email || 'No email'}</div>
                  <div>{contact.organisation || 'No organisation'}</div>
                  <div>Job role: {contact.job_role || 'None'}</div>
                  <div>Primary: {contact.primary_category || 'None'}</div>
                  <div>
                    Secondary: {(contact.secondary_categories || []).join(', ') || 'None'}
                  </div>
                  <div>Lead owner: {contact.lead_owner || 'None'}</div>
                  <div>Prospecting client: {contact.prospecting_client ? 'Yes' : 'No'}</div>
                  <div>Topic areas: {contact.topic_areas || 'None'}</div>
                  {typeof contact._score === 'number' && (
                    <div>Relevance score: {contact._score}</div>
                  )}
                  <div style={{ marginTop: '8px', color: '#475569' }}>
                    Notes: {contact.notes || 'None'}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}