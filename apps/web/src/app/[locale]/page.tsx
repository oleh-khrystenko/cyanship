import { useTranslations } from 'next-intl';
import { Metadata } from 'next';
import ChangeLang from '@/features/change-lang';
import { fetchMetadata } from '@/shared/seo/metadata';
import { IPageParams } from '@/shared/types/settings';
import ChangeTheme from '@/features/change-theme';
import UiLogo from '@/shared/ui/UiLogo';

export async function generateMetadata({
    params,
}: IPageParams): Promise<Metadata> {
    const { locale } = await params;
    return await fetchMetadata({ locale, page: 'welcome', href: 'welcome' });
}

export default function HomePage() {
    const allPagesT = useTranslations('all_pages');

    return (
        <main className="tablet-md:p-0 flex h-full min-h-screen flex-col pb-14">
            <header>
                <div className="container flex items-center justify-between gap-6 py-4">
                    <UiLogo />

                    <div className="flex items-center gap-4">
                        <ChangeTheme />

                        <ChangeLang />
                    </div>
                </div>
            </header>

            <section className="container text-4xl">
                <h1>{allPagesT('slogan')}</h1>
            </section>
        </main>
    );
}
