import { defaultNetwork } from '@/lib/appkit'

export const POLYGON_MAINNET_CHAIN_ID = 137

export const AMOY_CHAIN_ID = 80_002

const currentChainId = Number(defaultNetwork.id)

export const IS_TEST_MODE = currentChainId === AMOY_CHAIN_ID

export const POLYGON_SCAN_BASE = IS_TEST_MODE
  ? 'https://amoy.polygonscan.com'
  : 'https://polygonscan.com'
