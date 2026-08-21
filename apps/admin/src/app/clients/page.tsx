'use client';

import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MapLocationPicker from '@/components/MapLocationPicker';
import { supabase } from '@/lib/supabase';
import { Client, hasValidCoordinates } from '@wisper/shared';

type ClientFilter = 'active' | 'inactive' | 'all';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('active');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

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

  useEffect(() => {
    filterClients();
  }, [clients, searchQuery, filter]);

  async function loadClients() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function filterClients() {
    let filtered = clients;

    // Filter by status
    if (filter === 'active') {
      filtered = filtered.filter(c => c.is_active);
    } else if (filter === 'inactive') {
      filtered = filtered.filter(c => !c.is_active);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        c =>
          c.name.toLowerCase().includes(query) ||
          c.phone?.toLowerCase().includes(query) ||
          c.address.toLowerCase().includes(query)
      );
    }

    setFilteredClients(filtered);
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
          <button
            onClick={handleCreate}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Nuevo cliente
          </button>
        </div>

        <div className="flex gap-2">
          {(['active', 'inactive', 'all'] as ClientFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
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

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">{error}</div>
      )}

      {filteredClients.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No se encontraron clientes
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
              {filteredClients.map(client => (
                <tr key={client.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{client.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.phone || '-'}
                  </td>
                  <td className="px-6 py-4">{client.address}</td>
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
      )}

      <ClientFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          loadClients();
        }}
      />

      <ClientFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          setIsEditModalOpen(false);
          loadClients();
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
        address: client.address,
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
          onLocationSelect={(lat, lng) => {
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
