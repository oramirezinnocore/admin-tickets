'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface EvidencePreviewProps {
  evidenceId: string;
  fileUrl: string;
}

export function EvidencePreview({ evidenceId, fileUrl }: EvidencePreviewProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadSignedUrl();
  }, [fileUrl]);

  async function loadSignedUrl() {
    try {
      setLoading(true);
      setError(false);

      console.log('====================================');
      console.log('[EvidencePreview] START signed URL generation');
      console.log('[EvidencePreview] evidenceId:', evidenceId);
      console.log('[EvidencePreview] bucket: ticket-evidences');
      console.log('[EvidencePreview] raw fileUrl:', fileUrl);
      console.log('[EvidencePreview] fileUrl type:', typeof fileUrl);
      console.log('[EvidencePreview] fileUrl length:', fileUrl.length);

      // Normalize path - remove leading slash if present
      let normalizedPath = fileUrl;

      // Check for common issues
      if (fileUrl.startsWith('/')) {
        console.warn('[EvidencePreview] ⚠️ Path has leading slash, removing');
        normalizedPath = fileUrl.substring(1);
      }

      if (fileUrl.startsWith('ticket-evidences/')) {
        console.warn('[EvidencePreview] ⚠️ Path includes bucket name, removing');
        normalizedPath = fileUrl.replace('ticket-evidences/', '');
      }

      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        console.error('[EvidencePreview] ❌ Path is full URL, cannot use');
        throw new Error('fileUrl should be path, not URL');
      }

      console.log('[EvidencePreview] normalized path:', normalizedPath);
      console.log('[EvidencePreview] path format check:');
      console.log('[EvidencePreview]   - has slash:', normalizedPath.includes('/'));
      console.log('[EvidencePreview]   - starts with UUID:', /^[0-9a-f]{8}-[0-9a-f]{4}/.test(normalizedPath));
      console.log('====================================');

      // Attempt to create signed URL
      console.log('[EvidencePreview] Calling createSignedUrl...');
      const { data, error: urlError } = await supabase.storage
        .from('ticket-evidences')
        .createSignedUrl(normalizedPath, 3600); // 1 hour expiry

      if (urlError) {
        console.error('====================================');
        console.error('[EvidencePreview] createSignedUrl FAILED');
        console.error('[EvidencePreview] error.message:', urlError.message);
        console.error('[EvidencePreview] error.statusCode:', urlError.statusCode);
        console.error('[EvidencePreview] Full error:', JSON.stringify(urlError, null, 2));
        console.error('====================================');

        // Fallback: try download to verify path exists
        console.log('[EvidencePreview] Attempting download() as fallback test...');
        const { data: downloadData, error: downloadError } = await supabase.storage
          .from('ticket-evidences')
          .download(normalizedPath);

        if (downloadError) {
          console.error('[EvidencePreview] download() also FAILED:', downloadError.message);
          console.error('[EvidencePreview] This confirms path is incorrect or RLS is blocking');
        } else {
          console.log('[EvidencePreview] download() SUCCESS!');
          console.log('[EvidencePreview] File exists and is accessible via download');
          console.log('[EvidencePreview] This indicates signed URL generation issue, not path issue');
        }

        throw urlError;
      }

      console.log('====================================');
      console.log('[EvidencePreview] createSignedUrl SUCCESS');
      console.log('[EvidencePreview] signedUrl:', data.signedUrl);
      console.log('[EvidencePreview] URL length:', data.signedUrl.length);
      console.log('====================================');

      setSignedUrl(data.signedUrl);
    } catch (err: any) {
      console.error('====================================');
      console.error('[EvidencePreview] FATAL ERROR loading signed URL');
      console.error('[EvidencePreview] error.name:', err.name);
      console.error('[EvidencePreview] error.message:', err.message);
      console.error('====================================');
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="w-32 h-32 bg-gray-100 rounded-md animate-pulse flex items-center justify-center">
        <span className="text-xs text-gray-400">Cargando...</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="w-32 h-32 bg-gray-100 rounded-md flex items-center justify-center border border-gray-200">
        <div className="text-center px-2">
          <svg className="w-8 h-8 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-gray-500">No disponible</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="relative w-32 h-32 rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition group bg-gray-100"
        onClick={() => setShowModal(true)}
      >
        <img
          src={signedUrl}
          alt="Evidencia"
          className="w-full h-full object-cover block"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition pointer-events-none flex items-center justify-center">
          <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition z-10"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={signedUrl}
              alt="Evidencia completa"
              className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}

interface SignaturePreviewProps {
  signatureId: string;
  signatureUrl: string;
}

