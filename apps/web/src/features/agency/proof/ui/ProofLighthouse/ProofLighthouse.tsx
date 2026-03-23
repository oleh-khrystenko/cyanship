'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const CIRCUMFERENCE = 2 * Math.PI * 52;

const METRICS = [
    { key: 'performance', score: 100 },
    { key: 'accessibility', score: 100 },
    { key: 'best_practices', score: 100 },
    { key: 'seo', score: 100 },
] as const;

interface LighthouseGaugeProps {
    label: string;
    score: number;
    animated: boolean;
    delay: number;
}

const LighthouseGauge = ({ label, score, animated, delay }: LighthouseGaugeProps) => {
    const offset = animated ? CIRCUMFERENCE * (1 - score / 100) : CIRCUMFERENCE;

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative">
                <svg
                    viewBox="0 0 120 120"
                    className="h-24 w-24 sm:h-28 sm:w-28"
                    aria-hidden="true"
                >
                    <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        strokeWidth="8"
                        className="stroke-border opacity-20"
                    />
                    <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={offset}
                        className="stroke-success origin-center -rotate-90 motion-safe:transition-[stroke-dashoffset] motion-safe:duration-[1.5s] motion-safe:ease-out motion-reduce:!transition-none"
                        style={{ transitionDelay: `${delay}ms` }}
                    />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-foreground">
                    {animated ? score : 0}
                </span>
            </div>
            <span className="text-sm text-muted-foreground">{label}</span>
        </div>
    );
};

const ProofLighthouse = () => {
    const t = useTranslations('landing_page.dogfooding.proof_lighthouse');
    const [animated, setAnimated] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setAnimated(true), 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="flex h-full items-center justify-center">
            <div className="grid grid-cols-2 gap-6 sm:gap-8">
                {METRICS.map((metric, i) => (
                    <LighthouseGauge
                        key={metric.key}
                        label={t(metric.key)}
                        score={metric.score}
                        animated={animated}
                        delay={i * 150}
                    />
                ))}
            </div>
        </div>
    );
};

export default ProofLighthouse;
