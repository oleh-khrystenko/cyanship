import { useTranslations } from 'next-intl';
import { DEMO_VIDEO_ENABLED } from '@/shared/config/env';

const DemoVideoSection = () => {
    const t = useTranslations('landing_page.demo_video');

    if (!DEMO_VIDEO_ENABLED) return null;

    return (
        <section id="demo" className="scroll-mt-16 border-t border-border py-24">
            <div className="container px-6">
                <div className="max-w-2xl">
                    <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                        {t('label')}
                    </span>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                        {t('heading')}
                    </h2>
                    <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                        {t('description')}
                    </p>
                </div>

                <div className="mt-12 overflow-hidden rounded-lg border border-border">
                    <div className="relative aspect-video">
                        <iframe
                            src={`https://customer-${process.env.NEXT_PUBLIC_CF_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${process.env.NEXT_PUBLIC_CF_STREAM_VIDEO_ID}/iframe`}
                            title={t('heading')}
                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0 size-full border-0"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default DemoVideoSection;
