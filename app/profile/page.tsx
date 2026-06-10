'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { UserCircle, Mail, Briefcase, Phone, Hash } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({ name: '', phoneNumber: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const res = await api.get('/user/profile')
      return res.data.data
    }
  })

  useEffect(() => {
    if (data?.user) {
      setFormData({
        name: data.user.name || '',
        phoneNumber: data.user.phoneNumber || '',
      })
    }
  }, [data])

  const updateProfileMutation = useMutation({
    mutationFn: (updates: { name: string, phoneNumber: string }) => api.put('/user/profile', updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      setIsEditing(false)
      toast.success('Profile updated successfully')
    },
    onError: () => {
      toast.error('Failed to update profile')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate(formData)
  }

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
  }

  const { user, stats } = data || {}

  return (
    <div className="max-w-4xl mx-auto space-y-8 page-enter">
      <div>
        <h1 className="text-2xl font-display font-bold">Profile</h1>
        <p className="text-[--ink-secondary] text-sm">Manage your personal information and view stats</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="md:col-span-2 bg-white rounded-lg border border-[--border-default] overflow-hidden shadow-sm">
          <div className="p-6 border-b border-[--border-default] flex justify-between items-center">
            <h2 className="font-display text-xl font-bold">Personal Information</h2>
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-sm font-medium text-black hover:underline"
              >
                Edit Profile
              </button>
            ) : (
              <button 
                onClick={() => {
                  setIsEditing(false)
                  setFormData({ name: user.name || '', phoneNumber: user.phoneNumber || '' })
                }}
                className="text-sm font-medium text-[--ink-secondary] hover:underline"
              >
                Cancel
              </button>
            )}
          </div>
          
          <div className="p-6">
            <div className="flex items-center space-x-6 mb-8">
              <div className="relative w-20 h-20 rounded-full bg-[--bg-subtle] flex items-center justify-center text-[--ink-disabled] overflow-hidden">
                {user?.avatarUrl ? (
                  <Image fill unoptimized src={user.avatarUrl} alt={user.name} className="object-cover" />
                ) : (
                  <UserCircle size={48} />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-[--ink-primary]">{user?.name}</h3>
                <p className="text-sm font-medium text-black">{user?.role}</p>
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-[--ink-primary] mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-[--border-default] rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--ink-primary] mb-1">Phone Number</label>
                  <input 
                    type="text" 
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    className="w-full px-3 py-2 border border-[--border-default] rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="bg-black text-white px-4 py-2 rounded-md font-medium hover:bg-[--accent-hover] transition-colors disabled:opacity-50"
                >
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <p className="text-xs text-[--ink-secondary] flex items-center space-x-1.5 mb-1"><Mail size={14} /> Email</p>
                  <p className="font-medium text-[--ink-primary] text-sm">{user?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-[--ink-secondary] flex items-center space-x-1.5 mb-1"><Briefcase size={14} /> Department</p>
                  <p className="font-medium text-[--ink-primary] text-sm">{user?.department || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-xs text-[--ink-secondary] flex items-center space-x-1.5 mb-1"><Hash size={14} /> Employee ID</p>
                  <p className="font-medium text-[--ink-primary] text-sm">{user?.employeeId || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-xs text-[--ink-secondary] flex items-center space-x-1.5 mb-1"><Phone size={14} /> Phone</p>
                  <p className="font-medium text-[--ink-primary] text-sm">{user?.phoneNumber || 'Not specified'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-[--border-default] shadow-sm p-6">
            <h3 className="font-display text-lg font-bold border-b border-[--border-default] pb-3 mb-4">Request Statistics</h3>
            <ul className="space-y-4">
              <li className="flex justify-between items-center">
                <span className="text-sm text-[--ink-secondary]">Total Requests</span>
                <span className="font-medium">{stats?.totalRequests}</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-sm text-[--ink-secondary]">Approved</span>
                <span className="font-medium text-green-700">{stats?.approvedRequests}</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-sm text-[--ink-secondary]">Pending</span>
                <span className="font-medium text-blue-700">{stats?.pendingRequests}</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-sm text-[--ink-secondary]">Rejected</span>
                <span className="font-medium text-red-700">{stats?.rejectedRequests}</span>
              </li>
            </ul>
          </div>
          
          {stats?.mostRequestedItem && (
            <div className="bg-white rounded-lg border border-[--border-default] shadow-sm p-6">
              <h3 className="font-display text-lg font-bold border-b border-[--border-default] pb-3 mb-4">Most Requested</h3>
              <p className="font-medium text-[--ink-primary]">{stats.mostRequestedItem.name}</p>
              <p className="text-sm text-[--ink-secondary] mt-1">{stats.mostRequestedItem.totalQty} total quantity requested</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
