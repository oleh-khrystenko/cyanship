import { Metadata } from 'next';
import CodeVisual from '@/widgets/agency/landing/HeroSection/CodeVisual';

export const metadata: Metadata = {
    title: 'Banner Export',
    robots: {
        index: false,
        follow: false,
    },
};

export default function BannerExportPage() {
    return (
        <main className="light min-h-screen overflow-hidden bg-background text-foreground">
            <section className="relative flex min-h-screen items-center justify-center px-6 py-16 sm:px-10 lg:px-16">
                <div className="pointer-events-none absolute left-1/2 top-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

                <div className="relative z-10 w-full max-w-5xl">
                    <CodeVisual />
                </div>
            </section>
        </main>
    );
}
