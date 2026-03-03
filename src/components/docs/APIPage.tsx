import { createAPIPage } from 'fumadocs-openapi/ui'
import client from '@/components/docs/APIPage.client'
import { plainShikiConfig } from '@/lib/docs/plain-shiki-config'
import { openapi } from '@/lib/openapi'

export const APIPage = createAPIPage(openapi, {
  client,
  shiki: plainShikiConfig,
})
