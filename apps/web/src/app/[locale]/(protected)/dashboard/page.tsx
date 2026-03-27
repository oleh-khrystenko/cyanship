'use client';

import { useCallback, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getFullName, getInitials } from '@cyanship/types';
import { Zap } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { toIntlLocale } from '@/shared/lib';
import {
    UiAvatar,
    UiAvatarImage,
    UiAvatarFallback,
} from '@/shared/ui/UiAvatar';
import { PAYMENTS_SUBSCRIPTION_ENABLED } from '@/shared/config/env';
import DashboardEmptyState from './DashboardEmptyState';
import SubscriptionStatus from './SubscriptionStatus';
import SpendExecutionButtons from './SpendExecutionButtons';
import TransactionHistory from './TransactionHistory';

export default function DashboardPage() {
    const t = useTranslations('dashboard_page');
    const locale = useLocale();
    const user = useAuthStore((s) => s.user);
    const [txVersion, setTxVersion] = useState(0);
    const handleSpendSuccess = useCallback(
        () => setTxVersion((v) => v + 1),
        [],
    );

    if (!user) return null;

    const fullName = getFullName(user.profile.firstName, user.profile.lastName);
    const initials = getInitials(fullName, user.email);
    const balance = user.executions.balance;
    const hasSubscription = user.billing?.hasActiveSubscription === true;
    const isEmpty = balance === 0 && !hasSubscription;
    const formattedBalance = balance.toLocaleString(toIntlLocale(locale));

    return (
        <main className="mx-auto max-w-3xl space-y-8 px-4 py-12 md:py-16">
            {/* ── Greeting ── */}
            <div className="flex items-center gap-4">
                <UiAvatar size="xl">
                    <UiAvatarImage
                        src={user.profile.avatar ?? undefined}
                        alt={fullName}
                    />
                    <UiAvatarFallback size="xl">
                        {initials}
                    </UiAvatarFallback>
                </UiAvatar>
                <div className="flex flex-col gap-0.5">
                    <h1 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
                        {t('greeting', {
                            name: user.profile.firstName ?? '',
                        })}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {user.email}
                    </p>
                </div>
            </div>

            {/* ── Execution Balance ── */}
            <section className="rounded-xl border border-border bg-card p-6 md:p-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Zap className="size-4" />
                    <span className="font-medium">
                        {t('balance_label')}
                    </span>
                </div>
                <p className="mt-2">
                    <span className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                        {formattedBalance}
                    </span>
                    <span className="ml-2 text-sm text-muted-foreground">
                        {t('balance_unit')}
                    </span>
                </p>
            </section>

            {/* ── Empty State ── */}
            {isEmpty && <DashboardEmptyState />}

            {/* ── Subscription Status ── */}
            {PAYMENTS_SUBSCRIPTION_ENABLED && <SubscriptionStatus />}

            {/* ── Spend Execution Buttons ── */}
            <SpendExecutionButtons onSpendSuccess={handleSpendSuccess} />

            {/* ── Transaction History ── */}
            <TransactionHistory refreshTrigger={txVersion} />
        </main>
    );
}
