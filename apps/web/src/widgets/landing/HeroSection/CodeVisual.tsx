import { useTranslations } from 'next-intl';

const CodeVisual = () => {
    const t = useTranslations('landing_page.code_visual');

    return (
        <div className="relative">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                {/* Window chrome */}
                <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
                    <div className="flex gap-1.5">
                        <div className="size-3 rounded-full bg-muted-foreground/30" />
                        <div className="size-3 rounded-full bg-muted-foreground/30" />
                        <div className="size-3 rounded-full bg-muted-foreground/30" />
                    </div>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {t('filename')}
                    </span>
                </div>

                {/* Code content */}
                <div className="p-6 font-mono text-sm leading-relaxed">
                    <div className="text-muted-foreground">
                        {t('comment')}
                    </div>
                    <div className="mt-2">
                        <span className="text-muted-foreground">
                            export async function
                        </span>{' '}
                        <span className="text-foreground">POST</span>
                        <span className="text-muted-foreground">
                            {'(req: Request) {'}
                        </span>
                    </div>
                    <div className="mt-1 pl-4">
                        <span className="text-muted-foreground">const</span>{' '}
                        <span className="text-foreground">session</span>{' '}
                        <span className="text-muted-foreground">=</span>{' '}
                        <span className="text-muted-foreground">await</span>{' '}
                        <span className="text-foreground">stripe</span>
                        <span className="text-muted-foreground">
                            .checkout.sessions.
                        </span>
                        <span className="text-foreground">create</span>
                        <span className="text-muted-foreground">{'({'}</span>
                    </div>
                    <div className="pl-8 text-muted-foreground">
                        mode:{' '}
                        <span className="text-foreground">
                            {"'subscription'"}
                        </span>
                        ,
                    </div>
                    <div className="pl-8 text-muted-foreground">
                        customer:{' '}
                        <span className="text-foreground">
                            user.stripeCustomerId
                        </span>
                        ,
                    </div>
                    <div className="pl-8 text-muted-foreground">
                        line_items:{' '}
                        <span className="text-foreground">[...]</span>,
                    </div>
                    <div className="pl-4 text-muted-foreground">{'});'}</div>
                    <div className="mt-2 text-muted-foreground">{'}'}</div>
                </div>
            </div>

            {/* Decorative glow */}
            <div className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b from-foreground/5 to-transparent" />
        </div>
    );
};

export default CodeVisual;
