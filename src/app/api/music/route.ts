import { NextResponse } from 'next/server'
import { listMusicTracks } from '@/lib/server/music'

export const dynamic = 'force-dynamic'

export async function GET() {
	const tracks = await listMusicTracks()
	return NextResponse.json({ tracks })
}
