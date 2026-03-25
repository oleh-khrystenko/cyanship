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
        function renderWidget() {
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
            }
        }

        // Script already loaded (e.g. another instance loaded it earlier)
        if (window.turnstile) {
            renderWidget();
            return;
        }

        const existingScript =
            document.querySelector<HTMLScriptElement>('script[src*="turnstile"]');

        if (existingScript) {
            // Script tag exists but hasn't finished loading yet
            existingScript.addEventListener('load', renderWidget);
            return () => existingScript.removeEventListener('load', renderWidget);
        }

        // Load Turnstile script for the first time
        const script = document.createElement('script');
        script.src =
            'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.addEventListener('load', renderWidget);
        document.head.appendChild(script);

        return () => {
            script.removeEventListener('load', renderWidget);
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
