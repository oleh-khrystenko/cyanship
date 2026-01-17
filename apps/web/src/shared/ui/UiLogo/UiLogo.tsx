import Image from 'next/image';

const UiLogo = () => {
    return (
        <p className="flex items-center gap-0.5 text-5xl">
            <span data-darkreader-ignore suppressHydrationWarning>
                <Image
                    src="/favicon.svg"
                    alt="Logo"
                    width={40}
                    height={40}
                    priority
                    suppressHydrationWarning
                />
            </span>
            <span className="text-snow font-bold">Lucid Kit</span>
        </p>
    );
};

export default UiLogo;
