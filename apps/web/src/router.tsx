import { createBrowserRouter, Navigate } from 'react-router-dom'
import { EntryShell } from './shells/EntryShell.tsx'
import { AccessShell } from './shells/AccessShell.tsx'
import { WorkspaceShell } from './shells/WorkspaceShell.tsx'
import { PublicLinkShell } from './shells/PublicLinkShell.tsx'
import {
  AccessRouteResolver,
  EntryRouteResolver,
  WorkspaceRouteResolver,
} from './components/RouteResolver.tsx'
import { LoginPage } from './views/LoginPage.tsx'
import { RegisterPage } from './views/RegisterPage.tsx'
import { WaitingPage } from './views/WaitingPage.tsx'
import { BlockedPage } from './views/BlockedPage.tsx'
import { DeviceSetupPage } from './views/DeviceSetupPage.tsx'
import { DevicePairPage } from './views/DevicePairPage.tsx'
import { DevicePairWaitingPage } from './views/DevicePairWaitingPage.tsx'
import { DevicePairApprovePage } from './views/DevicePairApprovePage.tsx'
import { DeviceRecoveryPage } from './views/DeviceRecoveryPage.tsx'
import { DeviceRecoveryRotatedCodesPage } from './views/DeviceRecoveryRotatedCodesPage.tsx'
import { AppTimelinePage } from './views/AppTimelinePage.tsx'
import { AppUploadPage } from './views/AppUploadPage.tsx'
import { AppHistoryPage } from './views/AppHistoryPage.tsx'
import { AppSearchPage } from './views/AppSearchPage.tsx'
import { AppItemDetailPage } from './views/AppItemDetailPage.tsx'
import { AppSettingsPage } from './views/AppSettingsPage.tsx'
import { PublicLinkPage } from './views/PublicLinkPage.tsx'
import { LiveStartPage } from './views/LiveStartPage.tsx'
import { LiveSessionPage } from './views/LiveSessionPage.tsx'
import { LiveJoinPage } from './views/LiveJoinPage.tsx'
import { ExtractionEntryPage } from './views/ExtractionEntryPage.tsx'
import { ShareToolsPage } from './views/ShareToolsPage.tsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/app" replace />,
  },
  {
    element: <EntryShell />,
    children: [
      {
        element: <EntryRouteResolver />,
        children: [
          {
            path: '/login',
            element: <LoginPage />,
          },
          {
            path: '/register',
            element: <RegisterPage />,
          },
        ],
      },
    ],
  },
  {
    element: <AccessShell />,
    children: [
      {
        element: <AccessRouteResolver />,
        children: [
          {
            path: '/waiting',
            element: <WaitingPage />,
          },
          {
            path: '/blocked',
            element: <BlockedPage />,
          },
          {
            path: '/device/setup',
            element: <DeviceSetupPage />,
          },
          {
            path: '/device/pair',
            element: <DevicePairPage />,
          },
          {
            path: '/device/pair/waiting',
            element: <DevicePairWaitingPage />,
          },
          {
            path: '/device/pair/approve',
            element: <DevicePairApprovePage />,
          },
          {
            path: '/device/recovery',
            element: <DeviceRecoveryPage />,
          },
          {
            path: '/device/recovery/rotated-codes',
            element: <DeviceRecoveryRotatedCodesPage />,
          },
        ],
      },
    ],
  },
  {
    path: '/app',
    element: <WorkspaceShell />,
    children: [
      {
        element: <WorkspaceRouteResolver />,
        children: [
          {
            index: true,
            element: <AppTimelinePage />,
          },
          {
            path: 'timeline',
            element: <AppTimelinePage />,
          },
          {
            path: 'upload',
            element: <AppUploadPage />,
          },
          {
            path: 'history',
            element: <AppHistoryPage />,
          },
          {
            path: 'search',
            element: <AppSearchPage />,
          },
          {
            path: 'items/:itemId',
            element: <AppItemDetailPage />,
          },
          {
            path: 'settings',
            element: <AppSettingsPage />,
          },
          {
            path: 'share-tools',
            element: <ShareToolsPage />,
          },
        ],
      },
    ],
  },
  {
    path: '/x/:entryToken',
    element: <ExtractionEntryPage />,
  },
  {
    path: '/live/start',
    element: <LiveStartPage />,
  },
  {
    path: '/live/:sessionId',
    element: <LiveSessionPage />,
  },
  {
    path: '/live/:sessionId/join',
    element: <LiveJoinPage />,
  },
  {
    path: '/p/:token',
    element: <PublicLinkShell />,
    children: [
      {
        index: true,
        element: <PublicLinkPage />,
      },
    ],
  },
])
