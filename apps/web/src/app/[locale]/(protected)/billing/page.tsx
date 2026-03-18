'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
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

    const featureKeys = ['item_1', 'item_2', 'item_3'] as const;

    return (
        <div className="mx-auto max-w-3xl space-y-10 px-4 py-12">
            {/* ── Demo Banner ── */}
            <DemoBanner />

            {/* ── Subscription Section ── */}
            {PAYMENTS_SUBSCRIPTION_ENABLED && (
                <section>
                    {!hasActive ? (
                        <div className={`grid gap-4 ${(SUBSCRIPTION_PLANS.length as number) === 1 ? '' : 'sm:grid-cols-2'}`}>
                            {SUBSCRIPTION_PLANS.map((plan) => (
                                <div
                                    key={plan.code}
                                    className="flex flex-col rounded-lg border-2 border-foreground bg-card p-6 md:p-8"
                                >
                                    <p className="text-base font-medium text-foreground">
                                        {t(`plans.${plan.code}.name`, { defaultValue: plan.code })}
                                    </p>
                                    <p className="mt-2 text-4xl font-bold text-foreground">
                                        {formatPrice(plan.priceAmount, plan.currency)}
                                        <span className="text-lg font-normal text-muted-foreground">
                                            {' '}{t(`subscribe.interval_${plan.interval}`)}
                                        </span>
                                    </p>

                                    <ul className="mt-6 space-y-3">
                                        {featureKeys.map((key) => (
                                            <li
                                                key={key}
                                                className="flex items-center gap-2 text-sm text-muted-foreground"
                                            >
                                                <Check className="h-4 w-4 shrink-0 text-success" />
                                                {t(`subscribe.features.${key}`)}
                                            </li>
                                        ))}
                                    </ul>

                                    <UiButton
                                        variant="filled"
                                        size="lg"
                                        className="mt-8 w-full justify-center"
                                        onClick={() =>
                                            handleSubscriptionCheckout(plan.code)
                                        }
                                        disabled={
                                            loadingAction === `subscribe_${plan.code}`
                                        }
                                    >
                                        {loadingAction === `subscribe_${plan.code}` ? (
                                            <UiSpinner size="sm" />
                                        ) : (
                                            t('subscribe.button')
                                        )}
                                    </UiButton>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-border bg-card p-6 md:p-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-foreground">
                                    {t('active.title')}
                                </h2>
                                <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                                    {billing?.cancelAtPeriodEnd
                                        ? t('active.status_canceling', {
                                              date: formatDate(
                                                  billing?.currentPeriodEnd ??
                                                      null,
                                              ),
                                          })
                                        : t('active.status_active')}
                                </span>
                            </div>

                            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                                {billing?.planCode && (
                                    <p>
                                        {t('active.plan_label', {
                                            plan: billing.planCode,
                                        })}
                                    </p>
                                )}
                                {billing?.currentPeriodEnd &&
                                    !billing?.cancelAtPeriodEnd && (
                                        <p>
                                            {t('active.next_billing', {
                                                date: formatDate(
                                                    billing.currentPeriodEnd,
                                                ),
                                            })}
                                        </p>
                                    )}
                                {billing?.cancelAtPeriodEnd && (
                                    <p className="text-warning">
                                        {t('active.cancel_notice')}
                                    </p>
                                )}
                                {billing?.scheduledPlanCode && (
                                    <p className="text-info">
                                        {t('active.scheduled_change', {
                                            plan: billing.scheduledPlanCode,
                                            date: formatDate(
                                                billing.scheduledChangeDate ??
                                                    null,
                                            ),
                                        })}
                                    </p>
                                )}
                            </div>

                            <UiButton
                                variant="filled"
                                size="md"
                                className="mt-6"
                                onClick={handlePortal}
                                disabled={loadingAction === 'portal'}
                            >
                                {loadingAction === 'portal' ? (
                                    <UiSpinner size="sm" />
                                ) : (
                                    t('active.manage_button')
                                )}
                            </UiButton>
                        </div>
                    )}
                </section>
            )}

            {/* ── Credits Section ── */}
            {PAYMENTS_ONE_OFF_ENABLED && (
                <section>
                    <div className="mb-6">
                        <h2 className="text-foreground text-2xl font-bold">
                            {t('credits.title')}
                        </h2>
                        <p className="text-muted-foreground mt-1">
                            {t('credits.description')}
                        </p>
                        <p className="text-foreground mt-2 font-medium">
                            {t('credits.balance', {
                                count: user.credits.balance,
                            })}
                        </p>
                    </div>

                    <div className={`grid gap-4 ${(CREDIT_PACKS.length as number) <= 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                        {CREDIT_PACKS.map((pack) => (
                            <div
                                key={pack.code}
                                className="flex flex-col rounded-lg border border-border bg-card p-5"
                            >
                                <p className="text-foreground text-lg font-semibold">
                                    {t('credits.pack_label', {
                                        credits: pack.credits,
                                        price: formatPrice(
                                            pack.priceAmount,
                                            pack.currency,
                                        ),
                                    })}
                                </p>
                                <UiButton
                                    variant="filled"
                                    size="md"
                                    className="mt-4 w-full justify-center"
                                    onClick={() =>
                                        handleOneOffCheckout(pack.code)
                                    }
                                    disabled={
                                        loadingAction === `oneoff_${pack.code}`
                                    }
                                >
                                    {loadingAction ===
                                    `oneoff_${pack.code}` ? (
                                        <UiSpinner size="sm" />
                                    ) : (
                                        t('credits.buy_button')
                                    )}
                                </UiButton>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Reset Billing ── */}
            <section className="border-t border-border pt-8">
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
            </section>

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
