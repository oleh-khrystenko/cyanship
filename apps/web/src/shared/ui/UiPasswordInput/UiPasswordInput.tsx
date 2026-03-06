'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import UiButton from '../UiButton';
import UiInput from '../UiInput';
import { composeClasses } from '@/shared/lib';
import type { UiPasswordInputProps } from './types';

const UiPasswordInput = forwardRef<HTMLInputElement, UiPasswordInputProps>(
    (props, ref) => {
        const {
            showLabel = 'Show password',
            hideLabel = 'Hide password',
            className,
            size = 'md',
            ...inputProps
        } = props;

        const [visible, setVisible] = useState(false);

        return (
            <div className="relative">
                <UiInput
                    {...inputProps}
                    ref={ref}
                    type={visible ? 'text' : 'password'}
                    size={size}
                    className={composeClasses('pr-12', className)}
                />
                <UiButton
                    variant="icon-compact"
                    size={size}
                    onClick={() => setVisible((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    aria-label={visible ? hideLabel : showLabel}
                    IconLeft={visible ? EyeOff : Eye}
                />
            </div>
        );
    }
);

UiPasswordInput.displayName = 'UiPasswordInput';

export default UiPasswordInput;
