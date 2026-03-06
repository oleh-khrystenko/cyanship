import UiSpinner from '../UiSpinner';
import { composeClasses } from '@/shared/lib';
import type { UiFullPageLoaderProps } from './types';

const UiFullPageLoader = ({ message, className }: UiFullPageLoaderProps) => (
    <main
        className={composeClasses(
            'flex min-h-screen flex-col items-center justify-center gap-4',
            className
        )}
    >
        <UiSpinner size="lg" />
        {message && (
            <p className="text-text-secondary text-lg">{message}</p>
        )}
    </main>
);

UiFullPageLoader.displayName = 'UiFullPageLoader';

export default UiFullPageLoader;
