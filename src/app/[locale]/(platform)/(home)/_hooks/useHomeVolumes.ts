'use client'

import type { Event } from '@/types'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { OUTCOME_INDEX } from '@/lib/constants'

interface VolumeCondition {
  condition_id: string
  token_ids: [string, string]
}

interface VolumeApiEntry {
  condition_id: string
  status: number
  volume?: string
}

const VOLUME_REFRESH_INTERVAL_MS = 60_000
const DEBUG_QUERY_PARAM = 'debugVolumes'

function isHomeVolumeDebugEnabled() {
  if (typeof window === 'undefined') {
    return false
  }

  const queryEnabled = new URLSearchParams(window.location.search).get(DEBUG_QUERY_PARAM) === '1'
  const storageEnabled = window.localStorage.getItem(DEBUG_QUERY_PARAM) === '1'
  return queryEnabled || storageEnabled
}

function buildVolumeConditions(events: Event[]): VolumeCondition[] {
  const conditions: VolumeCondition[] = []

  for (const event of events) {
    for (const market of event.markets) {
      const yesOutcome = market.outcomes.find(o => o.outcome_index === OUTCOME_INDEX.YES)?.token_id
      const noOutcome = market.outcomes.find(o => o.outcome_index === OUTCOME_INDEX.NO)?.token_id
      const fallbackTokenIds = market.outcomes
        .map(outcome => outcome.token_id)
        .filter((tokenId): tokenId is string => typeof tokenId === 'string' && tokenId.trim().length > 0)
        .slice(0, 2)

      const tokenIds = (yesOutcome && noOutcome)
        ? [yesOutcome, noOutcome]
        : fallbackTokenIds

      if (!market.condition_id || tokenIds.length < 2) {
        continue
      }

      conditions.push({
        condition_id: market.condition_id,
        token_ids: [tokenIds[0], tokenIds[1]],
      })
    }
  }

  return conditions
}

export function useHomeVolumes(events: Event[]) {
  const conditions = useMemo(() => buildVolumeConditions(events), [events])
  const debugEnabled = isHomeVolumeDebugEnabled()

  const signature = useMemo(() => {
    return conditions.map((condition: VolumeCondition) => `${condition.condition_id}:${condition.token_ids.join(':')}`).sort().join('|')
  }, [conditions])

  const { data: volumeByCondition } = useQuery({
    queryKey: ['home-volumes', signature],
    queryFn: async () => {
      if (conditions.length === 0) {
        return {} as Record<string, number>
      }

      const response = await fetch('/api/events/volumes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(debugEnabled ? { 'x-debug-volumes': '1' } : {}),
        },
        body: JSON.stringify({
          include_24h: false,
          conditions,
        }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null) as { error?: string } | null
        const details = typeof errorPayload?.error === 'string' ? ` ${errorPayload.error}` : ''
        const message = `Failed to fetch home volumes (${response.status} ${response.statusText}).${details}`
        console.error(message)
        throw new Error(message)
      }

      const payload = await response.json() as VolumeApiEntry[]
      if (debugEnabled) {
        const okEntries = payload.filter(entry => entry?.status === 200).length
        const missingEntries = payload.filter(entry => entry?.status !== 200).map(entry => ({
          condition_id: entry?.condition_id,
          status: entry?.status,
        }))
        console.info('[home-volumes] API payload summary', {
          eventsCount: events.length,
          conditionsCount: conditions.length,
          payloadCount: payload.length,
          okEntries,
          missingEntriesCount: missingEntries.length,
          missingEntriesSample: missingEntries.slice(0, 10),
        })
      }

      const result: Record<string, number> = {}
      for (const entry of payload) {
        if (entry?.status === 200 && entry.volume != null) {
          const numeric = Number(entry.volume)
          if (Number.isFinite(numeric)) {
            result[entry.condition_id] = (result[entry.condition_id] ?? 0) + numeric
          }
        }
      }

      return result
    },
    enabled: conditions.length > 0,
    staleTime: VOLUME_REFRESH_INTERVAL_MS,
    gcTime: VOLUME_REFRESH_INTERVAL_MS,
    refetchInterval: VOLUME_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    placeholderData: keepPreviousData,
  })

  const volumeByEvent = useMemo(() => {
    const result: Record<string, number> = {}
    const eventDebugRows: Array<{
      eventId: string
      eventTitle: string
      liveMarketsUsed: number
      fallbackMarketsUsed: number
      total: number
    }> = []

    for (const event of events) {
      let total = 0
      let liveMarketsUsed = 0
      let fallbackMarketsUsed = 0
      for (const market of event.markets) {
        const liveVolume = volumeByCondition?.[market.condition_id]
        const fallbackMarketVolume = Number.isFinite(market.volume) ? market.volume : 0
        const fallbackConditionVolume = Number.isFinite(market.condition?.volume)
          ? market.condition.volume
          : 0
        const fallbackVolume = Math.max(fallbackMarketVolume, fallbackConditionVolume)
        const marketVolume = typeof liveVolume === 'number' && Number.isFinite(liveVolume)
          ? liveVolume
          : fallbackVolume
        if (typeof liveVolume === 'number' && Number.isFinite(liveVolume)) {
          liveMarketsUsed += 1
        }
        else {
          fallbackMarketsUsed += 1
        }
        total += marketVolume
      }
      result[event.id] = total

      if (debugEnabled) {
        eventDebugRows.push({
          eventId: event.id,
          eventTitle: event.title,
          liveMarketsUsed,
          fallbackMarketsUsed,
          total,
        })
      }
    }

    if (debugEnabled) {
      console.info('[home-volumes] event totals summary', {
        signature,
        eventsCount: events.length,
        rows: eventDebugRows.slice(0, 20),
      })
    }

    return result
  }, [debugEnabled, events, signature, volumeByCondition])

  return volumeByEvent
}



