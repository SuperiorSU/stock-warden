'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { api } from '@/lib/api/client'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
  })
  const departmentOptions = [
    'MBA/BBA',
    'Pharmacy',
    'Hotel Management',
    'Computer Science',
    'Admission Cell',
    'BCA',
    'Paramedical',
    'Applied Sciences',
    'Super60',
    'The Unqiues',
  ]
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await api.post('/auth/register', formData)
      
      if (response.data.success) {
        toast.success(response.data.data.message || 'Registration successful. Pending admin approval.', {
          duration: 5000,
        })
        router.push('/login')
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to register.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--bg-canvas] px-4 py-12">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg border border-[--border-default] p-8">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-[--ink-primary] mb-2">Create Account</h1>
          <p className="text-[--ink-secondary] text-sm">Join Stock Warden as a Department User</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="name">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              className="w-full px-3 py-2 border border-[--border-default] rounded-md focus:outline-none focus:ring-1 focus:ring-black"
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              className="w-full px-3 py-2 border border-[--border-default] rounded-md focus:outline-none focus:ring-1 focus:ring-black"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="department">
              Department
            </label>
            <select
              id="department"
              required
              className="w-full px-3 py-2 border border-[--border-default] rounded-md focus:outline-none focus:ring-1 focus:ring-black"
              value={formData.department}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, department: e.target.value }))
              }
            >
              <option value="" disabled>
                Select department
              </option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              className="w-full px-3 py-2 border border-[--border-default] rounded-md focus:outline-none focus:ring-1 focus:ring-black"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded-md font-medium hover:bg-[--accent-hover] transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Submitting...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-[--ink-secondary]">
            Already have an account?{' '}
            <Link href="/login" className="text-black hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
