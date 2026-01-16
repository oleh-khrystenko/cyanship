const getEnvVar = (name: string, fallback?: string): string => {
    const value = process.env[name];
    if (!value && fallback === undefined) {
        throw new Error(`❌ Environment variable "${name}" is not defined`);
    }
    return value ?? fallback!;
};

export const ENV = {
    BASE_URL: getEnvVar('NEXT_PUBLIC_BASE_URL'),
};
