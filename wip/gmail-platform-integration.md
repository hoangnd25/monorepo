# Gmail Platform Integration Guide

> **Status**: Research - Feasibility Analysis
> **Last Updated**: 2026-01-10
> **Related**: [Conversations Service Architecture](./conversations-service-architecture.md)

## Executive Summary

**Gmail integration is technically feasible** and fits well within the existing Conversations Service architecture. The Gmail API provides:

- Push notifications via Google Cloud Pub/Sub (similar to our existing SQS pattern)
- Full read/write access to mailboxes via RESTful API
- OAuth 2.0 for user authorization
- Threading support for conversation grouping

However, there are **significant differences** from messaging platforms (Meta, WhatsApp, Zalo) that require architectural consideration.

---

## Integration Overview

### How Gmail API Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GMAIL API FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐       │
│   │  User Gmail  │◄───────►│  Gmail API   │◄───────►│ Our Service  │       │
│   │   Mailbox    │         │  (Google)    │         │              │       │
│   └──────────────┘         └──────┬───────┘         └──────────────┘       │
│                                   │                                         │
│                                   │ Push Notifications                      │
│                                   ▼                                         │
│                          ┌──────────────┐                                   │
│                          │ Cloud Pub/Sub│───────► Webhook/Pull              │
│                          │   (Google)   │                                   │
│                          └──────────────┘                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key API Capabilities

| Feature            | Supported | Notes                                        |
| ------------------ | --------- | -------------------------------------------- |
| Read emails        | Yes       | Full message content, headers, attachments   |
| Send emails        | Yes       | As the connected user                        |
| Push notifications | Yes       | Via Cloud Pub/Sub (requires GCP project)     |
| Email threading    | Yes       | Native thread support via `threadId`         |
| Labels/folders     | Yes       | System labels (INBOX, SENT) + custom labels  |
| Attachments        | Yes       | Up to 25MB per message (35MB for upload API) |
| Search/filtering   | Yes       | Gmail search syntax supported                |
| Personal accounts  | Yes       | Works with @gmail.com accounts               |
| Workspace accounts | Yes       | Works with Google Workspace (G Suite)        |

---

## Authentication & Authorization

### OAuth 2.0 Flow

Gmail uses standard OAuth 2.0 for authorization:

```
1. Tenant initiates connection in main-ui
                     │
                     ▼
2. Redirect to Google OAuth consent screen
   (shows requested scopes, app name)
                     │
                     ▼
3. User grants permission
                     │
                     ▼
4. Google redirects back with authorization code
                     │
                     ▼
5. Exchange code for access token + refresh token
                     │
                     ▼
6. Store encrypted tokens in Channel record
```

### Required Scopes

For the Conversations Service use case, we need:

| Scope                                            | Type       | Purpose                          |
| ------------------------------------------------ | ---------- | -------------------------------- |
| `https://www.googleapis.com/auth/gmail.readonly` | Restricted | Read emails and metadata         |
| `https://www.googleapis.com/auth/gmail.send`     | Sensitive  | Send emails on behalf of user    |
| `https://www.googleapis.com/auth/gmail.modify`   | Restricted | Mark as read, apply labels, etc. |

**Important**: Restricted scopes require:

1. OAuth verification by Google
2. Security assessment (if storing data on servers)
3. Privacy policy and terms of service

### Token Management

#### What Credentials to Store

```typescript
interface GmailChannel {
  tenantId: string;
  channelId: string;
  platform: 'gmail';
  platformId: string; // User's email address
  email: string; // Same as platformId for Gmail
  accessToken: string; // Encrypted (KMS) - max 2048 bytes
  refreshToken: string; // Encrypted (KMS) - max 512 bytes
  tokenExpiresAt: number; // Access token expiration (Unix timestamp ms)
  tokenScope: string; // Granted scopes (space-separated)
  historyId: string; // For incremental sync
  watchExpiration: number; // Pub/Sub watch expiration (max 7 days)
  status: 'active' | 'disconnected' | 'reauth_required' | 'error';
  lastTokenRefresh: number; // Last successful refresh timestamp
  connectionCreatedAt: number; // When user first connected
}
```

#### Token Validity & Lifecycle

| Token Type    | Max Size   | Validity           | Refresh Mechanism                       |
| ------------- | ---------- | ------------------ | --------------------------------------- |
| Access Token  | 2048 bytes | ~1 hour (3600 sec) | Use refresh token to get new one        |
| Refresh Token | 512 bytes  | Long-lived\*       | Re-obtain via full OAuth flow if needed |

**\*Refresh Token Expiration Scenarios**:

Refresh tokens can become invalid in these situations:

