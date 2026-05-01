import { createBrowserRouter, Navigate } from 'react-router-dom'
import { EntryRoute, AccessRoute, WorkspaceGate, LoginPage, RegisterPage, WaitingPage, BlockedPage } from './features/access/routes.tsx'
import {
  DevicePairApprovePage,
  DevicePairPage,
  DevicePairWaitingPage,
  DeviceRecoveryPage,
  DeviceSetupPage,
  RecoveryCodesPage,
} from './features/trust/routes.tsx'
import { WorkspaceShell } from './features/workspace/shell.tsx'
import { TimelinePage } from './features/workspace/timeline.tsx'
import { AdvancedUploadPage } from './features/workspace/upload.tsx'
import { HistoryPage, ItemDetailPage } from './features/workspace/history.tsx'
import { SharePage } from './features/share/share-page.tsx'
import { PublicLinkPage } from './features/recipients/public-link.tsx'
import { ExtractionPage } from './features/recipients/extraction.tsx'
import { LiveJoinPage, LiveSessionPage, LiveStartPage } from './features/live/routes.tsx'
import { SettingsPage } from './features/workspace/settings.tsx'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/app" replace /> },
  {
    element: <EntryRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <AccessRoute />,
    children: [
      { path: '/waiting', element: <WaitingPage /> },
      { path: '/blocked', element: <BlockedPage /> },
      { path: '/device/setup', element: <DeviceSetupPage /> },
      { path: '/device/pair', element: <DevicePairPage /> },
      { path: '/device/pair/waiting', element: <DevicePairWaitingPage /> },
      { path: '/device/pair/approve', element: <DevicePairApprovePage /> },
      { path: '/device/recovery', element: <DeviceRecoveryPage /> },
      { path: '/device/recovery/rotated-codes', element: <RecoveryCodesPage /> },
    ],
  },
  {
    path: '/app',
    element: <WorkspaceShell />,
    children: [
      {
        element: <WorkspaceGate />,
        children: [
          { index: true, element: <TimelinePage /> },
          { path: 'upload', element: <AdvancedUploadPage /> },
          { path: 'history', element: <HistoryPage /> },
          { path: 'items/:itemId', element: <ItemDetailPage /> },
          { path: 'share/:sourceItemId', element: <SharePage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    path: '/live',
    element: <WorkspaceShell />,
    children: [
      {
        element: <WorkspaceGate />,
        children: [
          { path: 'start', element: <LiveStartPage /> },
          { path: 'join', element: <LiveJoinPage /> },
          { path: ':sessionId', element: <LiveSessionPage /> },
        ],
      },
    ],
  },
  { path: '/p/:token', element: <PublicLinkPage /> },
  { path: '/x/:entryToken', element: <ExtractionPage /> },
])
