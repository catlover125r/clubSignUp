'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  getToken: (forceRefresh?: boolean) => Promise<string>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  async function handleSignIn() {
    const result = await signInWithPopup(auth, googleProvider)
    const domain = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN
    if (domain && !result.user.email?.endsWith(`@${domain}`)) {
      await signOut(auth)
      throw new Error(`Please sign in with your @${domain} account.`)
    }
  }

  async function getToken(forceRefresh = false) {
    if (!user) throw new Error('Not signed in')
    return user.getIdToken(forceRefresh)
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn: handleSignIn,
      signOut: () => signOut(auth),
      getToken,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
