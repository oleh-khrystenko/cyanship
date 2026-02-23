import { ComponentType, InputHTMLAttributes, SVGProps } from 'react';

export type UiInputVariant = 'outlined' | 'filled';
export type UiInputSize = 'sm' | 'md' | 'lg';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface UiInputProps extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'size'
> {
    variant?: UiInputVariant;
    size?: UiInputSize;
    error?: string;
    IconLeft?: IconComponent;
    IconRight?: IconComponent;
}
