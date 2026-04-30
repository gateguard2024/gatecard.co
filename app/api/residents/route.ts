import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/residents?siteSlug=hendrix&q=john
// Returns resident list for the directory — phone is NEVER returned
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const siteSlug = searchParams.get('siteSlug')
  const q        = searchParams.get('q') ?? ''

  if (!siteSlug) {
    return NextResponse.json({ error: 'siteSlug required' }, { status: 400 })
  }

  // Resolve site
  const { data: site } = await supabase
    .from('sites')
    .select('id')
    .eq('slug', siteSlug)
    .single()

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  }

  let query = supabase
    .from('residents')
    .select('id, unit_number, first_name, last_name, display_name')
    .eq('site_id', site.id)
    .eq('active', true)
    .order('unit_number', { ascending: true })
    .limit(100)

  if (q.trim()) {
    // Search by last name or unit number
    query = query.or(
      `last_name.ilike.%${q}%,unit_number.ilike.%${q}%,first_name.ilike.%${q}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('[residents] query error', error)
    return NextResponse.json({ error: 'Failed to load directory' }, { status: 500 })
  }

  return NextResponse.json({ residents: data ?? [] })
}
