'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Ticket, Users, UserCog, FileText, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatTicketFolio } from '@wisper/shared';

interface SearchResult {
  id: string;
  type: 'ticket' | 'client' | 'technician' | 'navigation';
  title: string;
  subtitle?: string;
  path: string;
  icon: React.ElementType;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigationItems: SearchResult[] = [
    { id: 'nav-dashboard', type: 'navigation', title: 'Inicio', path: '/dashboard', icon: FileText },
    { id: 'nav-tickets', type: 'navigation', title: 'Tickets', path: '/tickets', icon: Ticket },
    { id: 'nav-clients', type: 'navigation', title: 'Clientes', path: '/clients', icon: Users },
    { id: 'nav-technicians', type: 'navigation', title: 'Personal', path: '/technicians', icon: UserCog },
    { id: 'nav-map', type: 'navigation', title: 'Mapa', path: '/map', icon: FileText },
    { id: 'nav-reports', type: 'navigation', title: 'Reportes', path: '/reports', icon: FileText },
  ];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setResults([]);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      const searchResults: SearchResult[] = [];
      const lowerQuery = query.toLowerCase();

      // Search navigation
      const navMatches = navigationItems.filter(item =>
        item.title.toLowerCase().includes(lowerQuery)
      );
      searchResults.push(...navMatches);

      // Search tickets
      try {
        const { data: tickets } = await supabase
          .from('tickets')
          .select('id, folio, status, client:clients(name)')
          .or(`folio.eq.${parseInt(query) || 0}`)
          .limit(5);

        if (tickets) {
          tickets.forEach(ticket => {
            searchResults.push({
              id: ticket.id,
              type: 'ticket',
              title: formatTicketFolio(ticket.folio),
              subtitle: (ticket.client as any)?.name || 'Sin cliente',
              path: `/tickets/${ticket.id}`,
              icon: Ticket
            });
          });
        }
      } catch (error) {
        console.error('Error searching tickets:', error);
      }

      // Search clients
      try {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name, phone')
          .ilike('name', `%${lowerQuery}%`)
          .eq('is_active', true)
          .limit(5);

        if (clients) {
          clients.forEach(client => {
            searchResults.push({
              id: client.id,
              type: 'client',
              title: client.name,
              subtitle: client.phone || undefined,
              path: `/clients?edit=${client.id}`,
              icon: Users
            });
          });
        }
      } catch (error) {
        console.error('Error searching clients:', error);
      }

      // Search technicians
      try {
        const { data: technicians } = await supabase
          .from('technicians')
          .select('id, profile:profiles(full_name, email)')
          .eq('is_active', true)
          .limit(5);

        if (technicians) {
          technicians.forEach(tech => {
            const profile = (tech.profile as any);
            if (profile?.full_name?.toLowerCase().includes(lowerQuery)) {
              searchResults.push({
                id: tech.id,
                type: 'technician',
                title: profile.full_name,
                subtitle: profile.email || undefined,
                path: `/technicians`,
                icon: UserCog
              });
            }
          });
        }
      } catch (error) {
        console.error('Error searching technicians:', error);
      }

      setResults(searchResults);
      setSelectedIndex(0);
      setLoading(false);
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      navigation: [],
      ticket: [],
      client: [],
      technician: []
    };

    results.forEach(result => {
      groups[result.type].push(result);
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [results]);

  function handleSelect(result: SearchResult) {
    router.push(result.path);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Command Palette */}
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar tickets, clientes, técnicos o navegar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 outline-none text-sm placeholder-gray-400"
            />
            {loading && (
              <div className="text-xs text-gray-500">Buscando...</div>
            )}
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {!query && (
              <div className="p-8 text-center text-gray-500 text-sm">
                Escribe para buscar tickets, clientes o técnicos
              </div>
            )}

            {query && results.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-500 text-sm">
                No se encontraron resultados para "{query}"
              </div>
            )}

            {groupedResults.map(([type, items], groupIndex) => (
              <div key={type}>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                  {type === 'navigation' && 'Navegación'}
                  {type === 'ticket' && 'Tickets'}
                  {type === 'client' && 'Clientes'}
                  {type === 'technician' && 'Técnicos'}
                </div>
                {items.map((result, index) => {
                  const globalIndex = groupedResults
                    .slice(0, groupIndex)
                    .reduce((acc, [_, items]) => acc + items.length, 0) + index;
                  const isSelected = globalIndex === selectedIndex;
                  const Icon = result.icon;

                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                        isSelected
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <div className={`p-2 rounded-lg ${
                        isSelected ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          isSelected ? 'text-blue-600' : 'text-gray-600'
                        }`} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-gray-900">
                          {result.title}
                        </div>
                        {result.subtitle && (
                          <div className="text-xs text-gray-500">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                      <ArrowRight className={`h-4 w-4 ${
                        isSelected ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↓</kbd>
                  navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↵</kbd>
                  seleccionar
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
