'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { getNewPageSeoTitle } from '@/lib/platform-routing'

const MAIN_TAG_SLUG = 'new' as const

export const metadata: Metadata = {
  title: getNewPageSeoTitle(),
}

export default async function NewPage(props: PageProps<'/[locale]/new'>) {
  const params = await props.params
  const { locale } = params
  setRequestLocale(locale)

  return <HomeContent locale={locale} initialTag={MAIN_TAG_SLUG} />
}
