'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Bot } from 'lucide-react';
import { AI_CHAT_FREE_LIMIT, AI_CHAT_BONUS_AMOUNT } from '@cyanship/types';

import UiButton from '@/shared/ui/UiButton';
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
        <UiSectionCard title={t('heading')}>
            <div className="mt-2 flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                    <Bot className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                        {t('description')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {isExhausted
                            ? t('limit_exhausted')
                            : t('tries_remaining', { count: remaining })}
                    </p>
                </div>
                <UiButton
                    variant="filled"
                    size="sm"
                    as="link"
                    href={`/${locale}/dashboard/chat`}
                >
                    {t('cta_button')}
                </UiButton>
            </div>
        </UiSectionCard>
    );
}
