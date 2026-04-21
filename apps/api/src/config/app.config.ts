export const appConfig = () => ({
  apiPort: Number(process.env.API_PORT ?? 3002),
  sessionSecret: process.env.SESSION_SECRET ?? 'change-me',
  pairingCodeLength: Number(process.env.PAIRING_CODE_LENGTH ?? 6),
  publicAppUrl: process.env.PUBLIC_APP_URL ?? 'http://localhost:5173',
  publicApiUrl: process.env.PUBLIC_API_URL ?? 'http://localhost:3002',
});
