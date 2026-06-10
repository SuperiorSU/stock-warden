export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const sourceUrl = searchParams.get('url') ??
    `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`

  let upstream: Response
  try {
    upstream = await fetch(sourceUrl, { redirect: 'follow' })
  } catch {
    return new Response('Failed to fetch upstream image', { status: 502 })
  }

  if (!upstream.ok) {
    return new Response(`Upstream returned ${upstream.status}`, { status: upstream.status })
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
  const body = upstream.body

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

export const dynamic = 'force-dynamic'
