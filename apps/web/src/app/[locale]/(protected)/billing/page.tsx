'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import {
    PAYMENTS_SUBSCRIPTION_ENABLED,
    PAYMENTS_ONE_OFF_ENABLED,
} from '@/shared/config/env';
import {
    createSubscriptionCheckout,
    createOneOffCheckout,
    createPortalSession,
    resetBilling,
} from '@/shared/api/payments';
import { getMe } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';
import {
    SUBSCRIPTION_PLANS,
    SUBSCRIPTION_PLAN_MAP,
    CREDIT_PACKS,
    formatPrice,
    type SubscriptionPlanCode,
    type CreditPackCode,
} from '@cyanship/types';
import UiButton from '@/shared/ui/UiButton';
import UiSpinner from '@/shared/ui/UiSpinner';
import { UiConfirmDialog } from '@/shared/ui/UiConfirmDialog';
import { DemoBanner } from '@/features/billing';

export default function BillingPage() {
    const t = useTranslations('billing_page');
    const locale = useLocale();
    const user = useAuthStore((s) => s.user);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);

    if (!user) return null;

    const billing = user.billing;
    const hasActive = billing?.hasActiveSubscription === true;
    const hasBillingData = billing != null || user.credits.balance > 0;

    const formatDate = (date: Date | string | null) => {
        if (!date) return '';
        return new Intl.DateTimeFormat(
            locale === 'uk' ? 'uk-UA' : 'en-US',
            { year: 'numeric', month: 'long', day: 'numeric' },
        ).format(date instanceof Date ? date : new Date(date));
    };

    const handleSubscriptionCheckout = async (
        planCode: SubscriptionPlanCode,
    ) => {
        setLoadingAction(`subscribe_${planCode}`);
        try {
            const { checkoutUrl } =
                await createSubscriptionCheckout(planCode);
            window.location.assign(checkoutUrl);
        } catch {
            toast.error(t('subscribe.error'));
            setLoadingAction(null);
        }
    };

    const handleOneOffCheckout = async (packCode: CreditPackCode) => {
        setLoadingAction(`oneoff_${packCode}`);
        try {
            const { checkoutUrl } = await createOneOffCheckout(packCode);
            window.location.assign(checkoutUrl);
        } catch {
            toast.error(t('credits.error'));
            setLoadingAction(null);
        }
    };

    const handlePortal = async () => {
        setLoadingAction('portal');
        try {
            const { portalUrl } = await createPortalSession();
            window.location.assign(portalUrl);
        } catch {
            toast.error(t('active.manage_error'));
            setLoadingAction(null);
        }
    };

    const handleReset = async () => {
        setLoadingAction('reset');
        try {
            await resetBilling();
            const me = await getMe();
            useAuthStore.getState().setUser(me);
            setResetDialogOpen(false);
            toast.success(t('reset.success'));
        } catch {
            toast.error(t('reset.error'));
        } finally {
            setLoadingAction(null);
        }
    };

    const planFeatureKeys: Record<string, readonly string[]> = {
        starter: ['item_1', 'item_2', 'item_3', 'item_4'],
        pro: ['item_1', 'item_2', 'item_3', 'item_4', 'item_5'],
    };

    return (
        <div className="mx-auto max-w-3xl space-y-10 px-4 py-12">
            {/* ── Demo Banner ── */}
            <DemoBanner />

            {/* ── Page Header ── */}
            <div>
                <h1 className="text-foreground text-3xl font-bold tracking-tight">
                    {t('heading')}
                </h1>
                <p className="text-muted-foreground mt-2">
                    {t('description')}
                </p>
            </div>

            {/* ── Subscription Section ── */}
            {PAYMENTS_SUBSCRIPTION_ENABLED && (
                <section>
                    <h2 className="text-foreground mb-6 text-2xl font-bold">
                        {hasActive ? t('active.heading') : t('subscribe.heading')}
                    </h2>

                    {!hasActive ? (
                        <div className={`grid gap-6 ${(SUBSCRIPTION_PLANS.length as number) === 1 ? '' : 'sm:grid-cols-2'}`}>
                            {SUBSCRIPTION_PLANS.map((plan) => {
                                const hasBadge = plan.code === 'pro';

                                return (
                                    <div
                                        key={plan.code}
                                        className="flex flex-col rounded-xl border border-border bg-card p-6 md:p-8"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-foreground text-xl font-bold">
                                                {t(`plans.${plan.code}.name`, { defaultValue: plan.code })}
                                            </h3>
                                            {hasBadge && (
                                                <span className="rounded-full border border-muted-foreground/25 bg-muted/50 px-3 py-0.5 text-xs font-medium text-muted-foreground">
                                                    {t(`plans.${plan.code}.badge`)}
                                                </span>
                                            )}
                                        </div>

                                        <p className="mt-3 text-4xl font-bold tracking-tight text-foreground">
                                            {formatPrice(plan.priceAmount, plan.currency)}
                                            <span className="text-lg font-normal text-muted-foreground">
                                                {' '}{t(`subscribe.interval_${plan.interval}`)}
                                            </span>
                                        </p>

                                        <p className="text-muted-foreground mt-2 text-sm">
                                            {t(`plans.${plan.code}.tagline`)}
                                        </p>

                                        <ul className="mt-6 flex-1 space-y-3">
                                            {(planFeatureKeys[plan.code] ?? []).map((key) => (
                                                <li
                                                    key={key}
                                                    className="flex items-center gap-2 text-sm text-muted-foreground"
                                                >
                                                    <Check className="h-4 w-4 shrink-0 text-success" />
                                                    {t(`plans.${plan.code}.features.${key}`)}
                                                </li>
                                            ))}
                                        </ul>

                                        <UiButton
                                            variant={hasBadge ? 'filled' : 'outline'}
                                            size="lg"
                                            className={`relative mt-8 w-full justify-center ${!hasBadge ? 'border-primary text-primary hover:bg-primary/10 hover:text-primary hover:border-primary' : ''}`}
                                            onClick={() =>
                                                handleSubscriptionCheckout(plan.code)
                                            }
                                            disabled={
                                                loadingAction === `subscribe_${plan.code}`
                                            }
                                        >
                                            <span className={loadingAction === `subscribe_${plan.code}` ? 'invisible' : ''}>
                                                {t('subscribe.button', { plan: t(`plans.${plan.code}.name`, { defaultValue: plan.code }) })}
                                            </span>
                                            {loadingAction === `subscribe_${plan.code}` && (
                                                <UiSpinner size="sm" className="absolute inset-0 m-auto" />
                                            )}
                                        </UiButton>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex items-stretch gap-5 rounded-lg border border-border bg-card p-4 md:p-5">
                            {billing?.planCode && (
                                <div className="relative hidden aspect-square w-20 shrink-0 overflow-hidden rounded-md sm:block">
                                    <Image
                                        src={`/images/plans/${billing.planCode}-light.png`}
                                        alt={t(`plans.${billing.planCode as SubscriptionPlanCode}.name`, { defaultValue: billing.planCode })}
                                        fill
                                        className="block object-cover dark:hidden"
                                    />
                                    <Image
                                        src={`/images/plans/${billing.planCode}-dark.png`}
                                        alt={t(`plans.${billing.planCode as SubscriptionPlanCode}.name`, { defaultValue: billing.planCode })}
                                        fill
                                        className="hidden object-cover dark:block"
                                    />
                                </div>
                            )}

                            <div className="flex min-w-0 flex-1 flex-col justify-center">
                                <div className="flex items-center gap-3">
                                    <p className="text-foreground text-base font-semibold">
                                        {t('active.plan_name', {
                                            plan: billing?.planCode
                                                ? t(`plans.${billing.planCode as SubscriptionPlanCode}.name`, { defaultValue: billing.planCode })
                                                : '',
                                        })}
                                    </p>
                                    <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
                                        {billing?.cancelAtPeriodEnd
                                            ? t('active.status_canceling', {
                                                  date: formatDate(billing?.currentPeriodEnd ?? null),
                                              })
                                            : t('active.status_active')}
                                    </span>
                                </div>

                                <p className="text-muted-foreground mt-1 text-sm">
                                    {billing?.cancelAtPeriodEnd
                                        ? t('active.cancel_notice')
                                        : billing?.currentPeriodEnd
                                          ? t('active.next_billing_credits', {
                                                date: formatDate(billing.currentPeriodEnd),
                                                credits: billing.planCode && billing.planCode in SUBSCRIPTION_PLAN_MAP
                                                    ? SUBSCRIPTION_PLAN_MAP[billing.planCode as SubscriptionPlanCode].credits.toLocaleString('en-US')
                                                    : '',
                                            })
                                          : null}
                                    {billing?.scheduledPlanCode && (
                                        <span className="text-info">
                                            {' · '}
                                            {t('active.scheduled_change', {
                                                plan: billing.scheduledPlanCode,
                                                date: formatDate(billing.scheduledChangeDate ?? null),
                                            })}
                                        </span>
                                    )}
                                </p>
                            </div>

                            <UiButton
                                variant="outline"
                                size="sm"
                                IconRight={loadingAction !== 'portal' ? <ExternalLink /> : undefined}
                                className="relative shrink-0 self-center"
                                onClick={handlePortal}
                                disabled={loadingAction === 'portal'}
                            >
                                <span className={loadingAction === 'portal' ? 'invisible' : ''}>
                                    {t('active.manage_button')}
                                </span>
                                {loadingAction === 'portal' && (
                                    <UiSpinner size="sm" className="absolute inset-0 m-auto" />
                                )}
                            </UiButton>
                        </div>
                    )}
                </section>
            )}

            {/* ── Credits Section ── */}
            {PAYMENTS_ONE_OFF_ENABLED && (
                <section>
                    <div className="mb-6 flex items-baseline justify-between">
                        <h2 className="text-foreground text-2xl font-bold">
                            {t('credits.title')}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            {t.rich('credits.balance', {
                                count: user.credits.balance.toLocaleString('en-US'),
                                accent: (chunks) => (
                                    <span className="text-primary font-semibold">{chunks}</span>
                                ),
                            })}
                        </p>
                    </div>

                    <div className={`grid gap-6 ${(CREDIT_PACKS.length as number) <= 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                        {CREDIT_PACKS.map((pack) => (
                            <div
                                key={pack.code}
                                className="flex flex-col rounded-xl border border-border bg-card p-5 md:p-6"
                            >
                                {/* ── Upper: image + info ── */}
                                <div className="flex items-center gap-4">
                                    <div className="relative aspect-square w-14 shrink-0 overflow-hidden rounded-lg">
                                        <Image
                                            src={`/images/packs/${pack.code}-light.png`}
                                            alt={t(`packs.${pack.code}.name`)}
                                            fill
                                            className="block object-cover dark:hidden"
                                        />
                                        <Image
                                            src={`/images/packs/${pack.code}-dark.png`}
                                            alt={t(`packs.${pack.code}.name`)}
                                            fill
                                            className="hidden object-cover dark:block"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-foreground text-base font-semibold">
                                            {t(`packs.${pack.code}.name`)}
                                        </p>
                                        <p className="text-muted-foreground mt-0.5 text-sm">
                                            {t(`packs.${pack.code}.per_credit`)}
                                        </p>
                                    </div>
                                </div>

                                {/* ── Lower: price + button ── */}
                                <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
                                    <p className="text-foreground text-xl font-bold">
                                        {formatPrice(pack.priceAmount, pack.currency)}
                                    </p>
                                    <UiButton
                                        variant="outline"
                                        size="md"
                                        className="relative"
                                        onClick={() =>
                                            handleOneOffCheckout(pack.code)
                                        }
                                        disabled={
                                            loadingAction === `oneoff_${pack.code}`
                                        }
                                    >
                                        <span className={loadingAction === `oneoff_${pack.code}` ? 'invisible' : ''}>
                                            {t('credits.buy_button')}
                                        </span>
                                        {loadingAction === `oneoff_${pack.code}` && (
                                            <UiSpinner size="sm" className="absolute inset-0 m-auto" />
                                        )}
                                    </UiButton>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Reset Billing ── */}
            {hasBillingData && <section className="border-t border-border pt-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-foreground text-lg font-semibold">
                            {t('reset.button')}
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {t('reset.description')}
                        </p>
                    </div>
                    <UiButton
                        variant="destructive-outline"
                        size="md"
                        className="shrink-0"
                        onClick={() => setResetDialogOpen(true)}
                    >
                        {t('reset.button')}
                    </UiButton>
                </div>

                <UiConfirmDialog
                    open={resetDialogOpen}
                    onOpenChange={setResetDialogOpen}
                    title={t('reset.dialog_title')}
                    description={t('reset.dialog_description')}
                    confirmLabel={t('reset.dialog_confirm')}
                    cancelLabel={t('reset.dialog_cancel')}
                    variant="destructive"
                    loading={loadingAction === 'reset'}
                    onConfirm={handleReset}
                />
            </section>}

            {/* ── Terms Note ── */}
            <p className="text-muted-foreground text-center text-xs">
                {t.rich('checkout_terms_note', {
                    terms: (chunks) => (
                        <a
                            href={`/${locale}/terms`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:no-underline"
                        >
                            {chunks}
                        </a>
                    ),
                })}
            </p>
        </div>
    );
}
