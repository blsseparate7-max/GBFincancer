
import React, { useState, useEffect, useCallback } from 'react';

interface MoneyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const MoneyInput: React.FC<MoneyInputProps> = ({ 
  value, 
  onChange, 
  placeholder = 'R$ 0,00', 
  className = '',
  autoFocus = false,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState('');

  const formatCurrency = useCallback((val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(val);
  }, []);

  useEffect(() => {
    // Sync internal state with external value prop
    if (value === 0 && displayValue === '') return;
    const formatted = formatCurrency(value);
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
  }, [value, formatCurrency, displayValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numberValue = parseInt(rawValue, 10) / 100;
    
    if (isNaN(numberValue)) {
      onChange(0);
      setDisplayValue('');
    } else {
      onChange(numberValue);
      setDisplayValue(formatCurrency(numberValue));
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      autoFocus={autoFocus}
      {...props}
    />
  );
};

export default MoneyInput;
