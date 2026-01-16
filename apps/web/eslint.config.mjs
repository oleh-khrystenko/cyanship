import nextConfig from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
    { ignores: ['eslint.config.mjs'] },
    ...nextConfig,
];

export default eslintConfig;
