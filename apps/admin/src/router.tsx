import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AdminShell } from './shells/AdminShell.tsx'
import { AdminRouteResolver } from './components/AdminRouteResolver.tsx'
import { AdminLoginPage } from './views/AdminLoginPage.tsx'
import { AdminOverviewPage } from './views/AdminOverviewPage.tsx'
import { AdminUsersPage } from './views/AdminUsersPage.tsx'
import { AdminInvitesPage } from './views/AdminInvitesPage.tsx'
import { AdminApprovalsPage } from './views/AdminApprovalsPage.tsx'
import { AdminPolicyPage } from './views/AdminPolicyPage.tsx'
import { AdminSystemPage } from './views/AdminSystemPage.tsx'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AdminLoginPage />,
  },
  {
    path: '/',
    element: <Navigate to="/admin" replace />,
  },
  {
    element: <AdminRouteResolver />,
    children: [
      {
        path: '/admin',
        element: <AdminShell />,
        children: [
          {
            index: true,
            element: <AdminOverviewPage />,
          },
          {
            path: 'invites',
            element: <AdminInvitesPage />,
          },
          {
            path: 'approvals',
            element: <AdminApprovalsPage />,
          },
          {
            path: 'users',
            element: <AdminUsersPage />,
          },
          {
            path: 'policy',
            element: <AdminPolicyPage />,
          },
          {
            path: 'system',
            element: <AdminSystemPage />,
          },
        ],
      },
    ],
  },
])
