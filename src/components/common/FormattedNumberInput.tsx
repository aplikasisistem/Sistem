import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { formatThousand, parseThousand, getRawNumericString } from '../../utils/formatters';

export interface FormattedNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeValue?: (rawValue: number, rawString: string) => void;
  allowDecimal?: boolean;
}

export const FormattedNumberInput = React.forwardRef<HTMLInputElement, FormattedNumberInputProps>(
  (
    {
      value,
      onChange,
      onChangeValue,
      allowDecimal = false,
      placeholder,
      className,
      onFocus,
      onBlur,
      ...rest
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = (forwardedRef as React.RefObject<HTMLInputElement>) || internalRef;
    const cursorRef = useRef<number | null>(null);

    // Formatted display value
    const [displayVal, setDisplayVal] = useState<string>(() => formatThousand(value, allowDecimal));

    // Synchronize display when incoming `value` prop changes from outside
    useEffect(() => {
      const formatted = formatThousand(value, allowDecimal);
      setDisplayVal(prev => {
        // If current parsed display matches incoming value, avoid re-formatting while typing
        const currentRaw = getRawNumericString(prev, allowDecimal);
        const incomingRaw = getRawNumericString(value, allowDecimal);
        if (currentRaw === incomingRaw && prev !== '') {
          return prev;
        }
        return formatted;
      });
    }, [value, allowDecimal]);

    // Restore cursor position after formatting change
    useLayoutEffect(() => {
      if (inputRef.current && cursorRef.current !== null) {
        try {
          inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
        } catch {
          // ignore selection errors if element is not focusable
        }
        cursorRef.current = null;
      }
    }, [displayVal]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const rawTyped = input.value;
      const cursorPos = input.selectionStart || 0;

      // Count digits before cursor in typed input
      const digitsBeforeCursor = (rawTyped.slice(0, cursorPos).match(/\d/g) || []).length;

      // Clean raw string
      const rawString = getRawNumericString(rawTyped, allowDecimal);
      const rawNumber = parseThousand(rawString);

      // Formatted string for display
      const formatted = formatThousand(rawTyped, allowDecimal);
      setDisplayVal(formatted);

      // Calculate new cursor position in formatted string
      let count = 0;
      let newCursor = formatted.length;
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
          count++;
        }
        if (count === digitsBeforeCursor) {
          newCursor = i + 1;
          break;
        }
      }
      cursorRef.current = newCursor;

      // Trigger standard onChange with raw string in target.value
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: rawString,
            name: e.target.name,
          },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }

      // Trigger onChangeValue if provided
      if (onChangeValue) {
        onChangeValue(rawNumber, rawString);
      }
    };

    return (
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        value={displayVal}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className={className}
      />
    );
  }
);

FormattedNumberInput.displayName = 'FormattedNumberInput';
export default FormattedNumberInput;
