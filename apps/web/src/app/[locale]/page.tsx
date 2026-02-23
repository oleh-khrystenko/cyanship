import { useLocale, useTranslations } from 'next-intl';
import { Metadata } from 'next';
import { fetchMetadata } from '@/shared/seo/metadata';
import { MetaProps } from '@/shared/types/settings';
import UiButton from '@/shared/ui/UiButton/UiButton';

export async function generateMetadata(props: MetaProps): Promise<Metadata> {
    return await fetchMetadata({ ...props, page: 'welcome', href: 'welcome' });
}

export default function HomePage() {
    const locale = useLocale();
    const welcomeT = useTranslations('welcome_page');

    return (
        <main className="container flex h-full min-h-screen flex-col justify-center gap-6 py-12">
            <p className="text-text-secondary text-sm tracking-[0.25em] uppercase">
                LucidKit
            </p>
            <h1 className="text-text-primary text-4xl font-semibold">
                {welcomeT('heading')}
            </h1>
            <p className="text-text-secondary max-w-2xl text-lg">
                {welcomeT('description')}
            </p>

            <div className="flex flex-wrap items-center gap-4">
                <UiButton
                    as="link"
                    href={`/${locale}/universal-components`}
                    size="lg"
                    className="font-semibold"
                >
                    {welcomeT('cta')}
                </UiButton>
            </div>
        </main>
    );
}
