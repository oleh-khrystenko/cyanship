'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AI_CHAT_FREE_LIMIT, AI_CHAT_BONUS_AMOUNT } from '@cyanship/types';

import UiSectionCard from '@/shared/ui/UiSectionCard';
import { useAuthStore } from '@/stores/auth';

export default function AiChatTeaser() {
    const t = useTranslations('dashboard_page.ai_chat_teaser');
    const locale = useLocale();
    const user = useAuthStore((s) => s.user);

    if (!user) return null;

    const ai = user.ai ?? { requestsUsed: 0, bonusGranted: false };
    const limit = AI_CHAT_FREE_LIMIT + (ai.bonusGranted ? AI_CHAT_BONUS_AMOUNT : 0);
    const remaining = Math.max(0, limit - ai.requestsUsed);
    const isExhausted = remaining === 0;

    return (
        <UiSectionCard
            title={t('heading')}
            headerRight={
                <Link
                    href={`/${locale}/ai-chat`}
                    className="text-sm font-medium text-primary hover:underline"
                >
                    {t('cta_link')}
                </Link>
            }
        >
            <p className="mt-3 text-sm text-muted-foreground">
                {t('description')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
                {isExhausted
                    ? t('limit_exhausted')
                    : t('tries_remaining', { count: remaining })}
            </p>
        </UiSectionCard>
    );
}
