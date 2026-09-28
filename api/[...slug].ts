import app from './_app';

export default (req: any, res: any) => {
  console.log('Slug handler - URL:', req.url);
  return app(req, res);
};