1. **User revokes access** - User removes app from their Google Account settings
2. **Unused for 6 months** - Token expires if not used to refresh for 6 months
3. **Password change** - If app uses Gmail scopes and user changes their Google password
4. **Token limit exceeded** - Max 100 refresh tokens per Google Account per OAuth client ID (oldest revoked when exceeded)
5. **Admin restriction** - Google Workspace admin restricts app's scopes for the organization
6. **Time-based access expired** - If user granted time-limited access
7. **App in Testing mode** - Tokens expire in **7 days** if app publishing status is "Testing" (not production)

#### OAuth Connection Flow (Detailed)

```typescript
// Step 1: Generate authorization URL
function getGmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/oauth/gmail/callback`,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ].join(' '),
    access_type: 'offline', // REQUIRED to get refresh token
    prompt: 'consent', // Force consent to always get refresh token
    include_granted_scopes: 'true', // For incremental authorization
    state: state, // CSRF protection + tenant context
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Step 2: Exchange authorization code for tokens
async function exchangeCodeForTokens(code: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: `${APP_URL}/api/oauth/gmail/callback`,
    }),
  });

  const tokens = await response.json();
  // Response:
  // {
  //   access_token: "ya29.xxx...",
  //   expires_in: 3600, // seconds
  //   refresh_token: "1//xxx...", // Only on first authorization!
  //   scope: "https://www.googleapis.com/auth/gmail.readonly ...",
  //   token_type: "Bearer"
  // }

  return tokens;
}

// Step 3: Get user's email address
async function getGmailUserProfile(accessToken: string) {
  const response = await fetch(
    'https://www.googleapis.com/gmail/v1/users/me/profile',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const profile = await response.json();
  // { emailAddress: "user@example.com", messagesTotal: 12345, ... }
  return profile;
}
```

#### Token Refresh Strategy

```typescript
// Proactive refresh - call before making Gmail API requests
async function ensureValidAccessToken(channel: GmailChannel): Promise<string> {
  const now = Date.now();
  const expiresAt = channel.tokenExpiresAt;
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer

  // Refresh if token expires within 5 minutes
  if (expiresAt - now < bufferMs) {
    return await refreshAccessToken(channel);
  }

  return channel.accessToken;
}

async function refreshAccessToken(channel: GmailChannel): Promise<string> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: channel.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      // Handle specific error cases
      if (error.error === 'invalid_grant') {
        // Refresh token is invalid/revoked - need re-authorization
        await markChannelForReauth(channel.channelId);
        throw new RefreshTokenRevokedError(channel.email);
      }
      throw new TokenRefreshError(error.error_description);
    }

    const tokens = await response.json();
    // Note: refresh_token is NOT included in refresh response
    // (unless Google rotates it, which is rare)

    // Update stored tokens
    await updateChannelTokens(channel.channelId, {
      accessToken: tokens.access_token,
      tokenExpiresAt: now + tokens.expires_in * 1000,
      lastTokenRefresh: now,
    });

    return tokens.access_token;
  } catch (error) {
    if (error instanceof RefreshTokenRevokedError) {
      throw error;
    }
    // Log and handle other errors
    console.error('Token refresh failed:', error);
    throw error;
  }
}
```

#### Handling Token Revocation

```typescript
// Error types for OAuth issues
class RefreshTokenRevokedError extends Error {
  constructor(public email: string) {
    super(`Refresh token revoked for ${email}. Re-authorization required.`);
    this.name = 'RefreshTokenRevokedError';
  }
}

// Mark channel as needing re-authorization
async function markChannelForReauth(channelId: string) {
  await updateChannel(channelId, {
    status: 'reauth_required',
    accessToken: '', // Clear invalid tokens
    // Keep refreshToken for audit trail, but it's no longer valid
  });

  // Notify tenant that reconnection is needed
  await notifyTenantReauthRequired(channelId);
}