export function SignaturePreview({ signatureId, signatureUrl }: SignaturePreviewProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadSignedUrl();
  }, [signatureUrl]);

  async function loadSignedUrl() {
    try {
      setLoading(true);
      setError(false);

      console.log('====================================');
      console.log('[SignaturePreview] START signed URL generation');
      console.log('[SignaturePreview] signatureId:', signatureId);
      console.log('[SignaturePreview] bucket: ticket-signatures');
      console.log('[SignaturePreview] raw signatureUrl:', signatureUrl);
      console.log('[SignaturePreview] signatureUrl type:', typeof signatureUrl);
      console.log('[SignaturePreview] signatureUrl length:', signatureUrl.length);

      // Normalize path - remove leading slash if present
      let normalizedPath = signatureUrl;

      // Check for common issues
      if (signatureUrl.startsWith('/')) {
        console.warn('[SignaturePreview] ⚠️ Path has leading slash, removing');
        normalizedPath = signatureUrl.substring(1);
      }

      if (signatureUrl.startsWith('ticket-signatures/')) {
        console.warn('[SignaturePreview] ⚠️ Path includes bucket name, removing');
        normalizedPath = signatureUrl.replace('ticket-signatures/', '');
      }

      if (signatureUrl.startsWith('http://') || signatureUrl.startsWith('https://')) {
        console.error('[SignaturePreview] ❌ Path is full URL, cannot use');
        throw new Error('signatureUrl should be path, not URL');
      }

      console.log('[SignaturePreview] normalized path:', normalizedPath);
      console.log('[SignaturePreview] path format check:');
      console.log('[SignaturePreview]   - has slash:', normalizedPath.includes('/'));
      console.log('[SignaturePreview]   - starts with UUID:', /^[0-9a-f]{8}-[0-9a-f]{4}/.test(normalizedPath));
      console.log('[SignaturePreview]   - contains "signature":', normalizedPath.includes('signature'));
      console.log('====================================');

      // Attempt to create signed URL
      console.log('[SignaturePreview] Calling createSignedUrl...');
      const { data, error: urlError } = await supabase.storage
        .from('ticket-signatures')
        .createSignedUrl(normalizedPath, 3600); // 1 hour expiry

      if (urlError) {
        console.error('====================================');
        console.error('[SignaturePreview] createSignedUrl FAILED');
        console.error('[SignaturePreview] error.message:', urlError.message);
        console.error('[SignaturePreview] error.statusCode:', urlError.statusCode);
        console.error('[SignaturePreview] Full error:', JSON.stringify(urlError, null, 2));
        console.error('====================================');

        // Fallback: try download to verify path exists
        console.log('[SignaturePreview] Attempting download() as fallback test...');
        const { data: downloadData, error: downloadError } = await supabase.storage
          .from('ticket-signatures')
          .download(normalizedPath);

        if (downloadError) {
          console.error('[SignaturePreview] download() also FAILED:', downloadError.message);
          console.error('[SignaturePreview] This confirms path is incorrect or RLS is blocking');
        } else {
          console.log('[SignaturePreview] download() SUCCESS!');
          console.log('[SignaturePreview] File exists and is accessible via download');
          console.log('[SignaturePreview] This indicates signed URL generation issue, not path issue');
        }

        throw urlError;
      }

      console.log('====================================');
      console.log('[SignaturePreview] createSignedUrl SUCCESS');
      console.log('[SignaturePreview] signedUrl:', data.signedUrl);
      console.log('[SignaturePreview] URL length:', data.signedUrl.length);
      console.log('====================================');

      setSignedUrl(data.signedUrl);
    } catch (err: any) {
      console.error('====================================');
      console.error('[SignaturePreview] FATAL ERROR loading signed URL');
      console.error('[SignaturePreview] error.name:', err.name);
      console.error('[SignaturePreview] error.message:', err.message);
      console.error('====================================');
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="w-48 h-24 bg-gray-50 rounded-md border border-gray-200 animate-pulse flex items-center justify-center">
        <span className="text-xs text-gray-400">Cargando firma...</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="w-48 h-24 bg-gray-50 rounded-md border border-gray-200 flex items-center justify-center">
        <div className="text-center px-2">
          <svg className="w-6 h-6 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs text-gray-500">Firma no disponible</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="relative w-48 h-24 bg-white rounded-md border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-400 transition group"
        onClick={() => setShowModal(true)}
      >
        <img
          src={signedUrl}
          alt="Firma del cliente"
          className="w-full h-full object-contain p-2"
        />
        <div className="absolute inset-0 bg-blue-50 bg-opacity-0 group-hover:bg-opacity-30 transition flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="relative max-w-3xl w-full bg-white rounded-lg p-6">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 bg-gray-100 rounded-full p-2 hover:bg-gray-200 transition"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Firma del cliente</h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <img
                  src={signedUrl}
                  alt="Firma del cliente completa"
                  className="w-full h-auto max-h-96 object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
