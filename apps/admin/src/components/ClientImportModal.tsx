'use client';

import { useState, useRef } from 'react';
import Modal from './ui/Modal';

interface ValidationResult {
  row: number;
  data: {
    name: string;
    address: string;
    phone?: string;
    reference?: string;
    latitude?: string;
    longitude?: string;
  };
  errors: string[];
  isValid: boolean;
}

interface ValidationResponse {
  success: boolean;
  total: number;
  valid: number;
  invalid: number;
  results: ValidationResult[];
  canImport: boolean;
}

interface ImportResponse {
  success: boolean;
  imported: number;
  error?: string;
}

interface ClientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClientImportModal({
  isOpen,
  onClose,
  onSuccess,
}: ClientImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    setFile(null);
    setValidationResult(null);
    setError('');
    setSuccessMessage('');
    onClose();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Por favor selecciona un archivo CSV válido');
        return;
      }
      setFile(selectedFile);
      setValidationResult(null);
      setError('');
      setSuccessMessage('');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type !== 'text/csv' && !droppedFile.name.endsWith('.csv')) {
        setError('Por favor selecciona un archivo CSV válido');
        return;
      }
      setFile(droppedFile);
      setValidationResult(null);
      setError('');
      setSuccessMessage('');
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleValidate() {
    if (!file) return;

    setValidating(true);
    setError('');

    try {
      const csvContent = await file.text();

      const response = await fetch('/api/clients/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'validate',
          csvContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al validar el archivo');
      }

      setValidationResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  }

  async function handleImport() {
    if (!validationResult || !validationResult.canImport) return;

    setImporting(true);
    setError('');

    try {
      const response = await fetch('/api/clients/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'import',
          validatedRows: validationResult.results.filter(r => r.isValid),
        }),
      });

      const data: ImportResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al importar clientes');
      }

      setSuccessMessage(`✓ ${data.imported} clientes importados exitosamente`);
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const template = `name,address,phone,reference
Juan Pérez,Calle Principal 123,3121234567,Cerca del mercado
María González,Avenida Reforma 456,3129876543,Edificio azul`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla-clientes.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar clientes">
      <div className="space-y-4">
        {/* Template Download */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">Plantilla CSV</p>
              <p className="text-xs text-blue-700 mt-1">
                Descarga la plantilla con los campos requeridos y ejemplos.
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
            >
              Descargar plantilla
            </button>
          </div>
        </div>

        {/* File Upload Area */}
        {!file && !validationResult && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="text-gray-600">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-4 text-sm font-medium">
                Arrastra tu archivo aquí o haz clic para seleccionar
              </p>
              <p className="mt-1 text-xs text-gray-500">CSV hasta 1,000 registros</p>
            </div>
          </div>
        )}

        {/* File Selected */}
        {file && !validationResult && (
          <div className="border border-gray-300 rounded-md p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <svg
                  className="h-10 w-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <button
              onClick={handleValidate}
              disabled={validating}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              {validating ? 'Validando...' : 'Validar archivo'}
            </button>
          </div>
        )}

        {/* Validation Results */}
        {validationResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-md p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {validationResult.total}
                </p>
                <p className="text-xs text-gray-600">Registros</p>
              </div>
              <div className="bg-green-50 rounded-md p-3 text-center">
                <p className="text-2xl font-bold text-green-900">
                  {validationResult.valid}
                </p>
                <p className="text-xs text-green-700">Válidos</p>
              </div>
              <div className="bg-red-50 rounded-md p-3 text-center">
                <p className="text-2xl font-bold text-red-900">
                  {validationResult.invalid}
                </p>
                <p className="text-xs text-red-700">Con errores</p>
              </div>
            </div>

            {/* Preview Table */}
            <div className="max-h-64 overflow-auto border rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Fila
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Cliente
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Dirección
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {validationResult.results.map(result => (
                    <tr key={result.row} className={result.isValid ? '' : 'bg-red-50'}>
                      <td className="px-3 py-2 text-sm text-gray-900">{result.row}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">
                        {result.data.name}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        {result.data.address}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {result.isValid ? (
                          <span className="text-green-600 font-medium">✓ Válido</span>
                        ) : (
                          <div className="text-red-600 text-xs">
                            {result.errors.map((err, idx) => (
                              <div key={idx}>• {err}</div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!validationResult.canImport && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800 font-medium">
                  No se puede importar el archivo
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Corrige los errores en el archivo CSV e inténtalo nuevamente.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="p-3 bg-green-50 text-green-600 rounded-md text-sm font-medium">
            {successMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={handleClose}
            disabled={importing}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {successMessage ? 'Cerrar' : 'Cancelar'}
          </button>
          {validationResult && validationResult.canImport && !successMessage && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50"
            >
              {importing ? 'Importando...' : 'Importar clientes'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Import supabase client
import { supabase } from '@/lib/supabase';
