let app;
let bootError = null;

try {
  const module = await import('../backend/server.js');
  app = module.default;
} catch (err) {
  bootError = err;
}

export default async function handler(req, res) {
  if (bootError) {
    return res.status(500).json({
      error: 'Boot Error',
      message: bootError.message,
      stack: bootError.stack
    });
  }
  
  try {
    return app(req, res);
  } catch (err) {
    return res.status(500).json({
      error: 'Runtime Error',
      message: err.message,
      stack: err.stack
    });
  }
}
