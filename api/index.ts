import { app, appReady } from '../server';

export default async (req: any, res: any) => {
  // Await full server initialization so all routes are registered
  // before we handle the request (prevents race on Vercel cold starts).
  await appReady;
  return app(req, res);
};
