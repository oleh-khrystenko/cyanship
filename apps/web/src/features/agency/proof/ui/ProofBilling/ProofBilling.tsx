'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';

import {
    getCatalog,
    createSubscriptionCheckout,
    createOneOffCheckout,
    createPortalSession,
} from '@/shared/api/payments';
import { useAuthStore } from '@/entities/user';
import { formatLocalDate } from '@/shared/lib';
import {
    formatPrice,
    PAYMENTS_ONE_OFF_ENABLED,
    PAYMENTS_SUBSCRIPTION_ENABLED,
    type PaymentsCatalog,
} from '@cyanship/types';
import UiButton from '@/shared/ui/UiButton';
import UiSpinner from '@/shared/ui/UiSpinner';
import { DemoBanner } from '@/features/billing';

type SubTab = 'plans' | 'packs';

const SUB_TABS: { key: SubTab; labelKey: string }[] = [
    { key: 'plans', labelKey: 'plans_tab' },
    { key: 'packs', labelKey: 'packs_tab' },
];

interface ProofBillingProps {
    onRequestAuth?: () => void;
    /**
     * Anchor of the section this panel is mounted in. Stripe returns to it
     * appended with `-usage`, so the visitor comes back to the page they paid
     * from with the usage panel already open.
     */
    sectionId: string;
}