// Scheduled job to check token health
async function checkGmailTokenHealth() {
  const channels = await getActiveGmailChannels();

  for (const channel of channels) {
    try {
      // Try to refresh token proactively
      await refreshAccessToken(channel);
    } catch (error) {
      if (error instanceof RefreshTokenRevokedError) {
        // Already handled in refreshAccessToken
        continue;
      }
      // Log other errors for investigation
      console.error(`Token health check failed for ${channel.email}:`, error);
    }
  }
}
```

#### Re-Authorization Flow

When a user needs to re-authorize (after token revocation):

```typescript
// Generate re-auth URL - same as initial auth but with login_hint
function getGmailReauthUrl(email: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/oauth/gmail/callback`,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // Force consent to get new refresh token
    login_hint: email, // Pre-fill email for smoother UX
    state: state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
```

#### Security: Credential Storage

All tokens must be encrypted at rest:

```typescript
// Use AWS KMS for encryption
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kms = new KMSClient({});
const KMS_KEY_ID = process.env.KMS_KEY_ID;

async function encryptToken(plaintext: string): Promise<string> {
  const command = new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext),
  });
  const response = await kms.send(command);
  return Buffer.from(response.CiphertextBlob!).toString('base64');
}

async function decryptToken(ciphertext: string): Promise<string> {
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext, 'base64'),
  });
  const response = await kms.send(command);
  return Buffer.from(response.Plaintext!).toString('utf-8');
}
```

#### Testing vs Production Mode

| Aspect              | Testing Mode        | Production Mode                      |
| ------------------- | ------------------- | ------------------------------------ |
| User cap            | 100 users max       | Unlimited                            |
| Refresh token life  | **7 days**          | Long-lived (until revoked)           |
| Verification needed | No                  | Yes (required for restricted scopes) |
| Use case            | Development/staging | Production                           |

**Important**: Move to Production publishing status before launch to avoid 7-day token expiration.

---

## Push Notifications (Webhooks)

### Architecture with Cloud Pub/Sub

Gmail push notifications use **Google Cloud Pub/Sub** (not direct webhooks like Meta/WhatsApp):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PUSH NOTIFICATION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Gmail Mailbox Change                                                      │
│         │                                                                   │
│         ▼                                                                   │
│   Gmail API notifies Cloud Pub/Sub topic                                    │
│   (gmail-api-push@system.gserviceaccount.com publishes)                     │
│         │                                                                   │
│         ▼                                                                   │
│   Cloud Pub/Sub delivers to:                                                │
│   ├─ Push (webhook to our endpoint)  ◄─── Recommended                       │
│   └─ Pull (we poll the subscription)                                        │
│         │                                                                   │
│         ▼                                                                   │
│   Our webhook receives:                                                     │
│   - HTTP POST with JSON body                                                │
│   - Authorization header with JWT (if auth enabled)                         │
│   - Base64-encoded notification data                                        │
│         │                                                                   │
│         ▼                                                                   │
│   Call history.list API to get actual message changes                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cloud Pub/Sub Setup (One-Time Infrastructure)

#### Step 1: Create Pub/Sub Topic

```bash
# Create the topic
gcloud pubsub topics create gmail-notifications

# Grant Gmail API permission to publish to the topic
# CRITICAL: This service account is Google-managed, don't create it
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

#### Step 2: Create Push Subscription

```bash
# Create a service account for webhook authentication
gcloud iam service-accounts create gmail-webhook-sa \
  --display-name="Gmail Webhook Service Account"

# Get your project number for IAM binding
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Grant Pub/Sub service agent permission to create tokens
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"

# Create push subscription with authentication
gcloud pubsub subscriptions create gmail-push-subscription \
  --topic=gmail-notifications \
  --push-endpoint=https://api.yourdomain.com/webhooks/gmail \
  --ack-deadline=60 \
  --message-retention-duration=7d \
  --push-auth-service-account=gmail-webhook-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --push-auth-token-audience=https://api.yourdomain.com \
  --min-retry-delay=10s \
  --max-retry-delay=600s
```

#### Webhook Endpoint Requirements

| Requirement          | Details                                                |
| -------------------- | ------------------------------------------------------ |
| Protocol             | HTTPS only (HTTP not supported)                        |
| SSL Certificate      | Valid certificate signed by a CA (not self-signed)     |
| Public accessibility | Must be reachable from Google's servers                |
| Response time        | Return 2xx within ack-deadline (default 10s, max 600s) |

### Setting Up Watch (Per User)

When a user connects their Gmail account, call the Watch API to start receiving notifications:

```typescript
interface WatchRequest {
  topicName: string; // projects/{project}/topics/{topic}
  labelIds?: string[]; // Filter by labels
  labelFilterBehavior?: 'INCLUDE' | 'EXCLUDE';
}

interface WatchResponse {
  historyId: string; // Starting point for history.list
  expiration: string; // Unix timestamp (ms) - max 7 days
}

async function setupGmailWatch(
  accessToken: string,
  topicName: string
): Promise<WatchResponse> {
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/watch',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName,
        labelIds: ['INBOX'], // Only watch inbox
        labelFilterBehavior: 'INCLUDE',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Watch setup failed: ${error.error.message}`);
  }

  return response.json();
}

// Store the historyId and expiration in the channel record
await updateChannel(channelId, {
  historyId: watchResponse.historyId,
  watchExpiration: parseInt(watchResponse.expiration),
});
```

**Watch Constraints**:

| Constraint         | Value                                                 |
| ------------------ | ----------------------------------------------------- |
| Maximum expiration | 7 days from creation                                  |
| Renewal frequency  | Recommended: daily                                    |
| Required scope     | `gmail.readonly`, `gmail.modify`, or `gmail.metadata` |
| Rate limit         | Max 1 notification/second per user (excess dropped)   |

**Common Label IDs**:

| Label ID    | Description        |
| ----------- | ------------------ |
| `INBOX`     | Inbox messages     |
| `UNREAD`    | Unread messages    |
| `STARRED`   | Starred messages   |
| `IMPORTANT` | Important messages |
| `SENT`      | Sent messages      |
| `DRAFT`     | Draft messages     |
| `SPAM`      | Spam messages      |
| `TRASH`     | Trash messages     |

### Webhook Payload Structure

When a mailbox change occurs, Pub/Sub sends an HTTP POST to your endpoint:

```http
POST https://api.yourdomain.com/webhooks/gmail HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...  # JWT token (if auth enabled)

{
  "message": {
    "data": "eyJlbWFpbEFkZHJlc3MiOiAidXNlckBleGFtcGxlLmNvbSIsICJoaXN0b3J5SWQiOiAiOTg3NjU0MzIxMCJ9",
    "messageId": "2070443601311540",
    "message_id": "2070443601311540",
    "publishTime": "2026-01-10T19:13:55.749Z",
    "publish_time": "2026-01-10T19:13:55.749Z",
    "attributes": {}
  },
  "subscription": "projects/your-project/subscriptions/gmail-push-subscription"
}
```

**Decoded `message.data`** (base64 → JSON):

```json
{
  "emailAddress": "user@example.com",
  "historyId": "9876543210"
}
```

| Field          | Description                                             |
| -------------- | ------------------------------------------------------- |
| `emailAddress` | Email address of the user whose mailbox changed         |
| `historyId`    | New history ID - use with `history.list` to get changes |

### Webhook Authentication (JWT Verification)

**Critical**: Always verify the JWT token to ensure requests are from Google.

#### JWT Token Structure

```json
// Header
{
  "alg": "RS256",
  "kid": "7d680d8c70d44e947133cbd499ebc1a61c3d5abc",
  "typ": "JWT"
}

// Payload (Claims)
{
  "aud": "https://api.yourdomain.com",           // Your configured audience
  "azp": "113774264463038321964",
  "email": "gmail-webhook-sa@project.iam.gserviceaccount.com",
  "email_verified": true,
  "exp": 1550185935,                              // Expiration (Unix timestamp)
  "iat": 1550182335,                              // Issued at
  "iss": "https://accounts.google.com",           // Issuer
  "sub": "113774264463038321964"
}
```

**Note**: Tokens can be up to **1 hour old** - don't reject based on `iat`.

#### Verification Implementation

```typescript
import { OAuth2Client } from 'google-auth-library';

const authClient = new OAuth2Client();

// Environment configuration
const WEBHOOK_AUDIENCE = process.env.WEBHOOK_AUDIENCE; // https://api.yourdomain.com
const PUBSUB_SERVICE_ACCOUNT = process.env.PUBSUB_SERVICE_ACCOUNT; // gmail-webhook-sa@project.iam.gserviceaccount.com

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailNotification {
  emailAddress: string;
  historyId: string;
}

async function verifyPubSubToken(authHeader: string): Promise<void> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new WebhookAuthError('Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const ticket = await authClient.verifyIdToken({
      idToken: token,
      audience: WEBHOOK_AUDIENCE,
    });

    const payload = ticket.getPayload();

    // Validate required claims
    if (!payload) {
      throw new WebhookAuthError('Invalid token payload');
    }

    // 1. Verify service account email
    if (payload.email !== PUBSUB_SERVICE_ACCOUNT) {
      throw new WebhookAuthError(
        `Unexpected service account: ${payload.email}`
      );
    }

    // 2. Verify email is verified
    if (!payload.email_verified) {
      throw new WebhookAuthError('Service account email not verified');
    }

    // 3. Verify issuer
    const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
    if (!validIssuers.includes(payload.iss || '')) {
      throw new WebhookAuthError(`Invalid issuer: ${payload.iss}`);
    }
  } catch (error) {
    if (error instanceof WebhookAuthError) {
      throw error;
    }
    throw new WebhookAuthError(`Token verification failed: ${error.message}`);
  }
}

class WebhookAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookAuthError';
  }
}
```

#### Offline Verification (High Volume)

For high-volume scenarios, verify tokens offline using Google's public certificates:

```typescript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours - certificates rotate infrequently
});

function getSigningKey(
  header: jwt.JwtHeader,
  callback: jwt.SigningKeyCallback
): void {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

async function verifyTokenOffline(token: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        audience: WEBHOOK_AUDIENCE,
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
      },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded as jwt.JwtPayload);
      }
    );
  });
}
```

### Complete Webhook Handler

```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // 1. Verify JWT token
    const authHeader =
      event.headers['Authorization'] || event.headers['authorization'];
    await verifyPubSubToken(authHeader);

    // 2. Parse and decode the notification
    const body: PubSubMessage = JSON.parse(event.body || '{}');
    const decodedData = Buffer.from(body.message.data, 'base64').toString(
      'utf-8'
    );
    const notification: GmailNotification = JSON.parse(decodedData);

    console.log('Gmail notification received:', {
      email: notification.emailAddress,
      historyId: notification.historyId,
      messageId: body.message.messageId,
    });

    // 3. Look up the channel by email address
    const channel = await getChannelByEmail(notification.emailAddress);
    if (!channel) {
      console.warn(`No channel found for email: ${notification.emailAddress}`);
      // Still return 200 to acknowledge - don't want retries for unknown users
      return { statusCode: 200, body: 'OK' };
    }

    // 4. Queue for async processing (don't block the webhook)
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: GMAIL_PROCESSING_QUEUE_URL,
        MessageBody: JSON.stringify({
          channelId: channel.channelId,
          tenantId: channel.tenantId,
          emailAddress: notification.emailAddress,
          newHistoryId: notification.historyId,
          previousHistoryId: channel.historyId,
        }),
      })
    );

    // 5. Acknowledge the notification
    // Return 2xx to prevent redelivery
    return {
      statusCode: 200,
      body: 'OK',
    };
  } catch (error) {
    if (error instanceof WebhookAuthError) {
      console.error('Webhook authentication failed:', error.message);
      return {
        statusCode: 403,
        body: 'Forbidden',
      };
    }

    console.error('Webhook processing error:', error);
    // Return 500 to trigger Pub/Sub retry
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
  }
};
```

### Processing Gmail Notifications (SQS Consumer)

```typescript
async function processGmailNotification(message: GmailNotificationMessage) {
  const { channelId, emailAddress, newHistoryId, previousHistoryId } = message;

  // 1. Get channel and ensure valid access token
  const channel = await getChannel(channelId);
  const accessToken = await ensureValidAccessToken(channel);

  // 2. Fetch history changes since last known historyId
  const historyResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/history?` +
      new URLSearchParams({
        startHistoryId: previousHistoryId,
        historyTypes: 'messageAdded',
        labelId: 'INBOX',
      }),
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!historyResponse.ok) {
    const error = await historyResponse.json();

    // Handle historyId too old (need full sync)
    if (error.error.code === 404) {
      console.warn('History ID expired, triggering full sync');
      await triggerFullSync(channel);
      return;
    }

    throw new Error(`History fetch failed: ${error.error.message}`);
  }

  const history = await historyResponse.json();

  // 3. Process new messages
  if (history.history) {
    for (const record of history.history) {
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          // Only process messages in INBOX (filter out sent, etc.)
          if (added.message.labelIds?.includes('INBOX')) {
            await processNewInboxMessage(
              channel,
              added.message.id,
              accessToken
            );
          }
        }
      }
    }
  }

  // 4. Update the stored historyId
  await updateChannelHistoryId(channelId, newHistoryId);
}

