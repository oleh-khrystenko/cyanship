import { ReactNode } from 'react';

export interface IProps {
    checked: boolean;
    onChange?: (event: boolean) => void;
    children?: ReactNode;
}
