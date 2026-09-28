import app from './_app';

export default (req: any, res: any) => {
  req.url = req.url.replace(/^\/api/, '') || '/';
  return app(req, res);
};
