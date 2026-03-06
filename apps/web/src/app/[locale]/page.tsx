import { useTranslations } from 'next-intl';
import { Metadata } from 'next';
import { fetchMetadata } from '@/shared/seo/metadata';
import { MetaProps } from '@/shared/types/settings';

export async function generateMetadata(props: MetaProps): Promise<Metadata> {
    return await fetchMetadata({ ...props, page: 'welcome', href: 'welcome' });
}

export default function HomePage() {
    const welcomeT = useTranslations('welcome_page');

    return (
        <main className="container flex h-full min-h-screen flex-col justify-center gap-6 py-12">
            <p className="text-text-secondary text-sm tracking-[0.25em] uppercase">
                LucidShip
            </p>
            <h1 className="text-text-primary text-4xl font-semibold">
                {welcomeT('heading')}
            </h1>
            <p className="text-text-secondary max-w-2xl text-lg">
                {welcomeT('description')}
            </p>
        </main>
    );
}
