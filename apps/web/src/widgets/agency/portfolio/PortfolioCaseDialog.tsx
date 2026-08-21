'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ExternalLink, X } from 'lucide-react';
import {
    UiModal,
    UiModalClose,
    UiModalContent,
    UiModalTitle,
} from '@/shared/ui/UiModal';
import UiButton from '@/shared/ui/UiButton';
import UiLink from '@/shared/ui/UiLink';
import {
    PORTFOLIO_IMAGE_HEIGHT,
    PORTFOLIO_IMAGE_WIDTH,
    PORTFOLIO_ITEM_TYPE,
    PORTFOLIO_ITEMS,
    screenSrc,
    siteLabel,
} from './cases';
import { usePortfolioCaseStore } from './portfolioCaseStore';

export default function PortfolioCaseDialog() {
    const t = useTranslations('portfolio');
    const slug = usePortfolioCaseStore((s) => s.slug);
    const close = usePortfolioCaseStore((s) => s.close);

    const item = PORTFOLIO_ITEMS.find(
        (candidate) =>
            candidate.slug === slug &&
            candidate.type === PORTFOLIO_ITEM_TYPE.WORK
    );

    return (
        <UiModal open={!!item} onOpenChange={(open) => !open && close()}>
            {/* The header stays put because the screens scroll inside their own
                box, not because it is stuck to a moving one: `UiModalContent`
                is a flex column with a height cap, so the body below takes the
                scrollbar with it. Sticking the header to the content scroll
                instead ran the scrollbar across it, and on a transform-centred
                desktop modal a half-pixel of content showed through above. */}
            <UiModalContent className="md:max-w-3xl" hideCloseButton>
                {item && item.type === PORTFOLIO_ITEM_TYPE.WORK && (
                    <>
                        <div className="border-border flex shrink-0 items-center justify-between gap-4 border-b px-6 py-3">
                            <UiModalTitle className="min-w-0">
                                {t(`cases.${item.slug}.title`)}
                            </UiModalTitle>

                            <UiModalClose asChild>
                                <UiButton
                                    variant="icon"
                                    size="md"
                                    aria-label={t('close')}
                                    IconLeft={<X />}
                                    // `min-h-11 min-w-11`: an icon-only
                                    // `UiButton` is sized by padding alone and
                                    // stops short of the 44×44 a thumb needs —
                                    // and on a phone this dialog is a sheet.
                                    className="focus-visible:ring-ring min-h-11 min-w-11 shrink-0 focus-visible:ring-2 focus-visible:ring-offset-2"
                                />
                            </UiModalClose>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-6">
                            <p className="text-muted-foreground leading-relaxed">
                                {t(`cases.${item.slug}.summary`)}
                            </p>

                            {item.href && (
                                // The domain is the proof, not the click: a
                                // reader checking whether these shipped gets
                                // the answer without leaving the page. Kept as
                                // a quiet text link rather than a button — the
                                // one call to action on this page is the brief,
                                // and a second heavy button would compete with
                                // it while pointing away.
                                <UiLink
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={t('visit', {
                                        site: siteLabel(item.href),
                                    })}
                                    className="mt-5 inline-flex items-center gap-1.5 font-medium"
                                >
                                    {siteLabel(item.href)}
                                    <ExternalLink
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                </UiLink>
                            )}

                            <div className="mt-6 space-y-4">
                                {Array.from(
                                    { length: item.screens },
                                    (_, index) => index + 1
                                ).map((screen) => (
                                    <Image
                                        key={screen}
                                        src={screenSrc(item.slug, screen)}
                                        alt={`${t(`cases.${item.slug}.title`)} — ${screen}`}
                                        width={PORTFOLIO_IMAGE_WIDTH}
                                        height={PORTFOLIO_IMAGE_HEIGHT}
                                        sizes="(min-width: 768px) 42rem, 100vw"
                                        className="border-border h-auto w-full rounded-lg border"
                                    />
                                ))}
                            </div>

                            {item.ndaNote && (
                                <p className="text-muted-foreground mt-6 text-sm">
                                    {t('nda_note')}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </UiModalContent>
        </UiModal>
    );
}
