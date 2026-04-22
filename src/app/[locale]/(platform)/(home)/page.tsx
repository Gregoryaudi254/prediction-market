import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'

async function CachedHomePageContent({ locale }: { locale: SupportedLocale }) {
  'use cache'

  return <HomeContent locale={locale} />
}

export default async function HomePage(props: PageProps<'/[locale]'>) {
  const params = await props.params
  const { locale } = params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  return <CachedHomePageContent locale={resolvedLocale} />
}
