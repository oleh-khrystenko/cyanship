import { useTranslations } from 'next-intl';

export default function ProfilePage() {
    const t = useTranslations('welcome_page');

    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <div className="text-center">
                <h1 className="text-text-primary text-3xl font-bold">
                    {t('heading')}
                </h1>
                <p className="text-text-secondary mt-4">{t('description')}</p>
            </div>
        </main>
    );
}
