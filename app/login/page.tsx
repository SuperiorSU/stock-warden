'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { signIn } from 'next-auth/react'
import { api } from '@/lib/api/client'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      })

      if (result?.error) {
        toast.error(result.error)
        return
      }

      const me = await api.get('/auth/me')
      const role = me.data?.data?.role

      const channel = new BroadcastChannel('cims-auth')
      channel.postMessage({ type: 'LOGIN' })

      toast.success('Welcome back! You are now signed in.')

      if (role === 'SUPER_ADMIN') {
        router.push('/super-admin/overview')
      } else if (role === 'ADMIN') {
        router.push('/admin/requests')
      } else if (role === 'INVENTORY_MANAGER') {
        router.push('/inventory-manager')
      } else {
        router.push('/dashboard')
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Invalid credentials or account locked.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg border border-[--border-default] p-8">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-[--ink-primary] mb-2">Stock Warden</h1>
          <p className="text-[--ink-secondary] text-sm">Sign in to manage your inventory</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-[--border-default] rounded-md focus:outline-none focus:ring-1 focus:ring-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 pr-10 border border-[--border-default] rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[--ink-secondary] hover:text-[--ink-primary] transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded-md font-medium hover:bg-[--accent-hover] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-[--ink-secondary]">
            Don't have an account?{' '}
            <Link href="/register" className="text-black hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
