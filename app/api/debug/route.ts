import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Temporary debug route — DELETE AFTER FIXING
export async function GET() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Try sites table
  const sites = await supabase.from('sites').select('*').limit(3)

  // Try residents table
  const residents = await supabase.from('residents').select('*').limit(3)

  // Try properties table (in case portal uses different name)
  const properties = await supabase.from('properties').select('*').limit(3)

  return NextResponse.json({
    env: {
      url_set:     !!url,
      url_prefix:  url?.slice(0, 30) ?? 'MISSING',
      anon_set:    !!anon,
      anon_prefix: anon?.slice(0, 20) ?? 'MISSING',
    },
    sites:      { data: sites.data,      error: sites.error },
    residents:  { data: residents.data,  error: residents.error },
    properties: { data: properties.data, error: properties.error },
  })
}
