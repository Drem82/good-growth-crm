import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
  topic_areas: string | null
}

type AIResult = {
  action: 'search' | 'create_contact' | 'recommend_contacts'
  answer: string
  filters: {
    primary_category: string | null
    secondary_category: string | null
    lead_owner: string | null
    prospecting_client: boolean | null
    keyword: string | null
    topic_area: string | null
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
    notes: string | null
    topic_areas: string | null
  } | null
}

function textIncludes(value: string | null | undefined, keyword: string) {
  return (value || '').toLowerCase().includes(keyword)
}

function detectTopicArea(query: string): string | null {
  const q = query.toLowerCase()

  const topics = [
    'welfare',
    'housing',
    'growth',
    'economy',
    'devolution',
    'transport',
    'public services',
    'health',
    'education',
    'industrial strategy',
    'local growth',
    'planning',
    'labour market',
    'energy',
    'climate',
    'levelling up',
  ]

  for (const topic of topics) {
    if (q.includes(topic)) return topic
  }

  return null
}

function looksLikeRecommendation(query: string) {
  const q = query.toLowerCase()

  const patterns = [
    'who should',
    'recommend',
    'press release',
    'send to',
    'share with',
    'invite',
    'media list',
    'journalists',
    'briefing list',
    'who do we send',
    'who can i send',
  ]

  return patterns.some((pattern) => q.includes(pattern))
}

function looksLikeCreate(query: string) {
  const q = query.toLowerCase()
  return (
    q.startsWith('add ') ||
    q.startsWith('create ') ||
    q.startsWith('new contact') ||
    q.includes('add contact')
  )
}

function scoreContact(contact: Contact, topicArea: string | null, query: string) {
  let score = 0
  const q = query.toLowerCase()
  const t = (topicArea || '').toLowerCase()

  // Strong media/journalist signals
  if (textIncludes(contact.primary_category, 'media')) score += 8
  if ((contact.secondary_categories || []).some((c) => c.toLowerCase() === 'media')) score += 5
  if (textIncludes(contact.job_role, 'journalist')) score += 8
  if (textIncludes(contact.job_role, 'editor')) score += 6
  if (textIncludes(contact.job_role, 'correspondent')) score += 6
  if (textIncludes(contact.job_role, 'producer')) score += 4
  if (textIncludes(contact.job_role, 'columnist')) score += 5
  if (textIncludes(contact.sector, 'broadcast')) score += 4
  if (textIncludes(contact.sector, 'print')) score += 4
  if (textIncludes(contact.sector, 'journalist')) score += 5
  if (textIncludes(contact.sector, 'columnists')) score += 4
  if (textIncludes(contact.organisation, 'bbc')) score += 2
  if (textIncludes(contact.organisation, 'sky')) score += 2
  if (textIncludes(contact.organisation, 'guardian')) score += 2
  if (textIncludes(contact.organisation, 'times')) score += 2
  if (textIncludes(contact.organisation, 'ft')) score += 2
  if (textIncludes(contact.organisation, 'politico')) score += 2

  // Topic relevance
  if (t) {
    if (textIncludes(contact.topic_areas, t)) score += 12
    if (textIncludes(contact.notes, t)) score += 8
    if (textIncludes(contact.job_role, t)) score += 3
    if (textIncludes(contact.organisation, t)) score += 1
  }

  // Query relevance
  if (textIncludes(contact.notes, q)) score += 6
  if (textIncludes(contact.topic_areas, q)) score += 8
  if (textIncludes(contact.organisation, q)) score += 2
  if (textIncludes(contact.job_role, q)) score += 2

  return score
}

