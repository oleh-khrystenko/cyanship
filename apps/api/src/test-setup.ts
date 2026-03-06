// Set test-only env vars that are required by fail-fast policy
// but not needed for unit tests (mocked at service level).
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.GOOGLE_CLIENT_ID ??= 'google-client-id-placeholder';
process.env.GOOGLE_CLIENT_SECRET ??= 'google-client-secret-placeholder';
process.env.GOOGLE_CALLBACK_URL ??=
    'http://localhost:4000/api/auth/google/callback';
process.env.RESEND_API_KEY ??= 're_test_placeholder';
process.env.STRIPE_SECRET_KEY ??= 'sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_test_placeholder';
process.env.STRIPE_PRICE_MONTHLY_USD ??= 'price_test_placeholder';
