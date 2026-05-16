import { app } from '../server';

export default async (req: any, res: any) => {
  // The app exported from server.ts will be initialized when the module is loaded
  // if we call setupApp() at the top level or export a promise.
  return app(req, res);
};
