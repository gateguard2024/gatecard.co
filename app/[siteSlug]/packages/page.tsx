'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Package, Truck, ScanLine } from 'lucide-react'

const CARRIERS = [
  { id: 'amazon',  name: 'Amazon',  color: '#FF9900', icon: '📦' },
  { id: 'ups',     name: 'UPS',     color: '#FFB500', icon: '🟤' },
  { id: 'fedex',   name: 'FedEx',   color: '#FF6200', icon: '🟠' },
  { id: 'usps',    name: 'USPS',    color: '#004B87', icon: '🔵' },
  { id: 'dhl',     name: 'DHL',     color: '#FFCC00', icon: '🟡' },
  { id: 'other',   name: 'Other',   color: '#94A3B8', icon: '📫' },
]

export default function PackagesPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>
}) {
  const { siteSlug } = use(params)
  const router = useRouter()

  const handleCarrier = (carrierId: string) => {
    // Navigate to carrier-specific code entry
    // Sprint 2: wire to EEN snapshot + Brivo package room unlock
    router.push(`/${siteSlug}/packages/${carrierId}`)
  }

  return (
    <div className="gc-shell">

      <header
        className="flex items-center gap-3 px-4 pt-8 pb-5"
        style={{ borderBottom: '1px solid var(--color-gc-border)' }}
      >
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--color-gc-text-secondary)' }}
        >
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-gc-text)' }}>
            Package Room
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-gc-text-muted)' }}>
            Select your carrier to enter
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-5">

        {/* Instruction card */}
        <div
          className="gc-card flex items-start gap-3 p-4"
        >
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: 40, height: 40,
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.25)',
            }}
          >
            <Truck size={20} color="#10B981" />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-gc-text)' }}>
              Delivery drivers
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-gc-text-secondary)' }}>
              Select your carrier below. The system will capture your credentials and unlock the package room.
            </p>
          </div>
        </div>

        {/* Carrier grid */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--color-gc-text-muted)' }}
          >
            Select Carrier
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {CARRIERS.map((carrier) => (
              <button
                key={carrier.id}
                onClick={() => handleCarrier(carrier.id)}
                className="flex items-center gap-3 p-3.5 rounded-xl transition-colors text-left"
                style={{
                  background: 'var(--color-gc-surface)',
                  border: '1px solid var(--color-gc-border)',
                }}
              >
                <span className="text-xl">{carrier.icon}</span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--color-gc-text)' }}
                >
                  {carrier.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Scan code option */}
        <button
          className="gc-btn-primary mt-2"
          style={{ background: 'var(--color-gc-raised)', color: 'var(--color-gc-text-secondary)' }}
          onClick={() => router.push(`/${siteSlug}/packages/scan`)}
        >
          <ScanLine size={18} />
          Scan Package Barcode
        </button>

      </main>
    </div>
  )
}
