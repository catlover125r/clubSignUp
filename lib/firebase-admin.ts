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

export async function verifyToken(token: string) {
  return getAdminAuth().verifyIdToken(token)
}
