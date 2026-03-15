import Image from 'next/image';

const Logo = () => {
    return (
        <div className="flex items-center gap-2">
            <Image
                src="/logo-light-theme.svg"
                alt="LucidShip"
                width={32}
                height={33}
                className="block dark:hidden"
            />
            <Image
                src="/logo-dark-theme.svg"
                alt="LucidShip"
                width={32}
                height={33}
                className="hidden dark:block"
            />
            <span className="text-foreground text-2xl font-bold">
                LucidShip
            </span>
        </div>
    );
};

export default Logo;
