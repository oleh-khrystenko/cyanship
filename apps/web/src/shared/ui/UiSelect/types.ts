import { ReactNode } from 'react';

interface IOption {
    label: ReactNode;
    value: string;
}

export interface IProps {
    options: IOption[];
    label?: string;
    value: IOption['value'];
    onChange: (value: IOption['value']) => void;
}
