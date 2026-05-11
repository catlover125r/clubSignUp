import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

let _auth: Auth | null = null
let _db: Firestore | null = null

function initApp(): App {
  if (getApps().length > 0) return getApps()[0]!
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64!
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString())
  return initializeApp({ credential: cert(serviceAccount) })
}

export function getAdminAuth(): Auth {
  if (!_auth) _auth = getAuth(initApp())
  return _auth
}

export function getAdminDb(): Firestore {
  if (!_db) _db = getFirestore(initApp())
  return _db
}

function isAllowedEmail(email?: string) {
  const allowedDomain = process.env.ALLOWED_DOMAIN ?? process.env.NEXT_PUBLIC_ALLOWED_DOMAIN
  if (!allowedDomain) return true

  const normalizedEmail = email?.toLowerCase()
  const normalizedDomain = allowedDomain.trim().toLowerCase().replace(/^@/, '')
  return Boolean(normalizedEmail?.endsWith(`@${normalizedDomain}`))
}

export async function verifyToken(token: string) {
  const decoded = await getAdminAuth().verifyIdToken(token)
  if (!isAllowedEmail(decoded.email)) {
    throw new Error('Email domain is not allowed')
  }
  return decoded
}
