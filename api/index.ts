import { app, setupPromise } from '../server';

export default async (req: any, res: any) => {
  // Ensure the app is fully initialized (all app.use and app.get calls done)
  // before handling any serverless request on Vercel.
  await setupPromise;
  return app(req, res);
};
