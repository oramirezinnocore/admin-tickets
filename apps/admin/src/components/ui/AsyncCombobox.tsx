'use client';

import { useState, useRef, useEffect } from 'react';

export interface AsyncComboboxOption {
  value: string;
  label: string;
  secondaryText?: string;
}

interface AsyncComboboxProps {
  label?: string;
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  value: string;
  selectedLabel?: string; // Display label for selected value
  selectedSecondary?: string; // Secondary text for selected value
  onSearch: (query: string) => Promise<AsyncComboboxOption[]>;
  onChange: (value: string, option: AsyncComboboxOption) => void;
  emptyMessage?: string;
  loadingMessage?: string;
  disabled?: boolean;
  error?: string;
  debounceMs?: number;
}

export default function AsyncCombobox({
  label,
  required,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  value,
  selectedLabel,
  selectedSecondary,
  onSearch,
  onChange,
  emptyMessage = 'No se encontraron resultados',
  loadingMessage = 'Buscando...',
  disabled = false,
  error,
  debounceMs = 300,
}: AsyncComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<AsyncComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchVersionRef = useRef(0); // For race condition protection

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

  // Load initial options when opening
  useEffect(() => {
    if (isOpen && options.length === 0 && !searchQuery) {
      performSearch('');
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, isOpen]);

  async function performSearch(query: string) {
    setLoading(true);
    const currentVersion = ++searchVersionRef.current;

    try {
      const results = await onSearch(query);

      // Race condition protection: only update if this is still the latest search
      if (currentVersion === searchVersionRef.current) {
        setOptions(results);
      }
    } catch (err) {
      console.error('Search error:', err);
      if (currentVersion === searchVersionRef.current) {
        setOptions([]);
      }
    } finally {
      if (currentVersion === searchVersionRef.current) {
        setLoading(false);
      }
    }
  }

  function handleOpen() {
    if (!disabled) {
      setIsOpen(true);
      setOptions([]);
      setSearchQuery('');
    }
  }

  function handleSelect(option: AsyncComboboxOption) {
    onChange(option.value, option);
    setIsOpen(false);
    setSearchQuery('');
  }

  const displayLabel = selectedLabel || placeholder;
  const hasSelection = Boolean(value && selectedLabel);

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
          className={`w-full min-h-12 px-4 py-2 border rounded-lg text-left flex items-start justify-between transition-colors ${
            disabled
              ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200'
              : error
              ? 'border-red-300 hover:border-red-400 bg-white'
              : 'border-gray-300 hover:border-gray-400 bg-white'
          }`}
        >
          <div className="flex-1 min-w-0">
            <span className={hasSelection ? 'text-gray-900' : 'text-gray-500'}>
              {displayLabel}
            </span>
            {hasSelection && selectedSecondary && (
              <p className="text-xs text-gray-500 mt-1 truncate">
                {selectedSecondary}
              </p>
            )}
          </div>
          <svg
            className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2 mt-0.5"
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
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                {loadingMessage}
              </div>
            ) : options.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                {emptyMessage}
              </div>
            ) : (
              options.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
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
