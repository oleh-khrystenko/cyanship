export const LANG = {
    UK: 'uk',
    EN: 'en',
} as const;

export type Lang = (typeof LANG)[keyof typeof LANG];
