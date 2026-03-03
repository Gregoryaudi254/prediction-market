import { createOpenAPI } from 'fumadocs-openapi/server'

export const openapi = createOpenAPI({
  input: () => ({
    'clob': './docs/api-reference/schemas/openapi.json',
    'clob-extended': './docs/api-reference/schemas/openapi2.json',
    'create-market': './docs/api-reference/schemas/openapi-create-market.json',
    'community': './docs/api-reference/schemas/openapi-community.json',
    'data-api': './docs/api-reference/schemas/openapi-data-api.json',
    'price-reference': './docs/api-reference/schemas/openapi-price-reference.json',
    'relayer': './docs/api-reference/schemas/openapi-relayer.json',
  }),
  proxyUrl: '/docs/api/proxy',
})
