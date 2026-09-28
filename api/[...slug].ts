import app from './_app';

export default (req: any, res: any) => {
  console.log('=== SLUG HANDLER ===');
  console.log('Original URL:', req.url);
  console.log('Method:', req.method);

  req.url = req.url.replace(/^\/api/, '') || '/';

  console.log('Rewritten URL:', req.url);

  return app(req, res);
};
