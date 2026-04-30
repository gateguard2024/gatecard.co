// ── Site / Property ───────────────────────────────────────────────────────────
export interface Site {
  id: string
  slug: string
  name: string
  address: string
  city: string
  state: string
  // EEN camera ID at main gate (for snapshot on visitor arrival)
  gate_camera_id: string | null
  // Brivo access point ID for the main gate
  brivo_access_point_id: string | null
  // Brivo account ID
  brivo_account_id: string | null
  // Leasing office phone number
  leasing_phone: string | null
  // Emergency contact
  emergency_phone: string | null
  active: boolean
}

// ── Resident ──────────────────────────────────────────────────────────────────
export interface Resident {
  id: string
  site_id: string
  unit_number: string
  first_name: string
  last_name: string
  display_name: string  // e.g. "Johnson, M." (last, first initial — privacy)
  // Phone is never returned to visitor-facing APIs — only used server-side
  active: boolean
}

// ── Access Event ──────────────────────────────────────────────────────────────
export type EntryType = 'directory' | 'packages' | 'leasing' | 'emergency'

export type EventOutcome =
  | 'initiated'      // call started
  | 'ringing'        // resident phone ringing
  | 'answered'       // resident answered
  | 'gate_opened'    // resident pressed 1
  | 'denied'         // resident pressed 2
  | 'no_answer'      // call timed out
  | 'failed'         // error
  | 'cancelled'      // visitor hung up

export interface AccessEvent {
  id: string
  site_id: string
  resident_id: string | null
  resident_unit: string | null
  entry_type: EntryType
  call_sid: string | null
  photo_url: string | null   // EEN snapshot URL
  outcome: EventOutcome
  visitor_label: string | null  // Optional: visitor name if entered
  created_at: string
  updated_at: string
}

// ── API Response shapes ───────────────────────────────────────────────────────
export interface ApiError {
  error: string
  code?: string
}

export interface CallInitiateResponse {
  callSid: string
  eventId: string
}

export interface CallStatusResponse {
  callSid: string
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer' | 'canceled'
  outcome: EventOutcome
  gateOpened: boolean
}
