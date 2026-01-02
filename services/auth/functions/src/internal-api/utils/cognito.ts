import { createHmac } from 'crypto';

/**
 * Calculate SECRET_HASH for Cognito client authentication
 *
 * AWS Cognito requires a secret hash when using a client secret.
 * This is calculated as: Base64(HMAC_SHA256(Username + ClientId, ClientSecret))
 *
 * @param username - The username (email) for authentication
 * @param clientId - Cognito User Pool Client ID
 * @param clientSecret - Cognito User Pool Client Secret
 * @returns Base64-encoded HMAC-SHA256 hash
 */
export function calculateSecretHash(
  username: string,
  clientId: string,
  clientSecret: string
): string {
  const message = username + clientId;
  const hmac = createHmac('sha256', clientSecret);
  hmac.update(message);
  return hmac.digest('base64');
}
