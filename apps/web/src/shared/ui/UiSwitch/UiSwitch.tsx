import { FC } from 'react';
import { Switch } from '@headlessui/react';
import { IProps } from '@/shared/ui/UiSwitch/types';

const UiSwitch: FC<IProps> = ({ checked, onChange, children }) => {
    return (
        <Switch
            style={{
                boxShadow:
                    'inset 0 2px 4px 0 rgba(0, 0, 0, 0.2), inset 0 0 4px 2px rgba(0, 0, 0, 0.2)',
            }}
            className={`${checked ? 'before:left-1' : 'before:left-6'} bg-ash relative flex h-6 w-12 items-center justify-between gap-2 rounded-full px-1.5 py-1 transition-all duration-300 ease-in-out before:absolute before:top-1/2 before:h-5 before:w-5 before:-translate-y-1/2 before:rounded-full before:bg-gradient-to-b before:from-stone-500 before:to-stone-700 before:transition-all before:duration-300 before:ease-in-out dark:before:from-stone-700 dark:before:to-stone-900`}
            checked={checked}
            onChange={onChange}
        >
            {children}
        </Switch>
    );
};

export default UiSwitch;
