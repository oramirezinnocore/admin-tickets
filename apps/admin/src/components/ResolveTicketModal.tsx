'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';

interface ResolveTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  ticketFolio: string;
}

export default function ResolveTicketModal({
  isOpen,
  onClose,
  onConfirm,
  ticketFolio,
}: ResolveTicketModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!reason.trim()) {
      return;
    }

    if (!confirm(`¿Confirmas que deseas resolver el ticket ${ticketFolio}? Esta acción quedará registrada en la bitácora.`)) {
      return;
    }

    setLoading(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (error) {
      console.error('Error resolving ticket:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      setReason('');
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Resolver ticket">
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={handleClose}
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
            {loading ? 'Resolviendo...' : 'Confirmar resolución'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
