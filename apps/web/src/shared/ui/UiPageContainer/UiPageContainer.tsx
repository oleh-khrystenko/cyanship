import { composeClasses } from '@/shared/lib';
import type { UiPageContainerProps } from './types';

const UiPageContainer = ({ children, className }: UiPageContainerProps) => (
    <main
        className={composeClasses(
            'mx-auto flex h-[calc(100dvh-var(--header-height,64px))] max-w-3xl flex-col px-4',
            className,
        )}
    >
        {children}
    </main>
);

UiPageContainer.displayName = 'UiPageContainer';

export default UiPageContainer;
