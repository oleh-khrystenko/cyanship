import { SUBSCRIPTION_PLANS, EXECUTION_PACKS } from '@cyanship/types';

// Set test-only env vars that are required by fail-fast policy
// but not needed for unit tests (mocked at service level).
process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '4000';
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
// Dynamic: one env var per product from catalog
for (const plan of SUBSCRIPTION_PLANS) {
    process.env[`STRIPE_PRICE_ID_SUB_${plan.code.toUpperCase()}`] ??=
        `price_test_sub_${plan.code}`;
}
for (const pack of EXECUTION_PACKS) {
    process.env[`STRIPE_PRICE_ID_ONEOFF_${pack.code.toUpperCase()}`] ??=
        `price_test_oneoff_${pack.code}`;
}
process.env.PAYMENTS_SUBSCRIPTION_ENABLED ??= 'true';
process.env.PAYMENTS_ONE_OFF_ENABLED ??= 'true';
process.env.AUTH_PASSWORD_MIN_LENGTH ??= '8';
process.env.AUTH_LOCKOUT_THRESHOLDS ??= '5:1,10:5,20:15';
process.env.AUTH_LOGIN_ATTEMPTS_TTL_MIN ??= '15';
process.env.AUTH_MAGIC_LINK_TTL_MIN ??= '15';
process.env.AUTH_MAGIC_LINK_RATE_LIMIT ??= '3';
process.env.AUTH_MAGIC_LINK_RATE_WINDOW_MIN ??= '15';
process.env.AUTH_MAGIC_LINK_DEDUP_SEC ??= '60';
process.env.ACCOUNT_DELETION_GRACE_DAYS ??= '30';
