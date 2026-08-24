'use client';

import { useState } from 'react';

interface CredentialsDisplayProps {
  email: string;
  temporaryPassword: string;
  onClose: () => void;
  title?: string;
}

export default function CredentialsDisplay({
  email,
  temporaryPassword,
  onClose,
  title = 'Usuario creado correctamente',
}: CredentialsDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = `Correo: ${email}\nContraseña temporal: ${temporaryPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  }

  function handleShare() {
    const text = `Credenciales de acceso:\n\nCorreo: ${email}\nContraseña temporal: ${temporaryPassword}\n\nPor favor cambia tu contraseña en el primer inicio de sesión.`;
    if (navigator.share) {
      navigator
        .share({ text })
        .catch((error) => console.error('Error sharing:', error));
    } else {
      handleCopy();
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />

        <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-gray-200">
          <div className="p-8">
            {/* Icon */}
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
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
            </div>

            <h2 className="text-2xl font-bold text-center mb-2">{title}</h2>
            <p className="text-center text-gray-600 mb-6 text-sm">
              Estas credenciales se mostrarán una sola vez. Guárdalas de forma segura.
            </p>

            {/* Credentials */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo electrónico
                </label>
                <div className="bg-white px-3 py-2 rounded border border-gray-300 font-mono text-sm">
                  {email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña temporal
                </label>
                <div className="bg-white px-3 py-2 rounded border border-gray-300 font-mono text-sm tracking-wider">
                  {temporaryPassword}
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
              <p className="text-yellow-800 text-sm">
                ⚠️ El usuario deberá cambiar esta contraseña en su primer inicio de sesión.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                {copied ? 'Copiado ✓' : 'Copiar credenciales'}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Compartir
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-3 px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
