// Set test-only env vars that are required by fail-fast policy
// but not needed for unit tests (mocked at service level).
process.env.STRIPE_SECRET_KEY ??= 'sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_test_placeholder';
process.env.STRIPE_PRICE_ONE_OFF_USD ??= 'price_test_placeholder';
