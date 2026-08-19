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

interface CredentialsDisplayProps {
  email: string;
  temporaryPassword: string;
  onClose: () => void;
}

function CredentialsDisplay({ email, temporaryPassword, onClose }: CredentialsDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const credentialsText = `Wisper Logística\n\nUsuario:\n${email}\n\nContraseña temporal:\n${temporaryPassword}\n\nAl iniciar sesión por primera vez, deberás crear una nueva contraseña.`;

  function handleCopy() {
    navigator.clipboard.writeText(credentialsText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Wisper Logística - Credenciales',
          text: credentialsText,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err) {
        // User cancelled or error - fall back to copy
        handleCopy();
      }
    } else {
      // Share API not available - fall back to copy
      handleCopy();
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 p-4 rounded-md border border-green-200">
        <p className="text-green-800 font-medium">El técnico fue creado correctamente</p>
      </div>

      <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3">Credenciales de acceso</h3>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600 mb-1">Correo electrónico:</p>
            <p className="font-mono text-sm bg-white px-3 py-2 rounded border">{email}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Contraseña temporal:</p>
            <p className="font-mono text-sm bg-white px-3 py-2 rounded border break-all">
              {temporaryPassword}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
        <p className="text-yellow-800 text-sm">
          ⚠️ Esta contraseña solo se mostrará una vez. El técnico deberá cambiarla al iniciar sesión por primera vez.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
        >
          {copied ? '✓ Copiado' : 'Copiar credenciales'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          {shared ? '✓ Compartido' : 'Compartir credenciales'}
        </button>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition"
        >
          Cerrar
        </button>
      </div>
    </div>
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
    zone: '',
    vehicle: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        zone: '',
        vehicle: '',
      });
      setError('');
      setCredentials(null);
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!formData.full_name.trim() || !formData.email.trim()) {
      setError('Nombre y email son obligatorios');
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
          zone: formData.zone.trim() || null,
          vehicle: formData.vehicle.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle different error status codes
        if (response.status === 401) {
          setError('Tu sesión expiró. Inicia sesión nuevamente.');
        } else if (response.status === 403) {
          setError(data.error || 'No tienes permisos para crear técnicos.');
        } else if (response.status === 500) {
          setError('Error del servidor. Intenta nuevamente.');
        } else {
          setError(data.error || 'No se pudo crear el técnico.');
        }
        return;
      }

      // Show credentials modal
      setCredentials({
        email: formData.email.trim(),
        temporaryPassword: data.temporaryPassword,
      });
    } catch (err: any) {
      setError(err.message || 'Error de conexión. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCredentialsClose() {
    setCredentials(null);
    onClose();
    onSuccess();
  }

  // Show credentials modal after successful creation
  if (credentials) {
    return (
      <Modal isOpen={isOpen} onClose={handleCredentialsClose} title="Técnico creado">
        <CredentialsDisplay
          email={credentials.email}
          temporaryPassword={credentials.temporaryPassword}
          onClose={handleCredentialsClose}
        />
      </Modal>
    );
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
