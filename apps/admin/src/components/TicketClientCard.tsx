'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Phone, MapPin, Navigation, Copy, Check, ExternalLink } from 'lucide-react';
import { Client, hasValidCoordinates } from '@wisper/shared';
import ClientMapPreview from './ClientMapPreview';

interface TicketClientCardProps {
  client: Client;
}

export default function TicketClientCard({ client }: TicketClientCardProps) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // RCA: Instance identity tracking
  const instanceIdRef = useRef(
    Math.random().toString(36).slice(2)
  );

  // RCA: Track every render
  console.log('[TICKET-CLIENT-CARD-RENDER]', instanceIdRef.current, { clientId: client.id });

  // RCA: Track mount/unmount
  useEffect(() => {
    console.log('[TICKET-CLIENT-CARD-MOUNT]', instanceIdRef.current);

    return () => {
      console.trace('[TICKET-CLIENT-CARD-UNMOUNT]', instanceIdRef.current);
    };
  }, []);

  const handleCopyPhone = async () => {
    if (!client.phone) return;
    try {
      await navigator.clipboard.writeText(client.phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch (err) {
      console.error('Error al copiar teléfono:', err);
    }
  };

  const handleCopyAddress = async () => {
    if (!client.address) return;
    try {
      await navigator.clipboard.writeText(client.address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error('Error al copiar dirección:', err);
    }
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`, '_blank');
  };

  const searchAddressInGoogleMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-100 text-violet-600">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Cliente</h2>
            <p className="text-base font-medium text-gray-700 truncate">{client.name}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Teléfono */}
        {client.phone && (
          <div className="flex items-start gap-3 group">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Teléfono
              </dt>
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${client.phone}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors duration-150 focus:outline-none focus:underline"
                >
                  {client.phone}
                </a>
                <button
                  onClick={handleCopyPhone}
                  className="p-1.5 rounded-md hover:bg-blue-100 text-blue-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 motion-reduce:transition-none"
                  title={copiedPhone ? 'Copiado' : 'Copiar teléfono'}
                  aria-label={copiedPhone ? 'Teléfono copiado' : 'Copiar teléfono'}
                >
                  {copiedPhone ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dirección */}
        <div className="flex items-start gap-3 group">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Dirección
            </dt>
            <div className="flex items-start gap-2">
              <dd className="flex-1 text-sm text-gray-900 leading-relaxed">
                {client.address}
              </dd>
              <button
                onClick={handleCopyAddress}
                className="flex-shrink-0 p-1.5 rounded-md hover:bg-green-100 text-green-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 motion-reduce:transition-none"
                title={copiedAddress ? 'Copiada' : 'Copiar dirección'}
                aria-label={copiedAddress ? 'Dirección copiada' : 'Copiar dirección'}
              >
                {copiedAddress ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Referencia */}
        {client.reference && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <Navigation className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Referencia
              </dt>
              <dd className="text-sm text-gray-900 leading-relaxed">
                {client.reference}
              </dd>
            </div>
          </div>
        )}

        {/* Mapa - PRESERVADO sin cambios */}
        <div className="pt-4 border-t border-gray-200">
          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Ubicación
          </dt>
          {hasValidCoordinates(client.latitude, client.longitude) ? (
            <div className="space-y-3">
              {/* ClientMapPreview preservado exactamente como está */}
              <ClientMapPreview
                latitude={client.latitude!}
                longitude={client.longitude!}
                clientName={client.name}
              />
              <button
                onClick={() => openInMaps(client.latitude!, client.longitude!)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 motion-reduce:transition-none"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir en el mapa
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600 mb-2">Ubicación no disponible</p>
                  {client.address && (
                    <button
                      onClick={() => searchAddressInGoogleMaps(client.address)}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors duration-150 focus:outline-none focus:underline"
                    >
                      <span>Buscar dirección en Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
