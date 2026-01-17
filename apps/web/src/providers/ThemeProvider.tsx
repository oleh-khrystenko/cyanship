'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ComponentProps, FC } from 'react';

const ThemeProvider: FC<ComponentProps<typeof NextThemesProvider>> = ({
    children,
    ...props
}) => {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
};

export default ThemeProvider;
