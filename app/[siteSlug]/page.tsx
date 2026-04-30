import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EntryHub from './EntryHub'

interface Props {
  params: Promise<{ siteSlug: string }>
}

export default async function SitePage({ params }: Props) {
  const { siteSlug } = await params

  const { data: site } = await supabase
    .from('sites')
    .select('id, slug, name, address, city, state, active')
    .eq('slug', siteSlug)
    .eq('active', true)
    .single()

  if (!site) notFound()

  return <EntryHub site={site} />
}

export async function generateMetadata({ params }: Props) {
  const { siteSlug } = await params
  return {
    title: `Visitor Access — GateCard`,
    description: `Visitor entry for ${siteSlug}`,
  }
}