async function processNewInboxMessage(
  channel: GmailChannel,
  messageId: string,
  accessToken: string
) {
  // Fetch full message details
  const messageResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const message = await messageResponse.json();

  // Extract headers
  const headers = message.payload.headers.reduce(
    (acc: Record<string, string>, h: { name: string; value: string }) => {
      acc[h.name.toLowerCase()] = h.value;
      return acc;
    },
    {}
  );

  // Create or update conversation based on threadId
  const conversation = await findOrCreateConversation({
    channelId: channel.channelId,
    tenantId: channel.tenantId,
    platformThreadId: message.threadId,
    participantEmail: headers.from,
    subject: headers.subject,
  });

  // Store the message
  await createMessage({
    conversationId: conversation.conversationId,
    platformMsgId: messageId,
    gmailThreadId: message.threadId,
    direction: 'inbound',
    from: headers.from,
    to: headers.to?.split(',').map((e: string) => e.trim()),
    subject: headers.subject,
    textBody: extractTextBody(message.payload),
    htmlBody: extractHtmlBody(message.payload),
    receivedAt: new Date(parseInt(message.internalDate)),
  });

  // Notify tenant of new message (websocket, etc.)
  await notifyNewMessage(conversation, message);
}
```

### Acknowledgment Behavior

| HTTP Status Code                  | Pub/Sub Behavior                          |
| --------------------------------- | ----------------------------------------- |
| `102`, `200`, `201`, `202`, `204` | Message acknowledged, won't redeliver     |
| Any other status                  | Negative ack, message will be redelivered |
| Timeout                           | Negative ack, message will be redelivered |

**Retry Policy**:

- Exponential backoff: 100ms to 60 seconds
- Configurable min/max retry delay
- Messages retained for `message-retention-duration` (default 7 days)

### Watch Renewal (Scheduled Job)

```typescript
// Lambda scheduled to run every 12 hours
export const renewGmailWatchesHandler = async () => {
  const channels = await getActiveGmailChannels();
  const now = Date.now();
  const renewalThreshold = 24 * 60 * 60 * 1000; // 24 hours

  for (const channel of channels) {
    try {
      // Renew if expiring within 24 hours
      if (channel.watchExpiration - now < renewalThreshold) {
        const accessToken = await ensureValidAccessToken(channel);

        const response = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/watch',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              topicName: channel.pubsubTopic,
              labelIds: ['INBOX'],
              labelFilterBehavior: 'INCLUDE',
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          console.error(`Watch renewal failed for ${channel.email}:`, error);

          // If token is invalid, mark channel for reauth
          if (error.error.code === 401) {
            await markChannelForReauth(channel.channelId);
          }
          continue;
        }

        const watchData = await response.json();

        await updateChannel(channel.channelId, {
          historyId: watchData.historyId,
          watchExpiration: parseInt(watchData.expiration),
        });

        console.log(
          `Watch renewed for ${channel.email}, expires: ${watchData.expiration}`
        );
      }
    } catch (error) {
      console.error(`Watch renewal error for ${channel.email}:`, error);
    }
  }
};
```

### Stopping a Watch (Channel Disconnect)

```typescript
async function disconnectGmailChannel(channelId: string) {
  const channel = await getChannel(channelId);

  try {
    const accessToken = await ensureValidAccessToken(channel);

    // Stop the watch
    await fetch('https://gmail.googleapis.com/gmail/v1/users/me/stop', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    // Log but don't fail - watch will expire anyway
    console.warn(`Failed to stop watch for ${channel.email}:`, error);
  }

  // Update channel status
  await updateChannel(channelId, {
    status: 'disconnected',
    accessToken: '',
    refreshToken: '', // Clear tokens on disconnect
  });
}
```

### Reliability Considerations

| Issue                        | Mitigation                                         |
| ---------------------------- | -------------------------------------------------- |
| Notifications can be delayed | Implement fallback polling every 5-10 minutes      |
| Notifications can be dropped | Track historyId gaps, trigger sync if gap detected |
| Rate limit (1/sec/user)      | Expect batched changes in single notification      |
| historyId expires            | If 404 error, trigger full sync                    |
| Duplicate notifications      | Use messageId for idempotency                      |

### Fallback Polling (Optional)

```typescript
// Lambda scheduled to run every 10 minutes
export const gmailFallbackSyncHandler = async () => {
  const channels = await getActiveGmailChannels();
  const now = Date.now();
  const staleThreshold = 15 * 60 * 1000; // 15 minutes

  for (const channel of channels) {
    // Only sync channels that haven't received notifications recently
    if (now - channel.lastNotificationAt > staleThreshold) {
      try {
        await syncChannelHistory(channel);
      } catch (error) {
        console.error(`Fallback sync failed for ${channel.email}:`, error);
      }
    }
  }
};
```

---

## Key Differences from Messaging Platforms

### Comparison Table

| Aspect                   | Messaging (Meta/WhatsApp/Zalo) | Gmail                               |
| ------------------------ | ------------------------------ | ----------------------------------- |
| **Notification type**    | Direct webhook                 | Cloud Pub/Sub (indirect)            |
| **Notification content** | Full message payload           | Only historyId (must fetch details) |
| **User identity**        | Platform-scoped ID (PSID)      | Email address (PII)                 |
| **Messaging window**     | 24h-7d limit                   | None - can reply anytime            |
| **Two-way requirement**  | Customer must initiate         | Can send unsolicited (cold email)   |
| **Threading**            | Platform-managed               | RFC 2822 headers + Gmail threadId   |
| **Real-time**            | Near real-time (~seconds)      | Usually seconds, can be delayed     |
| **Webhook signature**    | Platform-specific HMAC         | Cloud Pub/Sub message auth          |
| **Watch renewal**        | Not required                   | Required every 7 days               |

### Architectural Implications

1. **Additional GCP Dependency**: Requires Google Cloud Pub/Sub topic and subscription
2. **Two-Step Notification**: Notification → API call to get details (more API calls)
3. **Watch Renewal Job**: Need scheduled job to renew watch before expiration
4. **History Sync**: Must track `historyId` per channel for incremental sync
5. **No Messaging Window**: Can reply anytime, but spam considerations apply

---

## Data Model Extensions

### Channel Entity

```typescript
interface GmailChannel extends BaseChannel {
  platform: 'gmail';
  platformId: string; // User's email address
  email: string; // User's email address

  // OAuth Credentials (all encrypted with KMS)
  accessToken: string; // Encrypted - max 2048 bytes
  refreshToken: string; // Encrypted - max 512 bytes
  tokenExpiresAt: number; // Access token expiration (Unix timestamp ms)
  tokenScope: string; // Granted scopes (space-separated)
  lastTokenRefresh: number; // Last successful refresh timestamp

  // Gmail-specific
  historyId: string; // Last processed history ID for incremental sync
  watchExpiration: number; // Pub/Sub watch expiration timestamp
  pubsubTopic: string; // Cloud Pub/Sub topic name

  // Status tracking
  status: 'active' | 'disconnected' | 'reauth_required' | 'error';
  connectionCreatedAt: number; // When user first connected
  lastError?: string; // Last error message if status is 'error'
}
```

**Status Values**:

| Status            | Meaning                                               | Action                   |
| ----------------- | ----------------------------------------------------- | ------------------------ |
| `active`          | Channel is working normally                           | None                     |
| `disconnected`    | User manually disconnected                            | Show reconnect option    |
| `reauth_required` | Refresh token expired/revoked, needs re-authorization | Prompt user to reconnect |
| `error`           | Unexpected error occurred                             | Check `lastError`, retry |

### Conversation Entity

```typescript
interface GmailConversation extends BaseConversation {
  platform: 'gmail';
  platformThreadId: string; // Gmail thread ID
  participantId: string; // Email address of correspondent
  participantIdType: 'email'; // Always 'email' for Gmail (PII)
  subject: string; // Email subject line
  // No lastCustomerMessageAt - no messaging window concept
}
```

### Message Entity

```typescript
interface GmailMessage extends BaseMessage {
  platformMsgId: string; // Gmail message ID
  gmailThreadId: string; // For threading
  subject: string; // Email subject
  from: string; // From address
  to: string[]; // To addresses
  cc?: string[]; // CC addresses
  bcc?: string[]; // BCC addresses (outbound only)
  replyTo?: string; // Reply-To header
  inReplyTo?: string; // In-Reply-To header (for threading)
  references?: string[]; // References header (for threading)
  htmlBody?: string; // HTML content
  textBody?: string; // Plain text content
  attachments?: GmailAttachment[];
}

interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  s3Key?: string; // If downloaded to S3
}
```

---

## Implementation Considerations

> **Note**: Detailed webhook setup, JWT verification, watch management, and notification processing are covered in the [Push Notifications (Webhooks)](#push-notifications-webhooks) section above.

### Sending Emails

```typescript
async function sendGmailReply(
  channel: GmailChannel,
  conversation: GmailConversation,
  content: string,
  attachments?: Attachment[]
) {
  // Create MIME message with proper threading headers
  const mimeMessage = createMimeMessage({
    from: channel.email,
    to: conversation.participantId,
    subject: `Re: ${conversation.subject}`,
    inReplyTo: conversation.lastMessageId,
    references: conversation.references,
    body: content,
    attachments,
  });

  // Base64url encode
  const raw = Buffer.from(mimeMessage).toString('base64url');

  // Send via Gmail API
  const response = await gmailApi.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: conversation.platformThreadId,
    },
  });

  return response.data;
}
```

---

## OAuth Verification Requirements

### For Production Use

1. **App Verification**: Required for apps accessing user data
2. **Security Assessment**: Required for restricted scopes (`gmail.readonly`, `gmail.modify`)
3. **Privacy Policy**: Must be published and accessible
4. **Terms of Service**: Must be published and accessible
5. **Limited User Cap**: 100 users until verified

### Verification Process

1. Submit app for verification in Google Cloud Console
2. Demonstrate legitimate use case
3. Complete security assessment (if using restricted scopes)
4. Timeline: 4-8 weeks typically

### Service Account Alternative (Google Workspace Only)

For enterprise customers using **Google Workspace** (formerly G Suite), there's an alternative to per-user OAuth: **Domain-Wide Delegation**.

#### How It Works

Instead of each user authorizing via OAuth, a Workspace admin grants our service account access to all users in their domain.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DOMAIN-WIDE DELEGATION FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. We create a Service Account in our GCP project                         │
│                      │                                                      │
│                      ▼                                                      │
│   2. Workspace Admin adds Service Account client ID                         │
│      to domain-wide delegation settings with Gmail scopes                   │
│                      │                                                      │
│                      ▼                                                      │
│   3. Our service can now impersonate any user in that domain                │
│      (no per-user OAuth consent needed)                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Implementation

```typescript
import { google } from 'googleapis';

