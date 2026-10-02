import { Router } from 'express';
import { promisify } from 'node:util';
import { authConfig, cookieOptions } from './config.js';
import { googleProvider, oauthTransaction } from './google.js';
import { linkGoogleUser } from './user.js';
import { requireAuth, requireCsrf, csrfToken } from './middleware.js';

const sessionAction = (req, action) => promisify(req.session[action]).call(req.session);
export function authRouter(provider = googleProvider) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/me', requireAuth, (req, res) => res.json({ success: true, data: req.user }));
  router.get('/csrf', requireAuth, (req, res) => res.json({ success: true, data: { token: csrfToken(req) } }));
  router.get('/google', async (req, res) => {
    try {
      const transaction = oauthTransaction();
      const location = await provider.authorization(transaction);
      req.session.oauth = transaction;
      await sessionAction(req, 'save');
      res.redirect(location);
    } catch {
      res.redirect(`${authConfig.origin}/login?error=unavailable`);
    }
  });
  router.get('/google/callback', async (req, res) => {
    const transaction = req.session.oauth;
    delete req.session.oauth;
    // Consume the transaction before exchanging the code (including failed/cancelled attempts).
    await sessionAction(req, 'save');
    try {
      const url = new URL(authConfig.callback);
      url.search = new URL(req.originalUrl, authConfig.origin).search;
      if (!transaction || Date.now() - transaction.createdAt > 10 * 60 * 1000
        || url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== transaction.state) throw new Error('Invalid OAuth transaction');
      const user = await linkGoogleUser(await provider.identity(url, transaction));
      await sessionAction(req, 'regenerate');
      req.session.userId = user.id;
      req.session.authenticatedAt = Date.now();
      csrfToken(req);
      await sessionAction(req, 'save');
      res.redirect(`${authConfig.origin}/dashboard`);
    } catch {
      res.redirect(`${authConfig.origin}/login?error=failed`);
    }
  });
  router.post('/logout', requireAuth, requireCsrf, async (req, res) => {
    await sessionAction(req, 'destroy');
    res.clearCookie(authConfig.cookieName, cookieOptions);
    res.json({ success: true, data: null });
  });
  return router;
}
