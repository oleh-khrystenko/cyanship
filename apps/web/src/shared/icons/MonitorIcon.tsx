import { IIconProps } from '@/shared/icons/types';

const MonitorIcon = ({ classes = 'h-5 w-5 stroke-ember' }: IIconProps) => {
    return (
        <svg
            className={`${classes} transition-all duration-300 ease-in-out`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect
                x="2"
                y="3"
                width="20"
                height="14"
                rx="2"
                strokeWidth="1.5"
            ></rect>
            <path d="M8 21H16" strokeWidth="1.5" strokeLinecap="round"></path>
            <path d="M12 17V21" strokeWidth="1.5" strokeLinecap="round"></path>
        </svg>
    );
};

export default MonitorIcon;
