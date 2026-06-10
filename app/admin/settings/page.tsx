'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api/client'
import { Loader2 } from 'lucide-react'

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({ name: '', phoneNumber: '' })

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: async () => {
      const res = await api.get('/auth/me')
      return res.data.data
    }
  })

  useEffect(() => {
    if (profileData) {
      setFormData({
        name: profileData.name || '',
        phoneNumber: profileData.phoneNumber || ''
      })
    }
  }, [profileData])

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await api.put('/user/profile', data)
    },
    onSuccess: () => {
      toast.success('Settings updated successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-profile'] })
    },
    onError: () => {
      toast.error('Failed to update settings')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  if (isLoading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-display font-bold text-[--ink-primary]">Settings</h1>
        <p className="text-sm text-[--ink-secondary]">Update your admin profile settings.</p>
      </div>

      <div className="bg-white rounded-xl border border-[--border-default] overflow-hidden shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1">
              Email Address (Read Only)
            </label>
            <input
              type="email"
              disabled
              value={profileData?.email || ''}
              className="w-full px-3 py-2 border border-[--border-default] bg-[--bg-canvas] text-[--ink-secondary] rounded-md cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-[--border-default] rounded-md focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full px-3 py-2 border border-[--border-default] rounded-md focus:outline-none focus:ring-1 focus:ring-black"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-black text-white rounded-md font-medium hover:bg-[--accent-hover] transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
