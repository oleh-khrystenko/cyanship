import { apiClient } from './client';
import type { ExecutionTransactionItem, SpendableAction } from '@cyanship/types';

export async function spendExecutions(
    action: SpendableAction,
): Promise<{ balance: number; transaction: ExecutionTransactionItem }> {
    const { data } = await apiClient.post<{
        data: { balance: number; transaction: ExecutionTransactionItem };
    }>('/users/me/executions/spend', { action });
    return data.data;
}

export async function getExecutionTransactions(
    limit: number = 10,
): Promise<ExecutionTransactionItem[]> {
    const { data } = await apiClient.get<{
        data: ExecutionTransactionItem[];
    }>('/users/me/executions/transactions', { params: { limit } });
    return data.data;
}
