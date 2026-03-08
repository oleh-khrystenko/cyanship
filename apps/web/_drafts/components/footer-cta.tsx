import { Button } from '@/components/ui/button';
import { ArrowRight, Send, Clock, FileText, CheckCircle2 } from 'lucide-react';

export function FooterCTA() {
    return (
        <section className="border-border border-t py-24">
            <div className="container mx-auto px-6">
                <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                            Have a raw idea? Let's map it out.
                        </h2>
                        <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
                            Send me a brief outline or a quick Loom video
                            explaining your concept. I'll review it and return a
                            clear technical roadmap and a precise estimate
                            within 24 hours. No commitment. No sales calls.
                        </p>
                        <Button
                            size="lg"
                            className="mt-8 px-8 text-base font-semibold"
                        >
                            Submit Your Idea
                            <ArrowRight className="ml-2 size-4" />
                        </Button>
                    </div>

                    <div className="flex justify-center lg:justify-end">
                        <div className="w-full max-w-sm space-y-3">
                            {/* Step 1 */}
                            <div className="group bg-card border-border hover:border-muted-foreground/30 relative flex items-center gap-4 rounded-xl border p-4 transition-colors">
                                <div className="bg-primary flex size-10 flex-shrink-0 items-center justify-center rounded-lg">
                                    <Send className="text-primary-foreground size-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-foreground text-sm font-medium">
                                        Submit your idea
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Loom, doc, or quick note
                                    </p>
                                </div>
                                <span className="text-muted-foreground/60 font-mono text-xs">
                                    01
                                </span>
                            </div>

                            {/* Step 2 */}
                            <div className="group bg-card border-border hover:border-muted-foreground/30 relative flex items-center gap-4 rounded-xl border p-4 transition-colors">
                                <div className="bg-secondary border-border flex size-10 flex-shrink-0 items-center justify-center rounded-lg border">
                                    <Clock className="text-muted-foreground size-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-foreground text-sm font-medium">
                                        24h turnaround
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        I review and scope it
                                    </p>
                                </div>
                                <span className="text-muted-foreground/60 font-mono text-xs">
                                    02
                                </span>
                            </div>

                            {/* Step 3 */}
                            <div className="group bg-card border-border hover:border-muted-foreground/30 relative flex items-center gap-4 rounded-xl border p-4 transition-colors">
                                <div className="bg-secondary border-border flex size-10 flex-shrink-0 items-center justify-center rounded-lg border">
                                    <FileText className="text-muted-foreground size-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-foreground text-sm font-medium">
                                        Get your roadmap
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Clear scope and estimate
                                    </p>
                                </div>
                                <span className="text-muted-foreground/60 font-mono text-xs">
                                    03
                                </span>
                            </div>

                            {/* Step 4 */}
                            <div className="group bg-card border-border hover:border-muted-foreground/30 relative flex items-center gap-4 rounded-xl border p-4 transition-colors">
                                <div className="bg-secondary border-border flex size-10 flex-shrink-0 items-center justify-center rounded-lg border">
                                    <CheckCircle2 className="text-muted-foreground size-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-foreground text-sm font-medium">
                                        Decide with confidence
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        No pressure, no sales calls
                                    </p>
                                </div>
                                <span className="text-muted-foreground/60 font-mono text-xs">
                                    04
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
