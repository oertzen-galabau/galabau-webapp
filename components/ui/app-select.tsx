'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type AppSelectProps = {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
};

export function AppSelect({
  name,
  id,
  value,
  defaultValue = '',
  onValueChange,
  options,
  placeholder = '—',
  allowEmpty = true,
  disabled = false,
  required = false,
  className,
  'aria-label': ariaLabel,
}: AppSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value !== undefined ? value : internalValue;

  function pick(next: string) {
    if (value === undefined) setInternalValue(next);
    onValueChange?.(next);
  }

  const selected = options.find((option) => option.value === currentValue);
  const displayLabel = selected?.label ?? (currentValue === '' ? placeholder : currentValue);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn('app-select-trigger', className)}
        >
          <span className="app-select-trigger-label">{displayLabel}</span>
          <ChevronDown className="app-select-trigger-icon" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="app-select-content" align="start">
          <DropdownMenuGroup className="flex flex-col gap-0.5">
            {allowEmpty && !required && (
              <DropdownMenuItem
                onClick={() => pick('')}
                className={cn(
                  'app-select-item',
                  currentValue === '' && 'app-select-item--active',
                )}
              >
                {currentValue === '' && <Check className="app-select-item-check" />}
                <span className="flex-1">{placeholder}</span>
              </DropdownMenuItem>
            )}
            {options.map((option) => {
              const active = currentValue === option.value;
              return (
                <DropdownMenuItem
                  key={option.value}
                  disabled={option.disabled}
                  onClick={() => pick(option.value)}
                  className={cn('app-select-item', active && 'app-select-item--active')}
                >
                  {active && <Check className="app-select-item-check" />}
                  <span className="flex-1">{option.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {name && (
        <input
          type="hidden"
          name={name}
          value={currentValue}
          required={required && currentValue === '' ? true : undefined}
        />
      )}
    </>
  );
}
