'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CredentialsDisplay from '@/components/CredentialsDisplay';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Profile, canManageAdministrators } from '@wisper/shared';

type AdminFilter = 'active' | 'inactive' | 'all';

interface NewAdminCredentials {
  email: string;
  temporaryPassword: string;
}

export default function AdministratorsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [administrators, setAdministrators] = useState<Profile[]>([]);
  const [filteredAdmins, setFilteredAdmins] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<AdminFilter>('active');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Profile | null>(null);
  const [newCredentials, setNewCredentials] = useState<NewAdminCredentials | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');

  // Security check
  useEffect(() => {
    if (profile && !canManageAdministrators(profile.role)) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (profile && canManageAdministrators(profile.role)) {
      loadAdministrators();
    }
  }, [profile]);

  useEffect(() => {
    filterAdmins();
  }, [administrators, searchQuery, filter]);

  async function loadAdministrators() {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch('/api/administrators', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar administradores');
      }

      setAdministrators(data.administrators || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function filterAdmins() {
    let filtered = administrators;

    // Filter by status
    if (filter === 'active') {
      filtered = filtered.filter(a => a.is_active);
    } else if (filter === 'inactive') {
      filtered = filtered.filter(a => !a.is_active);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        a =>
          a.full_name.toLowerCase().includes(query) ||
          a.email?.toLowerCase().includes(query) ||
          a.phone?.toLowerCase().includes(query)
      );
    }

    setFilteredAdmins(filtered);
  }

  function handleCreate() {
    setSelectedAdmin(null);
    setIsCreateModalOpen(true);
  }

  function handleEdit(admin: Profile) {
    setSelectedAdmin(admin);
    setIsEditModalOpen(true);
  }

  function handleToggleActive(admin: Profile) {
    setSelectedAdmin(admin);
    setIsToggleDialogOpen(true);
  }

  function handleResetPassword(admin: Profile) {
    setSelectedAdmin(admin);
    setIsResetDialogOpen(true);
  }

  async function confirmResetPassword() {
    if (!selectedAdmin) return;

    try {
      setResetLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(`/api/administrators/${selectedAdmin.id}/reset-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al restablecer contraseña');
      }

      // Show credentials
      setNewCredentials({
        email: data.email,
        temporaryPassword: data.temporaryPassword,
      });

      setIsResetDialogOpen(false);
      await loadAdministrators();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setResetLoading(false);
    }
  }

  async function confirmToggleActive() {
    if (!selectedAdmin) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch('/api/administrators', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: selectedAdmin.id,
          isActive: !selectedAdmin.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar administrador');
      }

      await loadAdministrators();
      setIsToggleDialogOpen(false);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  if (!profile || !canManageAdministrators(profile.role)) {
    return null;
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
        <h1 className="text-3xl font-bold mb-2">Administradores</h1>
        <p className="text-gray-600 mb-6">
          Gestiona las personas que pueden acceder al panel administrativo.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-md"
          />
          <button
            onClick={handleCreate}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
          >
            + Nuevo administrador
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              filter === 'active'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border hover:bg-gray-50'
            }`}
          >
            Activos ({administrators.filter(a => a.is_active).length})
          </button>
          <button
            onClick={() => setFilter('inactive')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              filter === 'inactive'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border hover:bg-gray-50'
            }`}
          >
            Inactivos ({administrators.filter(a => !a.is_active).length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border hover:bg-gray-50'
            }`}
          >
            Todos ({administrators.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAdmins.map(admin => {
          const roleLabel = admin.role === 'SUPER_ADMIN' ? 'Superadministrador' : 'Administrador';
          const canReset = admin.role === 'ADMIN';

          return (
            <div key={admin.id} className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{admin.full_name}</h3>
                  <p className="text-sm text-gray-600">{admin.email}</p>
                  {admin.phone && <p className="text-sm text-gray-600">{admin.phone}</p>}
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    admin.role === 'SUPER_ADMIN'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {roleLabel}
                </span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    admin.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {admin.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="text-xs text-gray-500 mb-4">
                Creado: {new Date(admin.created_at).toLocaleDateString()}
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(admin)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(admin)}
                    className={`flex-1 px-3 py-2 text-sm rounded-md transition ${
                      admin.is_active
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {admin.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
                {canReset && (
                  <button
                    onClick={() => handleResetPassword(admin)}
                    className="w-full px-3 py-2 text-sm border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50 transition"
                  >
                    Restablecer contraseña
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredAdmins.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No se encontraron administradores.
        </div>
      )}

      <CreateAdminModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(credentials) => {
          setNewCredentials(credentials);
          setIsCreateModalOpen(false);
          loadAdministrators();
        }}
      />

      <EditAdminModal
        isOpen={isEditModalOpen && selectedAdmin !== null}
        admin={selectedAdmin}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedAdmin(null);
        }}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setSelectedAdmin(null);
          loadAdministrators();
        }}
      />

      <ConfirmDialog
        isOpen={isToggleDialogOpen && selectedAdmin !== null}
        isDestructive={selectedAdmin?.is_active}
        title={selectedAdmin?.is_active ? 'Desactivar administrador' : 'Activar administrador'}
        message={
          selectedAdmin?.is_active
            ? `¿Estás seguro de desactivar a ${selectedAdmin.full_name}? No podrá acceder al sistema.`
            : `¿Estás seguro de activar a ${selectedAdmin?.full_name}?`
        }
        confirmText={selectedAdmin?.is_active ? 'Desactivar' : 'Activar'}
        cancelText="Cancelar"
        onConfirm={confirmToggleActive}
        onClose={() => {
          setIsToggleDialogOpen(false);
          setSelectedAdmin(null);
        }}
      />

      <ConfirmDialog
        isOpen={isResetDialogOpen && selectedAdmin !== null}
        title="Restablecer contraseña"
        message={`¿Estás seguro de restablecer la contraseña de ${selectedAdmin?.full_name}? Se generará una nueva contraseña temporal y el administrador deberá cambiarla en su próximo inicio de sesión.`}
        confirmText={resetLoading ? 'Restableciendo...' : 'Restablecer'}
        cancelText="Cancelar"
        onConfirm={confirmResetPassword}
        onClose={() => {
          setIsResetDialogOpen(false);
          setSelectedAdmin(null);
        }}
      />

      {newCredentials && (
        <CredentialsDisplay
          email={newCredentials.email}
          temporaryPassword={newCredentials.temporaryPassword}
          onClose={() => setNewCredentials(null)}
          title={newCredentials.email.includes('creado') ? 'Administrador creado correctamente' : 'Contraseña restablecida'}
        />
      )}
    </ProtectedLayout>
  );
}

function CreateAdminModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (credentials: NewAdminCredentials) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch('/api/administrators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fullName,
          email,
          phone: phone || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear administrador');
      }

      onSuccess({
        email: data.administrator.email,
        temporaryPassword: data.temporaryPassword,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} title="Nuevo administrador" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Nombre completo *</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Correo electrónico *</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-md border border-blue-200">
          Se generará automáticamente una contraseña temporal segura. El administrador deberá crear una nueva contraseña en su primer inicio de sesión.
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? 'Creando...' : 'Crear administrador'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditAdminModal({
  isOpen,
  admin,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  admin: Profile | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  if (!admin) return null;
  const [fullName, setFullName] = useState(admin.full_name);
  const [phone, setPhone] = useState(admin.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      if (!admin) return;

      const response = await fetch('/api/administrators', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: admin.id,
          fullName,
          phone: phone || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar administrador');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} title="Editar administrador" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Nombre completo *</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Correo electrónico</label>
          <input
            type="email"
            value={admin?.email || ''}
            className="w-full px-3 py-2 border rounded-md bg-gray-100"
            disabled
          />
          <p className="text-xs text-gray-500 mt-1">El correo no se puede modificar</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
