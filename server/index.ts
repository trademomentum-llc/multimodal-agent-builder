import './otel';
<<<<<<< HEAD
import express, { type Request, Response, NextFunction } from 'express';
=======
import express, { type Request, Response, NextFunction, Express } from 'express';
>>>>>>> 9b0476f (Staged and commited updates to npm modules fixing vulnerabilities)
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { securityMiddleware, cspWithNonce } from './middleware/security';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Security headers and CSP via Helmet + per-request nonce
app.use(cspWithNonce());
app.use(securityMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get('env') === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen(
<<<<<<< HEAD
    {
=======
    { // @ts-ignore: Property 'listen' does not exist on type 'void'.
>>>>>>> 9b0476f (Staged and commited updates to npm modules fixing vulnerabilities)
      port,
      host: '0.0.0.0',
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
<<<<<<< HEAD
=======

export async function registerRoutes(app: Express): Promise<Express> {
  // Define your API routes here.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  return app;
}
>>>>>>> 9b0476f (Staged and commited updates to npm modules fixing vulnerabilities)
