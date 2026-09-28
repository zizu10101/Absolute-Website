import { app, appReady } from '../server';

export default async (req: any, res: any) => {
  try {
    await appReady;
    return app(req, res);
  } catch (err: any) {
    console.error('api/index fatal error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || String(err) });
    }
  }
};