async function classifyWithAI(query: string): Promise<AIResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'developer',
        content:
          'You are a think tank CRM assistant. You either search contacts, prepare a contact preview to create, or recommend suitable contacts for outreach. Return only valid JSON matching the schema exactly.',
      },
      {
        role: 'user',
        content: `
Convert this CRM request into exactly one of:
1. "search"
2. "create_contact"
3. "recommend_contacts"

Allowed primary/secondary categories:
Events, Polling, Policy, Media, Political

Allowed lead owners:
Praful, Louisa, Jade, Kai, Ben, Dylan, Billie

Rules:
- If the user asks to add/create a contact, use "create_contact".
- If the user asks who should receive, who is relevant, who should be contacted, or asks for a recommended list, use "recommend_contacts".
- Otherwise use "search".
- If a field is not clearly requested, use null.
- "Louisa's contacts" means lead_owner = "Louisa".
- Put leftover free text into keyword.
- If there is a clear theme like welfare, housing, growth, economy, devolution, public services, transport etc, put that in topic_area.
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
              enum: ['search', 'create_contact', 'recommend_contacts'],
            },
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
                topic_area: { type: ['string', 'null'] },
              },
              required: [
                'primary_category',
                'secondary_category',
                'lead_owner',
                'prospecting_client',
                'keyword',
                'topic_area',
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
                notes: { type: ['string', 'null'] },
                topic_areas: { type: ['string', 'null'] },
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
                'notes',
                'topic_areas',
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
    throw new Error('No AI response content')
  }

  return JSON.parse(content) as AIResult
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json()

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    const topicArea = detectTopicArea(query)

    let parsed: AIResult

    // Fast path for think tank recommendation-style prompts
    if (looksLikeRecommendation(query)) {
      parsed = {
        action: 'recommend_contacts',
        answer: topicArea
          ? `Recommended media contacts relevant to ${topicArea}.`
          : 'Recommended media contacts for your outreach request.',
        filters: {
          primary_category: 'Media',
          secondary_category: null,
          lead_owner: null,
          prospecting_client: null,
          keyword: query,
          topic_area: topicArea,
        },
        contact: null,
      }
    } else if (looksLikeCreate(query)) {
      parsed = await classifyWithAI(query)
    } else {
      parsed = await classifyWithAI(query)
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
        'id, first_name, last_name, organisation, job_role, email, email_2, phone, sector, primary_category, secondary_categories, prospecting_client, lead_owner, notes, topic_areas'
      )
      .limit(300)

    if (parsed.filters.primary_category) {
      dbQuery = dbQuery.eq('primary_category', parsed.filters.primary_category)
    }

    if (parsed.filters.secondary_category) {
      dbQuery = dbQuery.contains('secondary_categories', [parsed.filters.secondary_category])
    }

    if (parsed.filters.lead_owner) {
      dbQuery = dbQuery.eq('lead_owner', parsed.filters.lead_owner)
    }

    if (parsed.filters.prospecting_client !== null) {
      dbQuery = dbQuery.eq('prospecting_client', parsed.filters.prospecting_client)
    }

    const { data, error } = await dbQuery

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    let results: Contact[] = data || []

    if (parsed.action === 'search') {
      if (parsed.filters.keyword) {
        const keyword = parsed.filters.keyword.toLowerCase()

        results = results.filter((contact) => {
          return (
            `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase().includes(keyword) ||
            textIncludes(contact.email, keyword) ||
            textIncludes(contact.email_2, keyword) ||
            textIncludes(contact.phone, keyword) ||
            textIncludes(contact.organisation, keyword) ||
            textIncludes(contact.job_role, keyword) ||
            textIncludes(contact.notes, keyword) ||
            textIncludes(contact.topic_areas, keyword) ||
            textIncludes(contact.sector, keyword)
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
    }

    if (parsed.action === 'recommend_contacts') {
      const recommended = results
        .map((contact) => ({
          ...contact,
          _score: scoreContact(contact, parsed.filters.topic_area, query),
        }))
        .filter((contact) => contact._score > 8)
        .sort((a, b) => b._score - a._score)
        .slice(0, 30)

      const finalAnswer =
        recommended.length > 0
          ? `Found ${recommended.length} recommended contacts for this outreach request.`
          : `I couldn't find strong matches yet. Add topic areas and richer notes to improve recommendations.`

      return Response.json({
        action: parsed.action,
        answer: finalAnswer,
        filters: parsed.filters,
        results: recommended,
        contact: null,
      })
    }

    return Response.json({
      action: parsed.action,
      answer: parsed.answer,
      filters: parsed.filters,
      results: [],
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