const getEnvVar = (name: string, fallback?: string): string => {
    const value = process.env[name];
    if (!value && fallback === undefined) {
        throw new Error(`❌ Environment variable "${name}" is not defined`);
    }
    return value ?? fallback!;
};

export const ENV = {
    PORT: getEnvVar('PORT', '4000'),
    MONGODB_URI: getEnvVar('MONGODB_URI'),
    MONGODB_DB_NAME: getEnvVar('MONGODB_DB_NAME'),
};
