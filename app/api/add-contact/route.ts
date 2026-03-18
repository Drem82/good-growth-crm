import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      first_name,
      last_name,
      email,
      phone,
      organisation,
      job_role,
      primary_category,
      secondary_categories,
      prospecting_client,
      lead_owner,
      secondary_contacts,
      other_contacts,
      notes,
    } = body

    const { error } = await supabase.from('contacts').insert([
      {
        first_name,
        last_name,
        email,
        phone,
        organisation,
        job_role,
        primary_category,
        secondary_categories,
        prospecting_client,
        lead_owner,
        secondary_contacts,
        other_contacts,
        notes,
      },
    ])

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}