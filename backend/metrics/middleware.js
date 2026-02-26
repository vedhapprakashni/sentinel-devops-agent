const { metrics } = require('./prometheus');

function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const path = req.route?.path || req.path;
    
    // Skip metrics endpoint to avoid recursion
    if (path === '/metrics') return;
    
    metrics.httpRequestsTotal.inc({
      method: req.method,
      path: path,
      status: res.statusCode
    });
    
    metrics.httpRequestDuration.observe(
      { method: req.method, path: path },
      duration
    );
  });
  
  next();
}

module.exports = { metricsMiddleware };
