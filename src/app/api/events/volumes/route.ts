import { NextResponse } from 'next/server'

interface VolumeCondition {
  condition_id: string
  token_ids: [string, string]
}

interface VolumesRequestBody {
  include_24h?: boolean
  conditions?: VolumeCondition[]
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

    const response = await fetch(`${clobUrl}/data/volumes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        include_24h: Boolean(body.include_24h),
        conditions,
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message = typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.message === 'string'
          ? payload.message
          : `Failed to fetch volumes (${response.status} ${response.statusText}).`
      return NextResponse.json({ error: message }, { status: response.status })
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


