import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type AIResult = {
  action: 'search' | 'create_contact'
  answer: string
  filters: {
    primary_category: string | null
    secondary_category: string | null
    lead_owner: string | null
    prospecting_client: boolean | null
    keyword: string | null
  }
  contact: {
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    organisation: string | null
    job_role: string | null
    primary_category: string | null
    secondary_categories: string[]
    prospecting_client: boolean | null
    lead_owner: string | null
    secondary_contacts: string | null
    other_contacts: string | null
    notes: string | null
  } | null
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json()

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'developer',
          content:
            'You are a CRM assistant. You either search contacts or prepare a new contact to be added. Return only valid JSON matching the schema exactly.',
        },
        {
          role: 'user',
          content: `
Convert this CRM request into either:
1. a search request
2. a create_contact preview

Allowed primary/secondary categories:
Events, Polling, Policy, Media, Political

Allowed lead owners:
Praful, Louisa, Jade, Kai, Ben, Dylan, Billie

Rules:
- If the user is asking to add or create a contact, set action = "create_contact".
- If the user is asking to find, search, show, or look up contacts, set action = "search".
- If a field is not clearly requested, use null.
- "Louisa's contacts" means lead_owner = "Louisa".
- Put leftover free text into keyword.
- Be concise and helpful in the answer.
- For create_contact, fill contact with the best structured version of the user request.
- For search, set contact = null.
- RETURN ONLY JSON.

User request:
${query}
          `,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'crm_ai_action',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              action: {
                type: 'string',
                enum: ['search', 'create_contact'],
              },
              answer: {
                type: 'string',
              },
              filters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  primary_category: { type: ['string', 'null'] },
                  secondary_category: { type: ['string', 'null'] },
                  lead_owner: { type: ['string', 'null'] },
                  prospecting_client: { type: ['boolean', 'null'] },
                  keyword: { type: ['string', 'null'] },
                },
                required: [
                  'primary_category',
                  'secondary_category',
                  'lead_owner',
                  'prospecting_client',
                  'keyword',
                ],
              },
              contact: {
                type: ['object', 'null'],
                additionalProperties: false,
                properties: {
                  first_name: { type: ['string', 'null'] },
                  last_name: { type: ['string', 'null'] },
                  email: { type: ['string', 'null'] },
                  phone: { type: ['string', 'null'] },
                  organisation: { type: ['string', 'null'] },
                  job_role: { type: ['string', 'null'] },
                  primary_category: { type: ['string', 'null'] },
                  secondary_categories: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  prospecting_client: { type: ['boolean', 'null'] },
                  lead_owner: { type: ['string', 'null'] },
                  secondary_contacts: { type: ['string', 'null'] },
                  other_contacts: { type: ['string', 'null'] },
                  notes: { type: ['string', 'null'] },
                },
                required: [
                  'first_name',
                  'last_name',
                  'email',
                  'phone',
                  'organisation',
                  'job_role',
                  'primary_category',
                  'secondary_categories',
                  'prospecting_client',
                  'lead_owner',
                  'secondary_contacts',
                  'other_contacts',
                  'notes',
                ],
              },
            },
            required: ['action', 'answer', 'filters', 'contact'],
          },
        },
      },
    })

    const content = response.choices[0]?.message?.content

    if (!content) {
      return Response.json({ error: 'No AI response content' }, { status: 500 })
    }

    let parsed: AIResult

    try {
      parsed = JSON.parse(content)
    } catch {
      return Response.json(
        { error: 'AI returned invalid JSON', raw: content },
        { status: 500 }
      )
    }

    if (parsed.action === 'create_contact') {
      return Response.json({
        action: parsed.action,
        answer: parsed.answer,
        contact: parsed.contact,
        results: [],
      })
    }

    let dbQuery = supabase
      .from('contacts')
      .select(
        'id, first_name, last_name, email, phone, organisation, job_role, primary_category, secondary_categories, prospecting_client, lead_owner, secondary_contacts, other_contacts, notes'
      )
      .limit(50)

    if (parsed.filters.primary_category) {
      dbQuery = dbQuery.eq('primary_category', parsed.filters.primary_category)
    }

    if (parsed.filters.secondary_category) {
      dbQuery = dbQuery.contains('secondary_categories', [
        parsed.filters.secondary_category,
      ])
    }

    if (parsed.filters.lead_owner) {
      dbQuery = dbQuery.eq('lead_owner', parsed.filters.lead_owner)
    }

    if (parsed.filters.prospecting_client !== null) {
      dbQuery = dbQuery.eq(
        'prospecting_client',
        parsed.filters.prospecting_client
      )
    }

    const { data, error } = await dbQuery

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    let results = data || []

    if (parsed.filters.keyword) {
      const keyword = parsed.filters.keyword.toLowerCase()

      results = results.filter((contact) => {
        return (
          `${contact.first_name || ''} ${contact.last_name || ''}`
            .toLowerCase()
            .includes(keyword) ||
          (contact.email || '').toLowerCase().includes(keyword) ||
          (contact.phone || '').toLowerCase().includes(keyword) ||
          (contact.organisation || '').toLowerCase().includes(keyword) ||
          (contact.job_role || '').toLowerCase().includes(keyword) ||
          (contact.notes || '').toLowerCase().includes(keyword) ||
          (contact.other_contacts || '').toLowerCase().includes(keyword) ||
          (contact.secondary_contacts || '').toLowerCase().includes(keyword)
        )
      })
    }

    return Response.json({
      action: parsed.action,
      answer: parsed.answer,
      filters: parsed.filters,
      results,
      contact: null,
    })
  } catch (error) {
    console.error('SERVER ERROR:', error)

    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}