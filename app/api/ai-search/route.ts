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
  answer: string
  filters: {
    primary_category: string | null
    secondary_category: string | null
    lead_owner: string | null
    prospecting_client: boolean | null
    keyword: string | null
  }
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
            'You convert CRM search requests into structured filters and return clean JSON.',
        },
        {
          role: 'user',
          content: `
Convert this CRM request into filters.

Allowed primary/secondary categories:
Events, Polling, Policy, Media, Political

Allowed lead owners:
Praful, Louisa, Jade, Kai, Ben, Dylan, Billie

Rules:
- If a field is not clearly requested, use null.
- "Louisa's contacts" means lead_owner = "Louisa".
- Put leftover free text into keyword.
- Be concise and helpful in the answer.
- If results exist, summarise them (e.g. "Found 8 media contacts led by Louisa").
- If no results, explain clearly and suggest what to try next.
- RETURN ONLY JSON.

User request:
${query}
          `,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'crm_search_filters',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              answer: { type: 'string' },
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
            },
            required: ['answer', 'filters'],
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
    } catch (err) {
      console.error('JSON PARSE ERROR:', content)
      return Response.json(
        { error: 'AI returned invalid JSON', raw: content },
        { status: 500 }
      )
    }

    // ------------------------
    // DATABASE QUERY
    // ------------------------

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

    // ------------------------
    // KEYWORD FILTER (LOCAL)
    // ------------------------

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

    // ------------------------
    // FINAL RESPONSE
    // ------------------------

    return Response.json({
      answer: parsed.answer,
      filters: parsed.filters,
      results,
    })
  } catch (error) {
    console.error('SERVER ERROR:', error)

    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}