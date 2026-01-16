export const CLang = {
    UK: 'uk',
    EN: 'en',
} as const;

export type TLang = (typeof CLang)[keyof typeof CLang];
