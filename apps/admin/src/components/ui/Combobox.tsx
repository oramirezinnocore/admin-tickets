'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
  searchText?: string;
  secondaryText?: string;
}

interface ComboboxProps {
  label?: string;
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  emptyMessage?: string;
  disabled?: boolean;
  error?: string;
}

export default function Combobox({
  label,
  required,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  value,
  options,
  onChange,
  emptyMessage = 'No se encontraron resultados',
  disabled = false,
  error,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;

    const query = searchQuery.toLowerCase();
    return options.filter(opt => {
      const searchText = opt.searchText || opt.label;
      return (
        searchText.toLowerCase().includes(query) ||
        opt.label.toLowerCase().includes(query) ||
        (opt.secondaryText && opt.secondaryText.toLowerCase().includes(query))
      );
    });
  }, [options, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  function handleOpen() {
    if (!disabled) {
      setIsOpen(true);
    }
  }

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}

      {/* Closed state: Display selected value */}
      {!isOpen ? (
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className={`w-full h-12 px-4 border rounded-lg text-left flex items-center justify-between transition-colors ${
            disabled
              ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200'
              : error
              ? 'border-red-300 hover:border-red-400 bg-white'
              : 'border-gray-300 hover:border-gray-400 bg-white'
          }`}
        >
          <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <svg
            className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      ) : (
        /* Open state: Search input */
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-12 pl-12 pr-4 border-2 rounded-lg focus:outline-none transition-colors bg-white text-gray-900 placeholder-gray-400"
            style={{
              borderColor: 'var(--wisper-blue)',
            }}
          />
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
          style={{ maxHeight: '280px' }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">{emptyMessage}</div>
            ) : (
              filteredOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                    option.value === value ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          option.value === value
                            ? 'text-[var(--wisper-blue)]'
                            : 'text-gray-900'
                        }`}
                      >
                        {option.label}
                      </p>
                      {option.secondaryText && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {option.secondaryText}
                        </p>
                      )}
                    </div>
                    {option.value === value && (
                      <svg
                        className="w-5 h-5 text-[var(--wisper-blue)] flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