// Service account credentials (stored securely)
const SERVICE_ACCOUNT_KEY = {
  client_email: 'gmail-access@our-project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
};

// Impersonate a specific user
async function getGmailClientForUser(userEmail: string) {
  const auth = new google.auth.JWT({
    email: SERVICE_ACCOUNT_KEY.client_email,
    key: SERVICE_ACCOUNT_KEY.private_key,
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    subject: userEmail, // Impersonate this user
  });

  return google.gmail({ version: 'v1', auth });
}

// Usage
const gmail = await getGmailClientForUser('employee@customer-domain.com');
const messages = await gmail.users.messages.list({ userId: 'me' });
```

#### Comparison: OAuth vs Service Account

| Aspect                | Per-User OAuth            | Domain-Wide Delegation            |
| --------------------- | ------------------------- | --------------------------------- |
| Target users          | Any Gmail/Workspace user  | Workspace users only              |
| Setup complexity      | Per-user consent          | One-time admin setup              |
| Token management      | Refresh tokens per user   | Service account key (no refresh)  |
| User consent required | Yes                       | No (admin grants access)          |
| Token expiration      | Refresh tokens can expire | Service account keys don't expire |
| Credential storage    | Per-user tokens           | Single service account key        |
| Best for              | Consumer Gmail, SMB       | Enterprise Workspace customers    |

#### When to Use Service Account

- Customer is a Google Workspace organization
- Admin is willing to grant domain-wide access
- Need to access multiple users' mailboxes without individual consent
- Want simpler credential management (no token refresh)

#### Limitations

- **Only works with Google Workspace** - Not for personal @gmail.com accounts
- **Requires admin consent** - User-level consent is bypassed
- **All-or-nothing** - Can't selectively grant access to specific users
- **Key rotation** - Service account keys should be rotated periodically (90 days recommended)

---

## Limitations & Considerations

### Technical Limitations

| Limitation                     | Impact                                   |
| ------------------------------ | ---------------------------------------- |
| 7-day watch expiration         | Need scheduled renewal job               |
| Notifications lack content     | Extra API call per notification          |
| API quota limits               | 250 quota units/user/second (sufficient) |
| Attachment size                | 25MB per message limit                   |
| Rate limiting on notifications | Max 1 notification/second per user       |

### Privacy & Compliance

| Concern                       | Consideration                               |
| ----------------------------- | ------------------------------------------- |
| Email addresses are PII       | Encryption at rest required                 |
| Email content sensitivity     | Higher security requirements than messaging |
| GDPR/CCPA considerations      | Data retention policies needed              |
| Restricted scope requirements | Security assessment mandatory               |

### User Experience Differences

| Aspect                     | Implication                                   |
| -------------------------- | --------------------------------------------- |
| No messaging window        | Replies work anytime (unlike messaging)       |
| Email threading complexity | Subject line must match for proper threading  |
| HTML content support       | Need to handle both HTML and plain text       |
| Spam considerations        | Outbound emails may go to spam if not careful |

---

## Recommended Implementation Phases

### Phase 1: Foundation (If Approved)

- [ ] Set up Google Cloud project with Gmail API enabled
- [ ] Create Cloud Pub/Sub topic (`gmail-notifications`)
- [ ] Grant `gmail-api-push@system.gserviceaccount.com` publish rights to topic
- [ ] Create service account for webhook authentication
- [ ] Create push subscription with JWT authentication
- [ ] Implement webhook endpoint with JWT verification
- [ ] Implement Gmail OAuth flow (consent + token exchange)
- [ ] Add Gmail channel type to data model
- [ ] Implement token refresh logic with error handling
- [ ] Build history sync processor (SQS consumer)

### Phase 2: Core Features

- [ ] Implement email reading and normalization
- [ ] Build email threading logic (RFC 2822 headers)
- [ ] Implement reply sending with proper MIME handling
- [ ] Handle attachments (download to S3, upload for sending)
- [ ] Add watch renewal scheduled job (every 12 hours)
- [ ] Implement fallback polling for reliability
- [ ] Add re-authorization flow for token revocation

### Phase 3: UI Integration

- [ ] Gmail channel connection flow in settings
- [ ] Email-specific conversation view (HTML rendering)
- [ ] Reply composer with email formatting
- [ ] Attachment preview and download
- [ ] Channel status indicators (active, reauth_required, error)

---

## Decision: Should We Implement?

### Arguments For

1. **Email is ubiquitous** - Every business has email
2. **No messaging window** - Reply anytime, no time pressure
3. **Works with any email** - Not limited to specific platforms
4. **Standard OAuth** - Similar auth pattern to what we have
5. **Good API** - Well-documented, stable Gmail API

### Arguments Against

1. **Additional GCP dependency** - Need Cloud Pub/Sub (new infrastructure)
2. **Verification overhead** - Security assessment required for restricted scopes
3. **Different paradigm** - Email threading differs from chat threading
4. **Privacy complexity** - Higher sensitivity (full email access)
5. **Not real-time** - Notifications can be delayed

### Recommendation

**Proceed with implementation**, but as a **Phase 2 feature** after the core messaging platforms (Meta, WhatsApp, Zalo) are stable. Gmail fits the unified inbox concept well but has unique requirements that warrant dedicated focus.

---

## References

- [Gmail API Overview](https://developers.google.com/workspace/gmail/api/guides)
- [Gmail Push Notifications](https://developers.google.com/workspace/gmail/api/guides/push)
- [Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Sending Email Guide](https://developers.google.com/workspace/gmail/api/guides/sending)
- [Gmail API Rate Limits](https://developers.google.com/workspace/gmail/api/guides/quota)
- [OAuth Verification FAQ](https://support.google.com/cloud/answer/9110914)
- [Cloud Pub/Sub Push Subscriptions](https://cloud.google.com/pubsub/docs/push)
- [Pub/Sub Authentication & Authorization](https://cloud.google.com/pubsub/docs/authentication)
- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
