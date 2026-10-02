import * as oidc from 'openid-client';
import { authConfig } from './config.js';
import { AppError } from '../utils/app-error.js';

let configuration;
async function config() {
  if (!authConfig.clientId || !authConfig.clientSecret) throw new AppError(503, 'AUTH_NOT_CONFIGURED', 'Google login has not been configured.');
  configuration ??= oidc.discovery(new URL('https://accounts.google.com'), authConfig.clientId, authConfig.clientSecret, undefined, { execute: [oidc.enableNonRepudiationChecks] })
    .catch((error) => { configuration = undefined; throw error; });
  return configuration;
}
// Only this adapter exchanges provider tokens. No tokens are persisted or returned to the browser.
export const googleProvider = {
  async authorization(transaction) {
    return oidc.buildAuthorizationUrl(await config(), {
      redirect_uri: authConfig.callback, scope: 'openid email profile',
      state: transaction.state, nonce: transaction.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(transaction.verifier), code_challenge_method: 'S256',
    }).href;
  },
  async identity(url, transaction) {
    const tokens = await oidc.authorizationCodeGrant(await config(), url, {
      expectedState: transaction.state, expectedNonce: transaction.nonce,
      pkceCodeVerifier: transaction.verifier, idTokenExpected: true,
    });
    return tokens.claims();
  },
};
export function oauthTransaction() {
  return { state: oidc.randomState(), nonce: oidc.randomNonce(), verifier: oidc.randomPKCECodeVerifier(), createdAt: Date.now() };
}
