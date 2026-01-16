'use client';

import { FC } from 'react';
import { IProps } from './types';
import {
    Listbox,
    ListboxButton,
    ListboxOption,
    ListboxOptions,
} from '@headlessui/react';

const UiSelect: FC<IProps> = ({ options, label, value, onChange }) => {
    const selected = options.find((o) => o.value === value) ?? options[0];

    return (
        <Listbox
            value={selected?.value}
            onChange={async (val: string) => {
                await onChange(val);
            }}
        >
            <div className="relative w-max">
                <ListboxButton
                    aria-label={label}
                    className="bg-ash flex w-full items-center justify-between rounded-md px-2 py-1 text-sm font-medium text-zinc-800 dark:text-zinc-300"
                >
                    <div className="flex items-center gap-1.5">
                        {selected?.label}
                    </div>
                </ListboxButton>

                <ListboxOptions className="bg-ash absolute z-50 mt-1 w-max rounded-md shadow-lg ring-1 ring-black/10 focus:outline-none">
                    {options.map((opt) => (
                        <ListboxOption
                            key={opt.value}
                            value={opt.value}
                            className="data-[focus]:bg-graphite/20 data-[selected]:bg-graphite/10 cursor-pointer px-2 py-1 text-sm text-zinc-800 select-none dark:text-zinc-300"
                        >
                            <div className="flex items-center gap-1.5">
                                {opt.label}
                            </div>
                        </ListboxOption>
                    ))}
                </ListboxOptions>
            </div>
        </Listbox>
    );
};

export default UiSelect;
