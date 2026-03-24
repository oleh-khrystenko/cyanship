import { useEffect, useRef, useCallback, useState } from 'react';
import { ENV } from '@/shared/config';

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement,
                options: {
                    sitekey: string;
                    callback: (token: string) => void;
                    'error-callback'?: () => void;
                    'expired-callback'?: () => void;
                    size?: 'invisible' | 'normal' | 'compact';
                },
            ) => string;
            remove: (widgetId: string) => void;
            reset: (widgetId: string) => void;
        };
    }
}

export function useTurnstile() {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        // Load Turnstile script if not already loaded
        if (!document.querySelector('script[src*="turnstile"]')) {
            const script = document.createElement('script');
            script.src =
                'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            document.head.appendChild(script);
        }

        const interval = setInterval(() => {
            if (
                window.turnstile &&
                containerRef.current &&
                !widgetIdRef.current
            ) {
                widgetIdRef.current = window.turnstile.render(
                    containerRef.current,
                    {
                        sitekey: ENV.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
                        callback: (t: string) => setToken(t),
                        'error-callback': () => setToken(null),
                        'expired-callback': () => setToken(null),
                        size: 'invisible',
                    },
                );
                clearInterval(interval);
            }
        }, 100);

        return () => {
            clearInterval(interval);
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, []);

    const reset = useCallback(() => {
        setToken(null);
        if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
        }
    }, []);

    return { containerRef, token, reset };
}
