'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Send, Trash2 } from 'lucide-react';
import {
    AI_CHAT_COST,
    AI_CHAT_BONUS_AMOUNT,
    AI_CHAT_EVENT,
    AI_CHAT_FREE_LIMIT,
    AI_CHAT_MESSAGE_MAX_LENGTH,
} from '@cyanship/types';

import UiButton from '@/shared/ui/UiButton';
import UiSpinner from '@/shared/ui/UiSpinner';
import {
    streamAiChat,
    getChatHistory,
    clearChatHistory,
    AiChatError,
    getApiMessageKey,
} from '@/shared/api';
import { useAuthStore } from '@/stores/auth';
import { useBriefDialogStore } from '@/stores/briefDialog';
import { toIntlLocale } from '@/shared/lib';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

function computeIsExhausted(
    ai: { requestsUsed: number; bonusGranted: boolean } | null | undefined,
): boolean {
    if (!ai) return false;
    const limit =
        AI_CHAT_FREE_LIMIT + (ai.bonusGranted ? AI_CHAT_BONUS_AMOUNT : 0);
    return ai.requestsUsed >= limit;
}

export default function AiChatPage() {
    const t = useTranslations('ai_chat_page');
    const tGlobal = useTranslations();
    const locale = useLocale();

    const user = useAuthStore((s) => s.user);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [isLimitExhausted, setIsLimitExhausted] = useState(() =>
        computeIsExhausted(user?.ai),
    );
    const [isClearing, setIsClearing] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Sync limit state with auth store (covers bonus grant, page revisit, etc.)
    useEffect(() => {
        setIsLimitExhausted(computeIsExhausted(user?.ai));
    }, [user?.ai?.requestsUsed, user?.ai?.bonusGranted]);

    // Load history on mount
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const history = await getChatHistory();
                if (cancelled) return;
                setMessages(
                    history.map((m) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                    })),
                );
            } catch {
                // silently fail — empty chat is fine
            } finally {
                if (!cancelled) setIsLoadingHistory(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // Cleanup abort on unmount
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed || isStreaming) return;

        setInput('');
        const userMsgId = `user-${Date.now()}`;
        const assistantMsgId = `assistant-${Date.now()}`;

        setMessages((prev) => [
            ...prev,
            { id: userMsgId, role: 'user', content: trimmed },
            { id: assistantMsgId, role: 'assistant', content: '' },
        ]);
        setIsStreaming(true);

        const controller = new AbortController();
        abortRef.current = controller;

        const removeOptimisticMessages = () => {
            setMessages((prev) =>
                prev.filter(
                    (m) => m.id !== userMsgId && m.id !== assistantMsgId,
                ),
            );
        };

        try {
            await streamAiChat(
                trimmed,
                (event) => {
                    switch (event.type) {
                        case AI_CHAT_EVENT.TOKEN:
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantMsgId
                                        ? { ...m, content: m.content + event.content }
                                        : m,
                                ),
                            );
                            break;

                        case AI_CHAT_EVENT.DONE: {
                            // Use current store state to avoid stale closure
                            const currentUser = useAuthStore.getState().user;
                            if (currentUser) {
                                useAuthStore.getState().setUser({
                                    ...currentUser,
                                    executions: {
                                        ...currentUser.executions,
                                        balance: event.balanceAfter,
                                    },
                                    ai: currentUser.ai
                                        ? {
                                              ...currentUser.ai,
                                              requestsUsed:
                                                  currentUser.ai.requestsUsed + 1,
                                          }
                                        : null,
                                });
                            }
                            if (event.aiRequestsRemaining === 0) {
                                setIsLimitExhausted(true);
                            }
                            break;
                        }

                        case AI_CHAT_EVENT.ERROR:
                            toast.error(
                                tGlobal(getApiMessageKey(event.code, 'ai')),
                            );
                            removeOptimisticMessages();
                            break;
                    }
                },
                controller.signal,
            );
        } catch (err) {
            if (err instanceof AiChatError) {
                if (err.code === 'AI_LIMIT_EXHAUSTED') {
                    setIsLimitExhausted(true);
                } else if (err.code === 'AI_RATE_LIMIT_EXCEEDED') {
                    toast.error(tGlobal(getApiMessageKey(err.code, 'ai')));
                } else if (err.code === 'INSUFFICIENT_EXECUTIONS') {
                    toast.error(tGlobal(getApiMessageKey(err.code, 'users')));
                } else {
                    toast.error(tGlobal(getApiMessageKey(err.code)));
                }
                removeOptimisticMessages();
            } else if (!(err instanceof DOMException && err.name === 'AbortError')) {
                toast.error(tGlobal('errors.generic.unknown'));
                removeOptimisticMessages();
            }
        } finally {
            setIsStreaming(false);
            abortRef.current = null;
            inputRef.current?.focus();
        }
    }, [input, isStreaming, tGlobal]);

    const handleClear = useCallback(async () => {
        setIsClearing(true);
        try {
            await clearChatHistory();
            setMessages([]);
        } catch {
            toast.error(tGlobal('errors.generic.unknown'));
        } finally {
            setIsClearing(false);
        }
    }, [tGlobal]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit],
    );

    const handleOpenBriefDialog = useCallback(() => {
        useBriefDialogStore.getState().open({ requestAiBonus: true });
    }, []);

    const balance = user?.executions.balance ?? 0;
    const canAfford = balance >= AI_CHAT_COST;
    const bonusGranted = user?.ai?.bonusGranted ?? false;
    const formattedCost = AI_CHAT_COST.toLocaleString(toIntlLocale(locale));

    return (
        <main className="mx-auto flex h-[calc(100dvh-var(--header-height,64px))] max-w-3xl flex-col px-4">
            {/* ── Header ── */}
            <div className="flex items-center justify-between border-b border-border py-3">
                <div className="flex items-center gap-3">
                    <Link
                        href={`/${locale}/dashboard`}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={t('back_to_dashboard')}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-lg font-semibold text-foreground">
                        {t('heading')}
                    </h1>
                </div>
                {messages.length > 0 && !isStreaming && (
                    <UiButton
                        variant="text"
                        size="sm"
                        onClick={handleClear}
                        disabled={isClearing}
                    >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        {t('clear_history')}
                    </UiButton>
                )}
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto py-4">
                {isLoadingHistory ? (
                    <div className="flex h-full items-center justify-center">
                        <UiSpinner size="lg" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                        <p className="text-center text-sm text-muted-foreground">
                            {t('empty_state')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-foreground'
                                    }`}
                                >
                                    {msg.content ||
                                        (msg.role === 'assistant' && isStreaming && (
                                            <span className="inline-flex items-center gap-1">
                                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                                            </span>
                                        ))}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-border py-3">
                {isLimitExhausted ? (
                    <div className="text-center">
                        {!bonusGranted ? (
                            <>
                                <p className="text-sm text-muted-foreground">
                                    {t('limit_exhausted')}
                                </p>
                                <UiButton
                                    variant="filled"
                                    size="sm"
                                    className="mt-2"
                                    onClick={handleOpenBriefDialog}
                                >
                                    {t('request_bonus')}
                                </UiButton>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {t('all_tries_exhausted')}
                            </p>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('placeholder')}
                                maxLength={AI_CHAT_MESSAGE_MAX_LENGTH}
                                rows={1}
                                disabled={isStreaming}
                                className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
                            />
                            <UiButton
                                variant="filled"
                                size="sm"
                                className="shrink-0"
                                disabled={
                                    isStreaming ||
                                    !input.trim() ||
                                    !canAfford
                                }
                                onClick={handleSubmit}
                                aria-label={t('send')}
                            >
                                {isStreaming ? (
                                    <UiSpinner size="sm" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </UiButton>
                        </div>
                        <p className="mt-1.5 text-center text-xs text-muted-foreground">
                            {t('cost_info', { cost: formattedCost })}
                        </p>
                    </>
                )}
            </div>
        </main>
    );
}
