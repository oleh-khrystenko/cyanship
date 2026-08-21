'use client';

import { useTranslations } from 'next-intl';
import { ProofTabs, ProofWindow, useProofTabs } from '../../proof-window';

const SECTION_ID = 'proof';

/**
 * The same live core as before, aimed at a different reader. A clinic owner is
 * not being invited to open an account; they are being shown, in the one way
 * that cannot be faked, what the person rebuilding their site can build.
 */
const ProofSection = () => {
    const t = useTranslations('home_page.proof');
    const { activeTab, handleTabChange, sectionRef } = useProofTabs(SECTION_ID);

    return (
        <section
            ref={sectionRef}
            id={SECTION_ID}
            className="border-border scroll-mt-16 border-t py-24"
        >
            <div className="container px-6">
                <div className="grid items-stretch gap-8 lg:grid-cols-2 lg:gap-12">
                    <div>
                        <span className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
                            {t('label')}
                        </span>
                        <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                            {t('heading')}
                        </h2>
                        <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
                            {t('description')}
                        </p>

                        <div className="mt-12" data-proof-tabs>
                            <ProofTabs
                                activeTab={activeTab}
                                onTabChange={handleTabChange}
                            />
                        </div>
                    </div>

                    <div className="hidden lg:flex lg:flex-col">
                        {activeTab && (
                            <ProofWindow
                                activeTab={activeTab}
                                onRequestAuth={() => handleTabChange('auth')}
                                sectionId={SECTION_ID}
                            />
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProofSection;
