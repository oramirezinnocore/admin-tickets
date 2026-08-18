'use client';

import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { Profile, Technician } from '@wisper/shared';

interface TechnicianWithProfile extends Technician {
  profile: Profile;
}

type TechnicianFilter = 'active' | 'inactive' | 'all';

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<TechnicianWithProfile[]>([]);
  const [filteredTechnicians, setFilteredTechnicians] = useState<TechnicianWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<TechnicianFilter>('active');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianWithProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTechnicians();
  }, []);

  useEffect(() => {
    filterTechnicians();
  }, [technicians, searchQuery, filter]);

  async function loadTechnicians() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('technicians')
        .select(`
          *,
          profile:profiles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTechnicians((data as any) || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function filterTechnicians() {
    let filtered = technicians;

    // Filter by status
    if (filter === 'active') {
      filtered = filtered.filter(t => t.is_active && t.profile?.is_active);
    } else if (filter === 'inactive') {
      filtered = filtered.filter(t => !t.is_active || !t.profile?.is_active);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        t =>
          t.profile?.full_name.toLowerCase().includes(query) ||
          t.profile?.email?.toLowerCase().includes(query) ||
          t.profile?.phone?.toLowerCase().includes(query) ||
          t.zone?.toLowerCase().includes(query)
      );
    }

    setFilteredTechnicians(filtered);
  }

  function handleCreate() {
    setSelectedTechnician(null);
    setIsCreateModalOpen(true);
  }

  function handleEdit(technician: TechnicianWithProfile) {
    setSelectedTechnician(technician);
    setIsEditModalOpen(true);
  }

  function handleDeactivate(technician: TechnicianWithProfile) {
    setSelectedTechnician(technician);
    setIsDeleteDialogOpen(true);
  }

  async function confirmDeactivate() {
    if (!selectedTechnician) return;

    try {
      const newActiveState = !selectedTechnician.is_active;

      // Update technician
      const { error: techError } = await supabase
        .from('technicians')
        .update({ is_active: newActiveState })
        .eq('id', selectedTechnician.id);

      if (techError) throw techError;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_active: newActiveState })
        .eq('id', selectedTechnician.profile_id);

      if (profileError) throw profileError;

      await loadTechnicians();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
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
        <h1 className="text-3xl font-bold mb-4">Técnicos</h1>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre, email, teléfono o zona..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-md"
          />
          <button
            onClick={handleCreate}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Nuevo técnico
          </button>
        </div>

        <div className="flex gap-2">
          {(['active', 'inactive', 'all'] as TechnicianFilter[]).map(f => (
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

      {filteredTechnicians.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No se encontraron técnicos
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
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Zona
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vehículo
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
              {filteredTechnicians.map(technician => (
                <tr key={technician.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {technician.profile?.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {technician.profile?.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {technician.profile?.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {technician.zone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {technician.vehicle || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        technician.is_active && technician.profile?.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {technician.is_active && technician.profile?.is_active
                        ? 'Activo'
                        : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEdit(technician)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeactivate(technician)}
                      className={
                        technician.is_active
                          ? 'text-red-600 hover:text-red-900'
                          : 'text-green-600 hover:text-green-900'
                      }
                    >
                      {technician.is_active ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTechnicianModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          loadTechnicians();
        }}
      />

      <EditTechnicianModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          setIsEditModalOpen(false);
          loadTechnicians();
        }}
        technician={selectedTechnician}
      />

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeactivate}
        title={
          selectedTechnician?.is_active
            ? 'Desactivar técnico'
            : 'Reactivar técnico'
        }
        message={
          selectedTechnician?.is_active
            ? `¿Desactivar al técnico "${selectedTechnician?.profile?.full_name}"? No podrá acceder a la aplicación.`
            : `¿Reactivar al técnico "${selectedTechnician?.profile?.full_name}"?`
        }
        confirmText={selectedTechnician?.is_active ? 'Desactivar' : 'Reactivar'}
        isDestructive={selectedTechnician?.is_active}
      />
    </ProtectedLayout>
  );
}

interface CreateTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateTechnicianModal({ isOpen, onClose, onSuccess }: CreateTechnicianModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    zone: '',
    vehicle: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        zone: '',
        vehicle: '',
      });
      setError('');
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!formData.full_name.trim() || !formData.email.trim() || !formData.password) {
      setError('Nombre, email y contraseña son obligatorios');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSubmitting(true);

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No hay sesión activa');
        setSubmitting(false);
        return;
      }

      // Call API endpoint
      const response = await fetch('/api/technicians', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          password: formData.password,
          zone: formData.zone.trim() || null,
          vehicle: formData.vehicle.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error creating technician');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo técnico">
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
            value={formData.full_name}
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Email <span className="text-red-600">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
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
            Contraseña temporal <span className="text-red-600">*</span>
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            required
            minLength={6}
          />
          <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Zona</label>
          <input
            type="text"
            value={formData.zone}
            onChange={e => setFormData({ ...formData, zone: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Vehículo</label>
          <input
            type="text"
            value={formData.vehicle}
            onChange={e => setFormData({ ...formData, vehicle: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
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
            {submitting ? 'Creando...' : 'Crear técnico'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface EditTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  technician: TechnicianWithProfile | null;
}

function EditTechnicianModal({
  isOpen,
  onClose,
  onSuccess,
  technician,
}: EditTechnicianModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    zone: '',
    vehicle: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (technician) {
      setFormData({
        full_name: technician.profile?.full_name || '',
        phone: technician.profile?.phone || '',
        zone: technician.zone || '',
        vehicle: technician.vehicle || '',
      });
    }
    setError('');
  }, [technician, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!technician) return;

    if (!formData.full_name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setSubmitting(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
        })
        .eq('id', technician.profile_id);

      if (profileError) throw profileError;

      // Update technician
      const { error: techError } = await supabase
        .from('technicians')
        .update({
          zone: formData.zone.trim() || null,
          vehicle: formData.vehicle.trim() || null,
        })
        .eq('id', technician.id);

      if (techError) throw techError;

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar técnico">
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
            value={formData.full_name}
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
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
          <label className="block text-sm font-medium mb-1">Zona</label>
          <input
            type="text"
            value={formData.zone}
            onChange={e => setFormData({ ...formData, zone: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Vehículo</label>
          <input
            type="text"
            value={formData.vehicle}
            onChange={e => setFormData({ ...formData, vehicle: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
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
            {submitting ? 'Guardando...' : 'Actualizar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
