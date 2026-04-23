import { NextResponse } from 'next/server'

interface VolumeCondition {
  condition_id: string
  token_ids: [string, string]
}

interface VolumesRequestBody {
  include_24h?: boolean
  conditions?: VolumeCondition[]
}

interface VolumeApiEntry {
  condition_id: string
  status: number
  volume?: string
}

const VOLUME_CHUNK_SIZE = 60

function chunkConditions(conditions: VolumeCondition[], size: number) {
  const chunks: VolumeCondition[][] = []
  for (let index = 0; index < conditions.length; index += size) {
    chunks.push(conditions.slice(index, index + size))
  }
  return chunks
}

export async function POST(request: Request) {
  const debugRequested = request.headers.get('x-debug-volumes') === '1'
  const debugEnabled = debugRequested || process.env.DEBUG_VOLUMES === '1'
  const clobUrl = process.env.CLOB_URL
  if (!clobUrl) {
    return NextResponse.json({ error: 'CLOB_URL is not configured.' }, { status: 500 })
  }

  let body: VolumesRequestBody
  try {
    body = await request.json()
  }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const conditions = Array.isArray(body.conditions)
    ? body.conditions.filter((item): item is VolumeCondition => (
      typeof item?.condition_id === 'string'
      && Array.isArray(item?.token_ids)
      && item.token_ids.length === 2
      && typeof item.token_ids[0] === 'string'
      && typeof item.token_ids[1] === 'string'
    ))
    : []

  if (conditions.length === 0) {
    if (debugEnabled) {
      console.info('[api/events/volumes] empty request conditions')
    }
    return NextResponse.json([])
  }

  try {
    if (debugEnabled) {
      console.info('[api/events/volumes] forwarding request', {
        include24h: Boolean(body.include_24h),
        conditionsCount: conditions.length,
        conditionSample: conditions.slice(0, 10).map(item => item.condition_id),
      })
    }

    const chunks = chunkConditions(conditions, VOLUME_CHUNK_SIZE)
    const payload: VolumeApiEntry[] = []
    const include24h = Boolean(body.include_24h)

    for (const chunk of chunks) {
      const response = await fetch(`${clobUrl}/data/volumes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          include_24h: include24h,
          conditions: chunk,
        }),
      })

      const chunkPayload = await response.json().catch(() => null)
      if (!response.ok) {
        const message = typeof chunkPayload?.error === 'string'
          ? chunkPayload.error
          : typeof chunkPayload?.message === 'string'
            ? chunkPayload.message
            : `Failed to fetch volumes (${response.status} ${response.statusText}).`

        if (debugEnabled) {
          console.warn('[api/events/volumes] chunk request failed', {
            message,
            status: response.status,
            chunkSize: chunk.length,
            conditionSample: chunk.slice(0, 10).map(item => item.condition_id),
          })
        }

        // Return per-condition non-200 items so caller can fallback to DB volumes.
        payload.push(
          ...chunk.map(condition => ({
            condition_id: condition.condition_id,
            status: response.status,
          })),
        )
        continue
      }

      if (Array.isArray(chunkPayload)) {
        payload.push(...chunkPayload as VolumeApiEntry[])
      }
      else {
        payload.push(
          ...chunk.map(condition => ({
            condition_id: condition.condition_id,
            status: 500,
          })),
        )
      }
    }

    if (debugEnabled && Array.isArray(payload)) {
      const statusHistogram = payload.reduce<Record<string, number>>((acc, item: any) => {
        const key = String(item?.status ?? 'unknown')
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      }, {})
      const missingIds = payload
        .filter((item: any) => item?.status !== 200)
        .map((item: any) => item?.condition_id)
        .filter((value: unknown): value is string => typeof value === 'string')

      console.info('[api/events/volumes] upstream response summary', {
        payloadCount: payload.length,
        statusHistogram,
        missingConditionCount: missingIds.length,
        missingConditionSample: missingIds.slice(0, 20),
      })
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch volumes.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}