const ProofBilling = ({ onRequestAuth, sectionId }: ProofBillingProps) => {
    const t = useTranslations('proof_window.billing');
    const tBilling = useTranslations('billing_page');
    const locale = useLocale();
    const pathname = usePathname();

    const user = useAuthStore((s) => s.user);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const [catalog, setCatalog] = useState<PaymentsCatalog | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    const billing = user?.billing;
    const hasActiveSubscription = billing?.hasActiveSubscription === true;

    const showBothTabs =
        PAYMENTS_SUBSCRIPTION_ENABLED && PAYMENTS_ONE_OFF_ENABLED;
    const [activeSubTab, setActiveSubTab] = useState<SubTab>(
        PAYMENTS_SUBSCRIPTION_ENABLED ? 'plans' : 'packs'
    );

    useEffect(() => {
        getCatalog()
            .then(setCatalog)
            .catch(() => setHasError(true))
            .finally(() => setIsLoading(false));
    }, []);

    const plans = useMemo(
        () =>
            catalog?.subscriptionPlans.toSorted(
                (a, b) => a.displayOrder - b.displayOrder
            ) ?? [],
        [catalog]
    );

    const packs = useMemo(
        () =>
            catalog?.executionPacks.toSorted(
                (a, b) => a.displayOrder - b.displayOrder
            ) ?? [],
        [catalog]
    );

    const activePlan = useMemo(
        () => plans.find((p) => p.code === billing?.planCode),
        [plans, billing?.planCode]
    );

    const handleCheckout = async (
        type: 'subscription' | 'oneoff',
        code: string
    ) => {
        if (!isAuthenticated) {
            onRequestAuth?.();
            return;
        }

        const actionKey =
            type === 'subscription' ? `subscribe_${code}` : `oneoff_${code}`;
        setLoadingAction(actionKey);

        try {
            const returnPath = `${pathname}#${sectionId}-usage`;
            const { checkoutUrl } =
                type === 'subscription'
                    ? await createSubscriptionCheckout(code, returnPath)
                    : await createOneOffCheckout(code, returnPath);

            window.location.assign(checkoutUrl);
        } catch {
            toast.error(
                type === 'subscription'
                    ? tBilling('subscribe.error')
                    : tBilling('executions.error')
            );
            setLoadingAction(null);
        }
    };

    const handlePortal = async () => {
        setLoadingAction('portal');
        try {
            const { portalUrl } = await createPortalSession();
            window.location.assign(portalUrl);
        } catch {
            toast.error(tBilling('active.manage_error'));
            setLoadingAction(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <UiSpinner size="md" />
            </div>
        );
    }

    if (hasError || !catalog) {
        return (
            <div className="py-12 text-center">
                <p className="text-muted-foreground text-sm">{t('error')}</p>
            </div>
        );
    }

    const isEmpty =
        (!PAYMENTS_SUBSCRIPTION_ENABLED || plans.length === 0) &&
        (!PAYMENTS_ONE_OFF_ENABLED || packs.length === 0);

    if (isEmpty) {
        return (
            <div className="py-12 text-center">
                <p className="text-muted-foreground text-sm">{t('error')}</p>
            </div>
        );
    }

    const isActionInProgress = loadingAction !== null;
    const isPortalLoading = loadingAction === 'portal';

    return (
        <div className="w-full space-y-4">
            <DemoBanner />

            {showBothTabs && (
                <div
                    role="tablist"
                    className="bg-muted flex gap-1 rounded-lg p-1"
                >
                    {SUB_TABS.map(({ key, labelKey }) => (
                        <UiButton
                            key={key}
                            variant="bare"
                            role="tab"
                            aria-selected={activeSubTab === key}
                            className="flex-1"
                            onClick={() => setActiveSubTab(key)}
                        >
                            {/* `bare` hands the surface to this span — see the
                                note in `widgets/agency/proof-window/ProofTabs`.
                                It carries the tap area too (`min-h-11`, the 44px
                                floor from `docs/conventions/responsive.md`):
                                below `lg` this panel is a bottom sheet, so this
                                row is read with a thumb before a cursor. */}
                            <span
                                className={`flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
                                    activeSubTab === key
                                        ? 'bg-card text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {t(labelKey)}
                            </span>
                        </UiButton>
                    ))}
                </div>
            )}

            {activeSubTab === 'plans' && PAYMENTS_SUBSCRIPTION_ENABLED && (
                <div role="tabpanel">
                    {hasActiveSubscription ? (
                        <div className="border-border rounded-xl border p-5">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-foreground text-sm font-semibold">
                                    {tBilling('active.plan_name', {
                                        plan: billing?.planCode
                                            ? tBilling(
                                                  `plans.${billing.planCode}.name`,
                                                  {
                                                      defaultValue:
                                                          billing.planCode,
                                                  }
                                              )
                                            : '',
                                    })}
                                </p>
                                <span className="bg-success/15 text-success rounded-full px-2.5 py-0.5 text-[10px] font-medium">
                                    {billing?.cancelAtPeriodEnd
                                        ? tBilling('active.status_canceling', {
                                              date: formatLocalDate(
                                                  billing.currentPeriodEnd,
                                                  locale
                                              ),
                                          })
                                        : tBilling('active.status_active')}
                                </span>
                            </div>

                            {activePlan && (
                                <p className="text-foreground mt-3 text-2xl font-bold tracking-tight">
                                    {formatPrice(
                                        activePlan.priceAmount,
                                        activePlan.currency
                                    )}
                                    <span className="text-muted-foreground text-sm font-normal">
                                        {' '}
                                        {tBilling(
                                            `subscribe.interval_${activePlan.interval}`
                                        )}
                                    </span>
                                </p>
                            )}

                            <UiButton
                                variant="outline"
                                size="sm"
                                IconRight={
                                    !isPortalLoading ? (
                                        <ExternalLink />
                                    ) : undefined
                                }
                                className="relative mt-4 w-full justify-center"
                                onClick={handlePortal}
                                disabled={isActionInProgress}
                            >
                                <span
                                    className={
                                        isPortalLoading ? 'invisible' : ''
                                    }
                                >
                                    {tBilling('active.manage_button')}
                                </span>
                                {isPortalLoading && (
                                    <UiSpinner
                                        size="sm"
                                        className="absolute inset-0 m-auto"
                                    />
                                )}
                            </UiButton>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {plans.map((plan) => {
                                const actionKey = `subscribe_${plan.code}`;
                                const isBusy = loadingAction === actionKey;

                                return (
                                    <div
                                        key={plan.code}
                                        className="border-border flex flex-col rounded-xl border p-5"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-foreground text-sm font-semibold">
                                                {tBilling(
                                                    `plans.${plan.code}.name`,
                                                    {
                                                        defaultValue: plan.code,
                                                    }
                                                )}
                                            </p>
                                            {plan.featured && (
                                                <span className="border-muted-foreground/25 bg-muted/50 text-muted-foreground hidden rounded-full border px-2 py-0.5 text-[10px] font-medium min-[412px]:inline">
                                                    {tBilling(
                                                        `plans.${plan.code}.badge`
                                                    )}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-foreground mt-3 text-2xl font-bold tracking-tight">
                                            {formatPrice(
                                                plan.priceAmount,
                                                plan.currency
                                            )}
                                            <span className="text-muted-foreground text-sm font-normal">
                                                {' '}
                                                {tBilling(
                                                    `subscribe.interval_${plan.interval}`
                                                )}
                                            </span>
                                        </p>

                                        <UiButton
                                            variant={
                                                plan.featured
                                                    ? 'filled'
                                                    : 'outline'
                                            }
                                            size="sm"
                                            className={`relative mt-4 w-full justify-center ${!plan.featured ? 'border-primary text-primary hover:border-primary hover:bg-primary/10 hover:text-primary' : ''}`}
                                            onClick={() =>
                                                handleCheckout(
                                                    'subscription',
                                                    plan.code
                                                )
                                            }
                                            disabled={isActionInProgress}
                                        >
                                            <span
                                                className={
                                                    isBusy ? 'invisible' : ''
                                                }
                                            >
                                                {t('subscribe_button')}
                                            </span>
                                            {isBusy && (
                                                <UiSpinner
                                                    size="sm"
                                                    className="absolute inset-0 m-auto"
                                                />
                                            )}
                                        </UiButton>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeSubTab === 'packs' && PAYMENTS_ONE_OFF_ENABLED && (
                <div role="tabpanel" className="grid grid-cols-2 gap-4">
                    {packs.map((pack) => {
                        const actionKey = `oneoff_${pack.code}`;
                        const isBusy = loadingAction === actionKey;

                        return (
                            <div
                                key={pack.code}
                                className="border-border flex flex-col rounded-xl border p-5"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-foreground text-sm font-semibold">
                                        {tBilling(`packs.${pack.code}.name`, {
                                            defaultValue: pack.code,
                                        })}
                                    </p>
                                    {pack.featured && (
                                        <span className="border-muted-foreground/25 bg-muted/50 text-muted-foreground hidden rounded-full border px-2 py-0.5 text-[10px] font-medium min-[412px]:inline">
                                            {tBilling(
                                                `packs.${pack.code}.badge`
                                            )}
                                        </span>
                                    )}
                                </div>

                                <p className="text-foreground mt-3 text-2xl font-bold tracking-tight">
                                    {formatPrice(
                                        pack.priceAmount,
                                        pack.currency
                                    )}
                                    <span className="text-muted-foreground text-sm font-normal">
                                        {' · '}
                                        {pack.executions.toLocaleString(
                                            'en-US'
                                        )}
                                        <span className="hidden lg:inline">
                                            {' '}
                                            {tBilling('packs.executions_label')}
                                        </span>
                                    </span>
                                </p>

                                <UiButton
                                    variant={
                                        pack.featured ? 'filled' : 'outline'
                                    }
                                    size="sm"
                                    className={`relative mt-4 w-full justify-center ${!pack.featured ? 'border-primary text-primary hover:border-primary hover:bg-primary/10 hover:text-primary' : ''}`}
                                    onClick={() =>
                                        handleCheckout('oneoff', pack.code)
                                    }
                                    disabled={isActionInProgress}
                                >
                                    <span className={isBusy ? 'invisible' : ''}>
                                        {t('buy_button')}
                                    </span>
                                    {isBusy && (
                                        <UiSpinner
                                            size="sm"
                                            className="absolute inset-0 m-auto"
                                        />
                                    )}
                                </UiButton>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ProofBilling;
