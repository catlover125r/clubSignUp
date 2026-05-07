import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function initAdmin(): App {
  if (getApps().length > 0) return getApps()[0]!

  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64!, 'base64').toString()
  )

  return initializeApp({ credential: cert(serviceAccount) })
}

const adminApp = initAdmin()
export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)

export async function verifyToken(token: string) {
  return adminAuth.verifyIdToken(token)
}
