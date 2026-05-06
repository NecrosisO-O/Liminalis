import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AdminGate, AdminLoginPage } from './features/auth/routes.tsx'
import { AdminShell } from './features/console/shell.tsx'
import { ApprovalsPage, InvitesPage, OverviewPage, PolicyPage, SettingsPage, StoragePage, UsersPage } from './features/console/pages.tsx'

export const router = createBrowserRouter([
  { path: '/login', element: <AdminLoginPage /> },
  { path: '/', element: <Navigate to="/admin" replace /> },
  {
    element: <AdminGate />,
    children: [
      {
        path: '/admin',
        element: <AdminShell />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'invites', element: <InvitesPage /> },
          { path: 'approvals', element: <ApprovalsPage /> },
          { path: 'users', element: <UsersPage /> },
          { path: 'policy', element: <PolicyPage /> },
          { path: 'storage', element: <StoragePage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
])
