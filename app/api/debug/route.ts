import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Temporary debug route — DELETE AFTER FIXING
export async function GET() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Raw fetch to PostgREST to bypass the client
  const rawUrl = `${url}/rest/v1/sites?select=id,slug&limit=3`
  const rawRes = await fetch(rawUrl, {
    headers: {
      'apikey': anon ?? '',
      'Authorization': `Bearer ${anon}`,
    },
  })
  const rawBody = await rawRes.text()

  return NextResponse.json({
    env: {
      full_url:    url,
      anon_prefix: anon?.slice(0, 20) ?? 'MISSING',
    },
    raw: {
      status:  rawRes.status,
      url:     rawUrl,
      body:    rawBody,
    },
  })
}
