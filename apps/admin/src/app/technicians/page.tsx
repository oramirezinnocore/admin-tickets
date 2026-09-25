'use client';

import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { Profile, Technician, UserRole } from '@wisper/shared';
import { useAuth } from '@/lib/auth-context';

interface PersonnelRecord extends Profile {
  technician?: Technician | null;
}

type PersonnelFilter = 'active' | 'inactive' | 'all';

export default function PersonnelPage() {
  const { profile: currentUserProfile } = useAuth();
  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [filteredPersonnel, setFilteredPersonnel] = useState<PersonnelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<PersonnelFilter>('active');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonnelRecord | null>(null);
  const [error, setError] = useState('');

  // Check if current user can manage personnel
  const canManagePersonnel = currentUserProfile?.role === UserRole.SUPER_ADMIN ||
                             currentUserProfile?.role === UserRole.ADMIN;

  const isReadOnly = !canManagePersonnel;

  useEffect(() => {
    loadPersonnel();
  }, []);

  useEffect(() => {
    filterPersonnel();
  }, [personnel, searchQuery, filter]);

  async function loadPersonnel() {
    try {
      setLoading(true);

      // Load profiles (exclude SUPER_ADMIN for SUPPORT users)
      let query = supabase
        .from('profiles')
        .select('*')
        .in('role', ['ADMIN', 'SUPPORT', 'TECHNICIAN']);

      // SUPPORT can see operational personnel only
      if (currentUserProfile?.role === UserRole.SUPPORT) {
        query = query.in('role', ['SUPPORT', 'TECHNICIAN']);
      }

      const { data: profiles, error: profilesError } = await query.order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Load technicians separately
      const { data: technicians, error: techniciansError } = await supabase
        .from('technicians')
        .select('*');

      if (techniciansError) throw techniciansError;

      // Merge data
      const merged = (profiles || []).map(profile => {
        const technician = (technicians || []).find(t => t.profile_id === profile.id);
        return {
          ...profile,
          technician: technician || null
        };
      });

      setPersonnel(merged);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function filterPersonnel() {
    let filtered = personnel;

    // Filter by status
    if (filter === 'active') {
      filtered = filtered.filter(p => p.is_active);
    } else if (filter === 'inactive') {
      filtered = filtered.filter(p => !p.is_active);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.full_name.toLowerCase().includes(query) ||
          p.email?.toLowerCase().includes(query) ||
          p.phone?.toLowerCase().includes(query) ||
          p.technician?.zone?.toLowerCase().includes(query)
      );
    }

    setFilteredPersonnel(filtered);
  }

  function handleCreate() {
    setSelectedPerson(null);
    setIsCreateModalOpen(true);
  }

  function handleEdit(person: PersonnelRecord) {
    setSelectedPerson(person);
    setIsEditModalOpen(true);
  }

  function handleDeactivate(person: PersonnelRecord) {
    setSelectedPerson(person);
    setIsDeleteDialogOpen(true);
  }

  async function confirmDeactivate() {
    if (!selectedPerson) return;

    try {
      const newActiveState = !selectedPerson.is_active;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_active: newActiveState })
        .eq('id', selectedPerson.id);

      if (profileError) throw profileError;

      // Update technician if exists
      if (selectedPerson.technician) {
        const { error: techError } = await supabase
          .from('technicians')
          .update({ is_active: newActiveState })
          .eq('id', selectedPerson.technician.id);

        if (techError) throw techError;
      }

      await loadPersonnel();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  function getRoleLabel(role: string): string {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'Super Admin';
      case UserRole.ADMIN:
        return 'Admin';
      case UserRole.SUPPORT:
        return 'Soporte';
      case UserRole.TECHNICIAN:
        return 'Técnico';
      default:
        return role;
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
        <h1 className="text-3xl font-bold mb-4">Personal</h1>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre, email, teléfono o zona..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-md"
          />
          {canManagePersonnel && (
            <button
              onClick={handleCreate}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Agregar personal
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {(['active', 'inactive', 'all'] as PersonnelFilter[]).map(f => (
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

      {filteredPersonnel.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No se encontró personal
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
                  Rol
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
                {canManagePersonnel && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPersonnel.map(person => (
                <tr key={person.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {person.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {person.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {person.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                      {getRoleLabel(person.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {person.technician?.zone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {person.technician?.vehicle || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        person.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {person.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {canManagePersonnel && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(person)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeactivate(person)}
                        className={
                          person.is_active
                            ? 'text-red-600 hover:text-red-900'
                            : 'text-green-600 hover:text-green-900'
                        }
                      >
                        {person.is_active ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManagePersonnel && (
        <>
          <CreatePersonnelModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={() => {
              setIsCreateModalOpen(false);
              loadPersonnel();
            }}
            callerRole={currentUserProfile?.role}
          />

          <EditPersonnelModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={() => {
              setIsEditModalOpen(false);
              loadPersonnel();
            }}
            person={selectedPerson}
            callerRole={currentUserProfile?.role}
          />

          <ConfirmDialog
            isOpen={isDeleteDialogOpen}
            onClose={() => setIsDeleteDialogOpen(false)}
            onConfirm={confirmDeactivate}
            title={
              selectedPerson?.is_active
                ? 'Desactivar personal'
                : 'Reactivar personal'
            }
            message={
              selectedPerson?.is_active
                ? `¿Desactivar a "${selectedPerson?.full_name}"? No podrá acceder a la aplicación.`
                : `¿Reactivar a "${selectedPerson?.full_name}"?`
            }
            confirmText={selectedPerson?.is_active ? 'Desactivar' : 'Reactivar'}
            isDestructive={selectedPerson?.is_active}
          />
        </>
      )}
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
        handleCopy();
      }
    } else {
      handleCopy();
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 p-4 rounded-md border border-green-200">
        <p className="text-green-800 font-medium">Personal creado correctamente</p>
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
          ⚠️ Esta contraseña solo se mostrará una vez. El usuario deberá cambiarla al iniciar sesión por primera vez.
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

interface CreatePersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  callerRole?: string;
}

function CreatePersonnelModal({ isOpen, onClose, onSuccess, callerRole }: CreatePersonnelModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: UserRole.TECHNICIAN,
    zone: '',
    vehicle: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);

  // Determine which roles the caller can create
  const availableRoles = callerRole === UserRole.SUPER_ADMIN
    ? [UserRole.ADMIN, UserRole.SUPPORT, UserRole.TECHNICIAN]
    : [UserRole.SUPPORT, UserRole.TECHNICIAN]; // ADMIN can create SUPPORT and TECHNICIAN

  useEffect(() => {
    if (isOpen) {
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        role: availableRoles[0] || UserRole.TECHNICIAN,
        zone: '',
        vehicle: '',
      });
      setError('');
      setCredentials(null);
    }
  }, [isOpen]);

  const isTechnicianRole = formData.role === UserRole.TECHNICIAN;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!formData.full_name.trim() || !formData.email.trim()) {
      setError('Nombre y email son obligatorios');
      return;
    }

    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No hay sesión activa');
        setSubmitting(false);
        return;
      }

      const response = await fetch('/api/personnel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          role: formData.role,
          zone: isTechnicianRole ? (formData.zone.trim() || null) : null,
          vehicle: isTechnicianRole ? (formData.vehicle.trim() || null) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError('Tu sesión expiró. Inicia sesión nuevamente.');
        } else if (response.status === 403) {
          setError(data.error || 'No tienes permisos para crear personal.');
        } else if (response.status === 409) {
          setError('Ya existe un usuario con ese correo electrónico.');
        } else {
          setError(data.error || 'No se pudo crear el personal.');
        }
        return;
      }

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

  if (credentials) {
    return (
      <Modal isOpen={isOpen} onClose={handleCredentialsClose} title="Personal creado">
        <CredentialsDisplay
          email={credentials.email}
          temporaryPassword={credentials.temporaryPassword}
          onClose={handleCredentialsClose}
        />
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agregar personal">
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
            Rol <span className="text-red-600">*</span>
          </label>
          <select
            value={formData.role}
            onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
            className="w-full px-3 py-2 border rounded-md"
            required
          >
            {availableRoles.map(role => (
              <option key={role} value={role}>
                {role === UserRole.ADMIN && 'Administrador'}
                {role === UserRole.SUPPORT && 'Soporte'}
                {role === UserRole.TECHNICIAN && 'Técnico'}
              </option>
            ))}
          </select>
        </div>

        {isTechnicianRole && (
          <>
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
          </>
        )}

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
            {submitting ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface EditPersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  person: PersonnelRecord | null;
  callerRole?: string;
}

function EditPersonnelModal({
  isOpen,
  onClose,
  onSuccess,
  person,
  callerRole,
}: EditPersonnelModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    newRole: '',
    zone: '',
    vehicle: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Determine available roles for transition
  const canChangeRole = callerRole === UserRole.SUPER_ADMIN ||
    (callerRole === UserRole.ADMIN &&
     person?.role !== UserRole.ADMIN &&
     person?.role !== UserRole.SUPER_ADMIN);

  const availableRoles = callerRole === UserRole.SUPER_ADMIN
    ? [UserRole.ADMIN, UserRole.SUPPORT, UserRole.TECHNICIAN]
    : [UserRole.SUPPORT, UserRole.TECHNICIAN];

  useEffect(() => {
    if (person) {
      setFormData({
        full_name: person.full_name || '',
        phone: person.phone || '',
        newRole: '',
        zone: person.technician?.zone || '',
        vehicle: person.technician?.vehicle || '',
      });
    }
    setError('');
  }, [person, isOpen]);

  const currentRole = formData.newRole || person?.role;
  const isTechnicianRole = currentRole === UserRole.TECHNICIAN;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!person) return;

    if (!formData.full_name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No hay sesión activa');
        setSubmitting(false);
        return;
      }

      const response = await fetch('/api/personnel', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: person.id,
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          newRole: formData.newRole || undefined,
          zone: isTechnicianRole ? (formData.zone.trim() || null) : undefined,
          vehicle: isTechnicianRole ? (formData.vehicle.trim() || null) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError('Tu sesión expiró. Inicia sesión nuevamente.');
        } else if (response.status === 403) {
          setError(data.error || 'No tienes permisos para editar este personal.');
        } else if (response.status === 409) {
          setError(data.error || 'Conflicto: el personal tiene tickets activos sin cerrar.');
        } else {
          setError(data.error || 'No se pudo actualizar el personal.');
        }
        return;
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar personal">
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

        {canChangeRole && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Cambiar rol
            </label>
            <select
              value={formData.newRole}
              onChange={e => setFormData({ ...formData, newRole: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">-- Mantener rol actual: {person?.role === UserRole.ADMIN ? 'Administrador' : person?.role === UserRole.SUPPORT ? 'Soporte' : 'Técnico'} --</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>
                  {role === UserRole.ADMIN && 'Administrador'}
                  {role === UserRole.SUPPORT && 'Soporte'}
                  {role === UserRole.TECHNICIAN && 'Técnico'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              ⚠️ Si el personal tiene tickets activos, no se podrá cambiar el rol
            </p>
          </div>
        )}

        {isTechnicianRole && (
          <>
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
          </>
        )}

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
