'use client';

import { useState, useRef, useEffect } from 'react';
import Modal from '@/components/ui/Modal';

interface ResolveTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, evidenceFile?: File) => Promise<void>;
  ticketFolio: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export default function ResolveTicketModal({
  isOpen,
  onClose,
  onConfirm,
  ticketFolio,
}: ResolveTicketModalProps) {
  const [reason, setReason] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WEBP');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('La imagen no debe superar 5 MB');
      return;
    }

    setError('');
    setEvidenceFile(file);

    // Create preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  function handleRemoveFile() {
    setEvidenceFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!reason.trim()) {
      setError('El motivo es obligatorio');
      return;
    }

    // Prevent double submission
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      await onConfirm(reason.trim(), evidenceFile || undefined);
      setSuccess(true);

      // Auto-close after 1.5 seconds
      setTimeout(() => {
        handleCloseComplete();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'No se pudo resolver el ticket');
      setLoading(false);
    }
  }

  function handleCloseComplete() {
    if (!loading) {
      setReason('');
      handleRemoveFile();
      setError('');
      setSuccess(false);
      onClose();
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen && !success}
        onClose={handleCloseComplete}
        title="Resolver ticket"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Motivo / Justificación *
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explica por qué se resuelve administrativamente (ej: cliente canceló por teléfono, duplicado, error operativo...)"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Esta información quedará registrada en la bitácora del ticket.
            </p>
          </div>

          {/* Evidence upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evidencia (opcional)
            </label>

            {!evidenceFile && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileSelect}
                  disabled={loading}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Seleccionar imagen
                </button>
                <p className="mt-1 text-xs text-gray-500">
                  JPG, PNG o WEBP. Máximo 5 MB.
                </p>
              </div>
            )}

            {evidenceFile && previewUrl && (
              <div className="border border-gray-200 rounded-md p-3">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded mb-2"
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 truncate flex-1">
                    {evidenceFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={loading}
                    className="ml-2 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={handleCloseComplete}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Resolviendo...' : 'Resolver ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Success state */}
      {success && (
        <Modal isOpen={true} onClose={handleCloseComplete} title="Éxito">
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-md">
              <span className="text-2xl">✓</span>
              <p className="text-sm font-medium text-green-800">
                Ticket resuelto correctamente
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
