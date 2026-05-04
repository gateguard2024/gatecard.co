/**
 * POST /api/sites/setup
 *
 * Creates or updates a site row with full Brivo + UniFi configuration.
 * Used by the /setup-site admin page.
 *
 * Upserts on slug — safe to run multiple times.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      name,
      slug,
      address,
      city,
      state,
      leasing_phone,
      soc_phone,
      brivo_api_key,
      brivo_auth_basic,
      brivo_username,
      brivo_password,
      een_camera_id,
      unifi_controller_url,
      unifi_local_username,
      unifi_local_password,
      unifi_template_id,
    } = body

    if (!name || !slug || !address || !city || !state) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug, address, city, state' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()

    // Upsert on slug — create new or update existing
    const { data, error } = await db
      .from('sites')
      .upsert(
        {
          slug:                  slug.toLowerCase().trim(),
          name:                  name.trim(),
          address:               address.trim(),
          city:                  city.trim(),
          state:                 state.toUpperCase().trim(),
          leasing_phone:         leasing_phone?.trim() || null,
          soc_phone:             soc_phone?.trim() || null,
          brivo_api_key:         brivo_api_key?.trim() || null,
          brivo_auth_basic:      brivo_auth_basic?.trim() || null,
          brivo_username:        brivo_username?.trim() || null,
          brivo_password:        brivo_password?.trim() || null,
          een_camera_id:         een_camera_id?.trim() || null,
          unifi_controller_url:  unifi_controller_url?.trim() || null,
          unifi_local_username:  unifi_local_username?.trim() || null,
          unifi_local_password:  unifi_local_password?.trim() || null,
          unifi_template_id:     unifi_template_id?.trim() || null,
          active:                true,
        },
        { onConflict: 'slug' }
      )
      .select('id, slug, name')
      .single()

    if (error) {
      console.error('[setup-site] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, site: data })
  } catch (e) {
    console.error('[setup-site] Unexpected error:', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
