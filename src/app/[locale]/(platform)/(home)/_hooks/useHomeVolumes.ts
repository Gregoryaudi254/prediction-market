'use client'

import type { Event } from '@/types'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { OUTCOME_INDEX } from '@/lib/constants'
import { toast } from 'sonner'

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

function buildVolumeConditions(events: Event[]): VolumeCondition[] {
  const conditions: VolumeCondition[] = []

  for (const event of events) {
    for (const market of event.markets) {
      const yesOutcome = market.outcomes.find(o => o.outcome_index === OUTCOME_INDEX.YES)
      const noOutcome = market.outcomes.find(o => o.outcome_index === OUTCOME_INDEX.NO)

      if (!yesOutcome?.token_id || !noOutcome?.token_id) {
        continue
      }

      conditions.push({
        condition_id: market.condition_id,
        token_ids: [yesOutcome.token_id, noOutcome.token_id],
      })
    }
  }

  return conditions
}

export function useHomeVolumes(events: Event[]) {
  const conditions = useMemo(() => buildVolumeConditions(events), [events])

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
        },
        body: JSON.stringify({
          include_24h: false,
          conditions,
        }),
      })

       toast.info(JSON.stringify(response))

      console.log('responseees', JSON.stringify(response))

      if (!response.ok) {
        const message = `Failed to fetch home volumes (${response.status} ${response.statusText}).`
        console.error(message)
        throw new Error(message)
      }

      const payload = await response.json() as VolumeApiEntry[]

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
    if (!volumeByCondition) {
      return {}
    }

    const result: Record<string, number> = {}
    for (const event of events) {
      let total = 0
      for (const market of event.markets) {
        const marketVolume = volumeByCondition[market.condition_id]
        if (marketVolume != null && Number.isFinite(marketVolume)) {
          total += marketVolume
        }
      }
      if (total > 0) {
        result[event.id] = total
      }
    }
    return result
  }, [events, volumeByCondition])

  return volumeByEvent
}

