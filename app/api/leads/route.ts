import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/leads
// Body: { name, email, phone, property_name, units, city }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, phone, property_name, units, city } = body

    if (!name || !email || !property_name) {
      return NextResponse.json({ error: 'name, email and property_name are required' }, { status: 400 })
    }

    const db = supabaseAdmin()

    const { error } = await db.from('leads').insert({
      name,
      email,
      phone:         phone || null,
      property_name,
      units:         units ? parseInt(units) : null,
      city:          city || null,
      source:        'gatecard.co/get-started',
    })

    if (error) {
      console.error('[leads] insert error', error)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[leads] error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
