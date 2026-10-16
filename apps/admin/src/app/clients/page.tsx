'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MapLocationPicker from '@/components/MapLocationPicker';
import ClientImportModal from '@/components/ClientImportModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Client, hasValidCoordinates, UserRole } from '@wisper/shared';

type ClientFilter = 'active' | 'inactive' | 'all';

export default function ClientsPage() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [error, setError] = useState('');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to page 1 when search changes
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Load clients when pagination params change
  useEffect(() => {
    loadClients();
  }, [currentPage, pageSize, filter, debouncedSearchQuery]);

  // Auto-open edit modal if edit parameter is present in URL
  useEffect(() => {
    if (typeof window !== 'undefined' && clients.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const editClientId = params.get('edit');
      if (editClientId) {
        const client = clients.find(c => c.id === editClientId);
        if (client) {
          handleEdit(client);
          // Clear the URL parameter
          window.history.replaceState({}, '', '/clients');
        }
      }
    }
  }, [clients]);

  async function loadClients() {
    try {
      setLoading(true);
      setError('');

      // Build query with filters
      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' });

      // Apply status filter
      if (filter === 'active') {
        query = query.eq('is_active', true);
      } else if (filter === 'inactive') {
        query = query.eq('is_active', false);
      }

      // Apply search filter
      if (debouncedSearchQuery) {
        const searchTerm = debouncedSearchQuery.toLowerCase();
        query = query.or(
          `name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%`
        );
      }

      // Apply pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setClients(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      setError(err.message);
      setClients([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setSelectedClient(null);
    setIsCreateModalOpen(true);
  }

  function handleEdit(client: Client) {
    setSelectedClient(client);
    setIsEditModalOpen(true);
  }

  function handleDeactivate(client: Client) {
    setSelectedClient(client);
    setIsDeleteDialogOpen(true);
  }

  async function confirmDeactivate() {
    if (!selectedClient) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: !selectedClient.is_active })
        .eq('id', selectedClient.id);

      if (error) throw error;
      await loadClients();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  function openInMaps(lat: number, lng: number) {
    window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`, '_blank');
  }

  function handleFilterChange(newFilter: ClientFilter) {
    setFilter(newFilter);
    setCurrentPage(1); // Reset to page 1 when filter changes
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to page 1 when page size changes
  }

  const totalPages = Math.ceil(totalCount / pageSize);
  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  function renderPaginationNumbers() {
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near start: 1 2 3 4 ... last
        pages.push(2, 3, 4);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near end: 1 ... last-3 last-2 last-1 last
        pages.push('ellipsis');
        pages.push(totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        // Middle: 1 ... current-1 current current+1 ... last
        pages.push('ellipsis');
        pages.push(currentPage - 1, currentPage, currentPage + 1);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }

    return pages;
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="text-center py-12">Cargando...</div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Clientes</h1>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o dirección..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-md"
          />
          <div className="flex gap-2">
            {profile?.role === UserRole.SUPER_ADMIN && (
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
              >
                Importar clientes
              </button>
            )}
            <button
              onClick={handleCreate}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Nuevo cliente
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {(['active', 'inactive', 'all'] as ClientFilter[]).map(f => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-4 py-2 rounded-md transition ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {f === 'active' && 'Activos'}
              {f === 'inactive' && 'Inactivos'}
              {f === 'all' && 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-gray-700 font-medium">
          Mostrar:
        </label>
        <select
          value={pageSize}
          onChange={(e) => handlePageSizeChange(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span className="text-sm text-gray-600">
          registros por página
        </span>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">{error}</div>
      )}

      {clients.length === 0 && !loading ? (
        <div className="text-center py-12 text-gray-500">
          No se encontraron clientes
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Teléfono
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Dirección
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clients.map(client => (
                  <tr key={client.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{client.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {client.phone || '-'}
                    </td>
                    <td className="px-6 py-4">{client.address || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          client.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {client.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {hasValidCoordinates(client.latitude, client.longitude) && (
                        <button
                          onClick={() => openInMaps(client.latitude!, client.longitude!)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Ubicación
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(client)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeactivate(client)}
                        className={
                          client.is_active
                            ? 'text-red-600 hover:text-red-900'
                            : 'text-green-600 hover:text-green-900'
                        }
                      >
                        {client.is_active ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Pagination info and controls */}
          {totalCount > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-6 py-4 rounded-lg shadow">
              {/* Info */}
              <div className="text-sm text-gray-700">
                Mostrando <span className="font-medium">{startRecord}</span>–
                <span className="font-medium">{endRecord}</span> de{' '}
                <span className="font-medium">{totalCount.toLocaleString()}</span> clientes
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  {/* Previous button */}
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                    }`}
                  >
                    Anterior
                  </button>

                  {/* Page numbers */}
                  <div className="hidden sm:flex items-center gap-1">
                    {renderPaginationNumbers().map((page, index) => {
                      if (page === 'ellipsis') {
                        return (
                          <span
                            key={`ellipsis-${index}`}
                            className="px-3 py-2 text-gray-500"
                          >
                            ...
                          </span>
                        );
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  {/* Mobile: current page indicator */}
                  <div className="sm:hidden text-sm text-gray-700">
                    <span className="font-medium">{currentPage}</span> / {totalPages}
                  </div>

                  {/* Next button */}
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                    }`}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ClientFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          setCurrentPage(1); // Reset to first page to see new client
          loadClients();
        }}
      />

      <ClientFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          setIsEditModalOpen(false);
          loadClients(); // Reload current page to see changes
        }}
        client={selectedClient}
      />

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeactivate}
        title={
          selectedClient?.is_active ? 'Desactivar cliente' : 'Reactivar cliente'
        }
        message={
          selectedClient?.is_active
            ? `¿Desactivar al cliente "${selectedClient?.name}"?`
            : `¿Reactivar al cliente "${selectedClient?.name}"?`
        }
        confirmText={selectedClient?.is_active ? 'Desactivar' : 'Reactivar'}
        isDestructive={selectedClient?.is_active}
      />

      <ClientImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setIsImportModalOpen(false);
          loadClients();
        }}
      />
    </ProtectedLayout>
  );
}

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client?: Client | null;
}

function ClientFormModal({ isOpen, onClose, onSuccess, client }: ClientFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    reference: '',
    latitude: '',
    longitude: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        phone: client.phone || '',
        address: client.address || '',
        reference: client.reference || '',
        latitude: client.latitude?.toString() || '',
        longitude: client.longitude?.toString() || '',
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        address: '',
        reference: '',
        latitude: '',
        longitude: '',
      });
    }
    setError('');
  }, [client, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.address.trim()) {
      setError('Nombre y dirección son obligatorios');
      return;
    }

    setSubmitting(true);

    try {
      // Parse coordinates
      const lat = formData.latitude ? parseFloat(formData.latitude) : null;
      const lng = formData.longitude ? parseFloat(formData.longitude) : null;

      // Validate coordinates if provided
      if ((lat !== null || lng !== null) && !hasValidCoordinates(lat, lng)) {
        setError('Las coordenadas proporcionadas no son válidas');
        return;
      }

      const payload: any = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        address: formData.address.trim(),
        reference: formData.reference.trim() || null,
        latitude: lat,
        longitude: lng,
      };

      if (client) {
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', client.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert(payload);
        if (error) throw error;
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={client ? 'Editar cliente' : 'Nuevo cliente'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Dirección <span className="text-red-600">*</span>
          </label>
          <textarea
            value={formData.address}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            rows={2}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Referencia</label>
          <input
            type="text"
            value={formData.reference}
            onChange={e => setFormData({ ...formData, reference: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Ubicación</label>
          {hasValidCoordinates(
            formData.latitude ? parseFloat(formData.latitude) : null,
            formData.longitude ? parseFloat(formData.longitude) : null
          ) ? (
            <div className="space-y-2">
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="text-sm font-medium text-green-800 mb-1">
                  ✓ Ubicación configurada
                </div>
                <div className="text-xs text-green-700 font-mono">
                  {parseFloat(formData.latitude).toFixed(6)}, {parseFloat(formData.longitude).toFixed(6)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm"
              >
                Cambiar ubicación
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMapPicker(true)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Seleccionar ubicación en mapa
            </button>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {submitting ? 'Guardando...' : client ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </form>

      {showMapPicker && (
        <MapLocationPicker
          initialLatitude={formData.latitude ? parseFloat(formData.latitude) : undefined}
          initialLongitude={formData.longitude ? parseFloat(formData.longitude) : undefined}
          onLocationSelect={(lat, lng, address) => {
            setFormData({
              ...formData,
              latitude: lat.toString(),
              longitude: lng.toString(),
            });
            setShowMapPicker(false);
          }}
          onCancel={() => setShowMapPicker(false)}
        />
      )}
    </Modal>
  );
}
