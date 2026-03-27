'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import {
    EXECUTION_TRANSACTION_TYPE,
    type ExecutionTransactionItem,
} from '@cyanship/types';
import { getExecutionTransactions } from '@/shared/api';
import { toIntlLocale } from '@/shared/lib';
import UiSectionCard from '@/shared/ui/UiSectionCard';
import UiSpinner from '@/shared/ui/UiSpinner';

const TRANSACTION_LIMIT = 10;

interface TransactionHistoryProps {
    refreshTrigger?: number;
}

export default function TransactionHistory({
    refreshTrigger = 0,
}: TransactionHistoryProps) {
    const t = useTranslations('dashboard_page.transactions');
    const locale = useLocale();

    const [transactions, setTransactions] = useState<ExecutionTransactionItem[]>(
        []
    );
    const [isLoading, setIsLoading] = useState(true);

    const formatRelativeTime = useCallback(
        (dateStr: string | Date): string => {
            const date =
                dateStr instanceof Date ? dateStr : new Date(dateStr);
            const diffMs = Date.now() - date.getTime();
            const diffMin = Math.floor(diffMs / 60_000);

            if (diffMin < 1) return t('time_just_now');
            if (diffMin < 60)
                return t('time_minutes_ago', { count: diffMin });

            const diffHours = Math.floor(diffMin / 60);
            if (diffHours < 24)
                return t('time_hours_ago', { count: diffHours });

            return date.toLocaleDateString(toIntlLocale(locale));
        },
        [t, locale]
    );

    useEffect(() => {
        const fetchTransactions = async () => {
            setIsLoading(true);
            try {
                const data = await getExecutionTransactions(TRANSACTION_LIMIT);
                setTransactions(data);
            } catch {
                // Silent fail — transactions are supplementary info
                setTransactions([]);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchTransactions();
    }, [refreshTrigger]);

    return (
        <UiSectionCard title={t('heading')}>
            {isLoading ? (
                <div className="mt-4 flex items-center justify-center py-8">
                    <UiSpinner size="sm" />
                </div>
            ) : transactions.length === 0 ? (
                <p className="mt-4 py-8 text-center text-sm text-muted-foreground">
                    {t('empty')}
                </p>
            ) : (
                <ul className="mt-4 space-y-2">
                    {transactions.map((transaction) => {
                        const isCredit = transaction.type === EXECUTION_TRANSACTION_TYPE.CREDIT;
                        const iconColor = isCredit
                            ? 'bg-success/15 text-success'
                            : 'bg-muted text-muted-foreground';

                        return (
                            <li
                                key={transaction.id}
                                className="flex items-center gap-3 rounded-lg px-3 py-2"
                            >
                                {/* Icon */}
                                <span
                                    className={`flex size-6 shrink-0 items-center justify-center rounded-full ${iconColor}`}
                                >
                                    {isCredit ? (
                                        <ArrowUpRight className="size-3.5" />
                                    ) : (
                                        <ArrowDownRight className="size-3.5" />
                                    )}
                                </span>

                                {/* Action Name */}
                                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                    {t(
                                        `actions.${transaction.action}`,
                                        {
                                            defaultValue: transaction.action,
                                        }
                                    )}
                                </span>

                                {/* Amount */}
                                <span
                                    className={`shrink-0 text-xs font-medium ${
                                        isCredit
                                            ? 'text-success'
                                            : 'text-muted-foreground'
                                    }`}
                                >
                                    {isCredit ? '+' : '−'}
                                    {transaction.amount.toLocaleString(
                                        toIntlLocale(locale)
                                    )}
                                </span>

                                {/* Time */}
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {formatRelativeTime(transaction.createdAt)}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </UiSectionCard>
    );
}
