import { openapi } from '@/lib/openapi'

const allowedOrigins = [
  process.env.CLOB_URL,
  process.env.DATA_URL,
  process.env.RELAYER_URL,
  process.env.CREATE_MARKET_URL,
  process.env.COMMUNITY_URL,
  'https://price-reference.kuest.com',
]
  .filter(Boolean)
  .map((url) => {
    try {
      return new URL(url!).origin
    }
    catch {
      return null
    }
  })
  .filter((origin): origin is string => Boolean(origin))

export const { GET, POST, PUT, DELETE, PATCH, HEAD } = openapi.createProxy({
  allowedOrigins,
})
