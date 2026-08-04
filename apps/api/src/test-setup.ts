// Set test-only env vars that are required by fail-fast policy
// but not needed for unit tests (mocked at service level).
process.env.NODE_ENV ??= 'test';
process.env.API_PORT ??= '4000';
process.env.WEB_URL ??= 'http://localhost:3000';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.GOOGLE_CLIENT_ID ??= 'google-client-id-placeholder';
process.env.GOOGLE_CLIENT_SECRET ??= 'google-client-secret-placeholder';
process.env.GOOGLE_CALLBACK_URL ??=
    'http://localhost:4000/api/auth/google/callback';
process.env.RESEND_API_KEY ??= 're_test_placeholder';
process.env.RESEND_FROM_EMAIL ??= 'CyanShip <test@test.dev>';
process.env.STRIPE_SECRET_KEY ??= 'sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_test_placeholder';
process.env.TURNSTILE_SECRET_KEY ??= '1x0000000000000000000000000000000AA';
process.env.BRIEF_NOTIFICATION_EMAIL ??= 'test@test.dev';
process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key';
process.env.R2_ACCOUNT_ID ??= 'test-account-id';
process.env.R2_ACCESS_KEY_ID ??= 'test-access-key-id';
process.env.R2_SECRET_ACCESS_KEY ??= 'test-secret-access-key';
process.env.R2_BUCKET_NAME ??= 'test-media-bucket';
process.env.R2_PUBLIC_URL ??= 'https://media.test.local';
