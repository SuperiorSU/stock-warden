'use client'

import { useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api/client'
import { Check, X, Loader2, UserPlus, Eye, EyeOff, ChevronDown } from 'lucide-react'

interface PendingUser {
  id: string
  name: string
  email: string
  department: string | null
  createdAt: string
}

const DEPARTMENT_OPTIONS = [
  'MBA/BBA', 'Pharmacy', 'Hotel Management', 'Computer Science',
  'Admin Block', 'BCA', 'Paramedical', 'Applied Sciences', 'Super60', 'The Uniques',
]

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'INVENTORY_MANAGER', label: 'Inventory Manager' },
]

function CreateStaffModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'INVENTORY_MANAGER',
    department: '',
    employeeId: '',
    designation: '',
    phoneNumber: '',
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/admin/users/create', form),
    onSuccess: () => {
      toast.success('Staff account created. The user can now log in.')
      queryClient.invalidateQueries({ queryKey: ['admin-pending-users'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Could not create the account. Please check the details and try again.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('Name, email and password are required')
      return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    createMutation.mutate()
  }

  const field = (id: keyof typeof form) => ({
    value: form[id],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [id]: e.target.value })),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      {/* CRITICAL FIX: Changed wrapper layout configurations to an explicit h-full max-h-[80vh] 
        combined with an internal relative layout container to enforce strict inner vertical bounds.
      */}
      <div className="bg-white rounded-xl shadow-xl border border-[--border-default] w-full max-w-lg h-full max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header — Locked to Top */}
        <div className="p-6 border-b border-[--border-default] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-[--ink-primary]">Create Staff Account</h3>
            <p className="text-sm text-[--ink-secondary] mt-0.5">Account is immediately active — no approval needed.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[--ink-secondary] hover:text-[--ink-primary] hover:bg-[--bg-subtle] rounded-md transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* CRITICAL FIX: Form acts as the scroll window. Explicitly set 'block' 
          with 'h-full' and 'overflow-y-auto' so the browser native frame 
          is forced to clip the inner form inputs cleanly.
        */}
        <form 
          ref={formRef} 
          onSubmit={handleSubmit} 
          className="block p-6 space-y-4 overflow-y-auto h-full min-h-0"
        >
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="cs-name">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="cs-name"
              type="text"
              required
              placeholder="e.g. Ravi Kumar"
              className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
              {...field('name')}
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="cs-role">
              Role <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="cs-role"
                required
                className="w-full px-3 py-2 pr-9 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black appearance-none bg-white"
                {...field('role')}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[--ink-secondary] pointer-events-none" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="cs-email">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="cs-email"
              type="email"
              required
              placeholder="staff@example.com"
              className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
              {...field('email')}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="cs-password">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="cs-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Min. 6 characters"
                className="w-full px-3 py-2 pr-10 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
                {...field('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[--ink-secondary] hover:text-[--ink-primary] transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="cs-dept">
              Department <span className="text-[--ink-tertiary] font-normal">(optional)</span>
            </label>
            <div className="relative">
              <select
                id="cs-dept"
                className="w-full px-3 py-2 pr-9 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black appearance-none bg-white"
                {...field('department')}
              >
                <option value="">— Select department —</option>
                {DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[--ink-secondary] pointer-events-none" />
            </div>
          </div>

          {/* Employee ID + Designation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="cs-empid">
                Employee ID <span className="text-[--ink-tertiary] font-normal">(optional)</span>
              </label>
              <input
                id="cs-empid"
                type="text"
                placeholder="e.g. EMP-001"
                className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
                {...field('employeeId')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="cs-desig">
                Designation <span className="text-[--ink-tertiary] font-normal">(optional)</span>
              </label>
              <input
                id="cs-desig"
                type="text"
                placeholder="e.g. Store Manager"
                className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
                {...field('designation')}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-[--ink-primary] mb-1" htmlFor="cs-phone">
              Phone Number <span className="text-[--ink-tertiary] font-normal">(optional)</span>
            </label>
            <input
              id="cs-phone"
              type="tel"
              placeholder="e.g. +91 9876543210"
              className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
              {...field('phoneNumber')}
            />
          </div>
        </form>

        {/* Modal Footer — Locked to Bottom */}
        <div className="px-6 py-4 bg-[--bg-canvas] border-t border-[--border-default] flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-[--ink-secondary] border border-[--border-default] rounded-md hover:bg-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-[--accent-hover] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Create Account
          </button>
        </div>
      </div>
    </div>
  )
}
export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null)
  const [modalAction, setModalAction] = useState<'approve' | 'reject' | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const usersQuery = useInfiniteQuery({
    queryKey: ['admin-pending-users'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await api.get('/admin/users', { params: { status: 'pending', cursor: pageParam, limit: 20 } })
      return res.data
    },
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  })

  const users = usersQuery.data?.pages.flatMap((page) => page.data) ?? []
  const totalUsers = usersQuery.data?.pages[0]?.meta?.total ?? 0

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => api.patch(`/admin/users/${userId}/approve`),
    onSuccess: () => {
      toast.success('User approved. They can now access the system.')
      queryClient.invalidateQueries({ queryKey: ['admin-pending-users'] })
      closeModal()
    },
    onError: () => toast.error('Could not approve this user. Please try again.'),
  })

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => api.delete(`/admin/users/${userId}/reject`),
    onSuccess: () => {
      toast.success('Registration rejected and removed.')
      queryClient.invalidateQueries({ queryKey: ['admin-pending-users'] })
      closeModal()
    },
    onError: () => toast.error('Could not reject this registration. Please try again.'),
  })

  const openModal = (user: PendingUser, action: 'approve' | 'reject') => {
    setSelectedUser(user)
    setModalAction(action)
  }

  const closeModal = () => {
    setSelectedUser(null)
    setModalAction(null)
  }

  const handleConfirm = () => {
    if (!selectedUser || !modalAction) return
    if (modalAction === 'approve') approveMutation.mutate(selectedUser.id)
    else rejectMutation.mutate(selectedUser.id)
  }

  const isMutating = approveMutation.isPending || rejectMutation.isPending

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--ink-primary]">User Management</h1>
          <p className="text-[--ink-secondary] text-sm mt-1">Approve pending registrations or create staff accounts directly.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[--accent-hover] transition-colors shrink-0"
        >
          <UserPlus size={16} />
          Create Staff Account
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[--border-default] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[--border-default]">
          <h2 className="font-semibold text-[--ink-primary]">Pending Registrations</h2>
          <p className="text-xs text-[--ink-secondary] mt-0.5">Department users who self-registered and are awaiting your approval.</p>
        </div>

        {usersQuery.isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-[--ink-secondary]" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-[--ink-secondary] text-sm">
            No pending user registrations at the moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[--bg-canvas] border-b border-[--border-default] text-[--ink-secondary]">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium hidden sm:table-cell">Email</th>
                  <th className="px-6 py-4 font-medium hidden md:table-cell">Department</th>
                  <th className="px-6 py-4 font-medium hidden sm:table-cell">Registered</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[--bg-canvas] transition-colors">
                    <td className="px-6 py-4 text-[--ink-primary] font-medium">
                      <div>{user.name}</div>
                      <div className="sm:hidden text-xs text-[--ink-secondary] mt-0.5">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 text-[--ink-secondary] hidden sm:table-cell">{user.email}</td>
                    <td className="px-6 py-4 text-[--ink-secondary] hidden md:table-cell">{user.department || '-'}</td>
                    <td className="px-6 py-4 text-[--ink-secondary] hidden sm:table-cell">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openModal(user, 'approve')}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          title="Approve"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openModal(user, 'reject')}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Reject"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {users.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-[--ink-secondary]">
          <div>Showing {users.length} of {totalUsers} pending users</div>
          {usersQuery.hasNextPage && (
            <button
              onClick={() => usersQuery.fetchNextPage()}
              disabled={usersQuery.isFetchingNextPage}
              className="px-4 py-2 border border-[--border-default] rounded-md font-medium hover:bg-[--bg-subtle] disabled:opacity-50"
            >
              {usersQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}

      {/* Approve / Reject confirmation */}
      {selectedUser && modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-lg border border-[--border-default] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-medium text-[--ink-primary]">
                {modalAction === 'approve' ? 'Approve Registration' : 'Reject Registration'}
              </h3>
              <p className="mt-2 text-sm text-[--ink-secondary] leading-relaxed">
                Are you sure you want to {modalAction} the account request for{' '}
                <span className="font-medium text-[--ink-primary]">{selectedUser.name}</span>?
                {modalAction === 'reject' && ' This cannot be undone and the request will be removed.'}
              </p>
            </div>
            <div className="px-6 py-4 bg-[--bg-canvas] border-t border-[--border-default] flex justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={isMutating}
                className="px-4 py-2 text-sm font-medium text-[--ink-secondary] border border-[--border-default] rounded-md hover:bg-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isMutating}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 ${
                  modalAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isMutating && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && <CreateStaffModal onClose={() => setShowCreateModal(false)} />}
    </div>
  )
}
