import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<unknown> }) {
  const { clubId } = await params as { clubId: string }
  const clubSnap = await getAdminDb().collection('clubs').doc(clubId).get()

  if (!clubSnap.exists) {
    return NextResponse.json({ error: 'Club not found' }, { status: 404 })
  }

  const club = clubSnap.data()!
  return NextResponse.json({
    club: {
      id: clubSnap.id,
      name: club.name ?? '',
      meetingPlace: club.meetingPlace ?? '',
      meetingTime: club.meetingTime ?? '',
      description: club.description ?? '',
    },
  })
}
