import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Temporary debug route — DELETE AFTER FIXING
export async function GET() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Test the query directly
  const { data, error } = await supabase
    .from('sites')
    .select('id, slug, name, active')
    .limit(5)

  return NextResponse.json({
    env: {
      url_set:  !!url,
      url_prefix: url?.slice(0, 30) ?? 'MISSING',
      anon_set: !!anon,
      anon_prefix: anon?.slice(0, 20) ?? 'MISSING',
    },
    query: { data, error },
  })
}
