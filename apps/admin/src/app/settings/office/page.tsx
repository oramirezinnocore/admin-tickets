'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import MapLocationPicker from '@/components/MapLocationPicker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export default function OfficeSettingsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const [officeAddress, setOfficeAddress] = useState('');
  const [officeLatitude, setOfficeLatitude] = useState<number | null>(null);
  const [officeLongitude, setOfficeLongitude] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Check authorization
    if (profile && profile.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }

    loadSettings();
  }, [profile, router]);

  async function loadSettings() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('organization_settings')
        .select('office_address, office_latitude, office_longitude')
        .single();

      if (error) {
        console.error('[OfficeSettings] Load error:', error);
        return;
      }

      if (data) {
        setOfficeAddress(data.office_address || '');
        setOfficeLatitude(data.office_latitude);
        setOfficeLongitude(data.office_longitude);
      }
    } catch (err: any) {
      console.error('[OfficeSettings] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleLocationSelect(latitude: number, longitude: number, address: string) {
    setOfficeLatitude(latitude);
    setOfficeLongitude(longitude);
    setOfficeAddress(address);
    setHasChanges(true);
    setShowMap(false);
  }

  function handleCancelMap() {
    setShowMap(false);
  }

  async function handleSave() {
    if (!officeLatitude || !officeLongitude) {
      alert('Selecciona una ubicación en el mapa antes de guardar');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('organization_settings')
        .update({
          office_address: officeAddress || null,
          office_latitude: officeLatitude,
          office_longitude: officeLongitude,
        })
        .eq('id', (await supabase.from('organization_settings').select('id').single()).data?.id);

      if (error) {
        throw error;
      }

      setHasChanges(false);
      alert('✓ Ubicación de oficina guardada correctamente');
    } catch (err: any) {
      console.error('[OfficeSettings] Save error:', err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setOfficeAddress('');
    setOfficeLatitude(null);
    setOfficeLongitude(null);
    setHasChanges(true);
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Cargando configuración...</div>
        </div>
      </ProtectedLayout>
    );
  }

  if (!profile || profile.role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <ProtectedLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración de oficina</h1>
          <p className="text-sm text-gray-600">
            Define la ubicación de tu oficina central para usarla como punto de referencia en el mapa operativo.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 space-y-6">
            {/* Location picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ubicación de oficina
              </label>

              {officeLatitude && officeLongitude ? (
                <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 mb-2">
                        {officeAddress || 'Ubicación configurada'}
                      </div>
                    </div>
                    <button
                      onClick={handleClear}
                      className="text-sm text-red-600 hover:text-red-700 font-medium ml-4"
                    >
                      Limpiar
                    </button>
                  </div>
                  <button
                    onClick={() => setShowMap(true)}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition"
                  >
                    Cambiar ubicación
                  </button>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                  <div className="text-sm text-gray-600 mb-3">
                    No hay una ubicación configurada.
                  </div>
                  <button
                    onClick={() => setShowMap(true)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition"
                  >
                    Seleccionar ubicación
                  </button>
                </div>
              )}
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 text-blue-600 text-xl">ℹ</div>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">¿Para qué sirve esto?</p>
                  <p>
                    El mapa operativo se centrará inicialmente en la ubicación de tu oficina. Esto facilita la visualización de técnicos y tickets alrededor de tu zona de operación.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              ← Volver al panel
            </button>
            <div className="flex gap-3">
              {hasChanges && (
                <span className="text-sm text-amber-600 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 bg-amber-500 rounded-full"></span>
                  Cambios sin guardar
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {saving ? 'Guardando...' : 'Guardar ubicación'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Map picker modal */}
      {showMap && (
        <MapLocationPicker
          initialLatitude={officeLatitude || undefined}
          initialLongitude={officeLongitude || undefined}
          initialAddress={officeAddress || undefined}
          onLocationSelect={handleLocationSelect}
          onCancel={handleCancelMap}
        />
      )}
    </ProtectedLayout>
  );
}
