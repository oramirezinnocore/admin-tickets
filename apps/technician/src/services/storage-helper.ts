import { supabase } from './supabase';

export async function uploadEvidence(
  ticketId: string,
  imageUri: string,
  latitude: number | null,
  longitude: number | null,
  userId: string
): Promise<{ success: boolean; error?: string; evidenceId?: string }> {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const extension = imageUri.split('.').pop() || 'jpg';
    const fileName = `${ticketId}/${timestamp}-${random}.${extension}`;

    // Convert URI to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // ============================================================================
    // UPLOAD START - Log all parameters
    // ============================================================================
    console.log('====================================');
    console.log('[Evidence] Upload START');
    console.log('[Evidence] ticketId:', ticketId);
    console.log('[Evidence] bucket: ticket-evidences');
    console.log('[Evidence] path:', fileName);
    console.log('[Evidence] blob size:', blob.size, 'bytes');
    console.log('[Evidence] blob type:', blob.type);
    console.log('====================================');

    // ============================================================================
    // STORAGE UPLOAD
    // ============================================================================
    console.log('[Evidence] Attempting Storage upload...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ticket-evidences')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('====================================');
      console.error('[Evidence] Storage upload FAILED');
      console.error('[Evidence] message:', uploadError.message);
      console.error('[Evidence] statusCode:', uploadError.statusCode);
      console.error('[Evidence] UPLOAD REQUEST PATH:', fileName);
      console.error('[Evidence] Error details:', JSON.stringify(uploadError));
      console.error('====================================');
      console.error('[Evidence] STOPPING - NO DB INSERT will be performed');
      throw uploadError;
    }

    console.log('====================================');
    console.log('[Evidence] Storage upload SUCCESS');
    console.log('[Evidence] UPLOAD REQUEST PATH:', fileName);
    console.log('[Evidence] UPLOAD RESPONSE PATH:', uploadData?.path || 'NO PATH IN RESPONSE');
    console.log('[Evidence] upload response data:', JSON.stringify(uploadData));
    console.log('====================================');

    // ============================================================================
    // POST-UPLOAD VERIFICATION - Critical to prevent orphaned DB records
    // ============================================================================
    console.log('[Evidence] POST-UPLOAD VERIFICATION - Downloading to confirm object exists...');

    // Use the path from upload response if available, otherwise use fileName
    const verifyPath = uploadData?.path || fileName;
    console.log('[Evidence] Verification path:', verifyPath);

    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('ticket-evidences')
      .download(verifyPath);

    if (downloadError) {
      console.error('====================================');
      console.error('[Evidence] POST-UPLOAD DOWNLOAD FAILED');
      console.error('[Evidence] ❌ CRITICAL: Upload reported success but object not found in Storage');
      console.error('[Evidence] This indicates a Storage backend issue');
      console.error('[Evidence] download error:', downloadError.message);
      console.error('[Evidence] attempted path:', verifyPath);
      console.error('====================================');
      console.error('[Evidence] STOPPING - Will NOT create DB record for non-existent file');

      // Try to cleanup the supposedly uploaded file
      console.log('[Evidence] Attempting cleanup of phantom upload...');
      try {
        await supabase.storage.from('ticket-evidences').remove([verifyPath]);
        console.log('[Evidence] Cleanup attempted');
      } catch (cleanupError) {
        console.error('[Evidence] Cleanup failed:', cleanupError);
      }

      throw new Error('Upload succeeded but object not found in Storage. This is a critical Storage backend issue.');
    }

    console.log('====================================');
    console.log('[Evidence] POST-UPLOAD DOWNLOAD SUCCESS');
    console.log('[Evidence] ✅ STORAGE VERIFIED - Object exists in bucket');
    console.log('[Evidence] Downloaded size:', downloadData.size, 'bytes');
    console.log('[Evidence] Downloaded type:', downloadData.type);
    console.log('====================================');

    // Use verified path for DB insert
    const dbStoragePath = verifyPath;

    // ============================================================================
    // DB INSERT - ticket_evidences
    // ============================================================================
    console.log('[Evidence] Creating DB record with verified path...');
    const { data: evidenceData, error: dbError } = await supabase
      .from('ticket_evidences')
      .insert({
        ticket_id: ticketId,
        type: 'SOLUTION',
        file_url: dbStoragePath, // Use verified path from Storage
        created_by: userId,
        latitude,
        longitude,
      })
      .select()
      .single();

    if (dbError) {
      console.error('====================================');
      console.error('[Evidence] DB INSERT FAILED');
      console.error('[Evidence] error:', dbError);
      console.error('[Evidence] message:', dbError.message);
      console.error('====================================');

      // Rollback: delete uploaded file
      console.log('[Evidence] Rolling back Storage upload');
      try {
        const { error: removeError } = await supabase.storage
          .from('ticket-evidences')
          .remove([dbStoragePath]);

        if (removeError) {
          console.error('[Evidence] Rollback FAILED:', removeError);
        } else {
          console.log('[Evidence] Rollback SUCCESS - Storage file deleted');
        }
      } catch (rollbackError) {
        console.error('[Evidence] Rollback exception:', rollbackError);
      }

      throw dbError;
    }

    console.log('====================================');
    console.log('[Evidence] DB INSERT SUCCESS');
    console.log('[Evidence] evidenceId:', evidenceData.id);
    console.log('[Evidence] DB file_url:', evidenceData.file_url);
    console.log('====================================');

    // ============================================================================
    // VERIFICATION - Paths must match
    // ============================================================================
    console.log('[Evidence] VERIFICATION:');
    console.log('[Evidence]   Storage verified path:', dbStoragePath);
    console.log('[Evidence]   DB file_url:          ', evidenceData.file_url);

    if (dbStoragePath === evidenceData.file_url) {
      console.log('[Evidence] ✅ PATHS MATCH');
    } else {
      console.error('[Evidence] ❌ PATHS MISMATCH - CRITICAL BUG');
      console.error('[Evidence]   DB should store exactly the verified Storage path');
    }

    console.log('[Evidence] Trigger will auto-create ticket_activity with evidence_id:', evidenceData.id);
    console.log('====================================');

    // ============================================================================
    // ACTIVITY VERIFICATION (after trigger fires)
    // ============================================================================
    // Wait a moment for trigger to execute
    await new Promise(resolve => setTimeout(resolve, 500));

    const { data: activityData, error: activityError } = await supabase
      .from('ticket_activity')
      .select('id, evidence_id')
      .eq('evidence_id', evidenceData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (activityError) {
      console.warn('====================================');
      console.warn('[Evidence] Activity verification FAILED');
      console.warn('[Evidence] Could not verify ticket_activity creation');
      console.warn('[Evidence] error:', activityError.message);
      console.warn('[Evidence] This may be timing issue - activity might still be created');
      console.warn('====================================');
    } else if (activityData) {
      console.log('====================================');
      console.log('[Evidence] Activity INSERT SUCCESS (verified)');
      console.log('[Evidence] activity.id:', activityData.id);
      console.log('[Evidence] activity.evidence_id:', activityData.evidence_id);
      console.log('====================================');

      // Verify IDs match
      console.log('[Evidence] VERIFICATION:');
      console.log('[Evidence]   evidence.id:          ', evidenceData.id);
      console.log('[Evidence]   activity.evidence_id: ', activityData.evidence_id);

      if (evidenceData.id === activityData.evidence_id) {
        console.log('[Evidence] ✅ IDs MATCH');
      } else {
        console.error('[Evidence] ❌ IDs MISMATCH - CRITICAL BUG');
        console.error('[Evidence]   Trigger not linking correctly');
      }
      console.log('====================================');
    }

    console.log('[Evidence] E2E UPLOAD COMPLETE');
    console.log('====================================');

    return { success: true, evidenceId: evidenceData.id };
  } catch (error: any) {
    console.error('====================================');
    console.error('[Evidence] FATAL ERROR');
    console.error('[Evidence] type:', error.name);
    console.error('[Evidence] message:', error.message);
    console.error('[Evidence] stack:', error.stack);
    console.error('====================================');
    return { success: false, error: error.message };
  }
}

export async function uploadSignature(
  ticketId: string,
  signatureUri: string,
  signedByName: string,
  latitude: number | null,
  longitude: number | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const fileName = `${ticketId}/signature-${timestamp}-${random}.png`;

    console.log('[Signature] Upload START');
    console.log('[Signature] bucket: ticket-signatures');
    console.log('[Signature] path:', fileName);
    console.log('[Signature] ticketId:', ticketId);

    // Convert URI to blob
    const response = await fetch(signatureUri);
    const blob = await response.blob();

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('ticket-signatures')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false, // Changed to false - we use unique filenames
      });

    if (uploadError) {
      console.error('[Signature] Storage error:', uploadError.message);
      console.error('[Signature] statusCode:', uploadError.statusCode);
      throw uploadError;
    }

    console.log('[Signature] Storage upload SUCCESS');

    // Upsert signature record
    const { error: dbError } = await supabase
      .from('ticket_signatures')
      .upsert({
        ticket_id: ticketId,
        signature_url: fileName, // Store path
        signed_by_name: signedByName,
        latitude,
        longitude,
      });

    if (dbError) {
      console.error('[Signature] DB insert failed:', dbError.message);
      console.log('[Signature] Rolling back uploaded file');

      // Rollback: remove uploaded file
      try {
        const { error: removeError } = await supabase.storage
          .from('ticket-signatures')
          .remove([fileName]);

        if (removeError) {
          console.error('[Signature] Rollback FAIL:', removeError.message);
        } else {
          console.log('[Signature] Rollback SUCCESS');
        }
      } catch (rollbackError) {
        console.error('[Signature] Rollback exception:', rollbackError);
      }

      throw dbError;
    }

    console.log('[Signature] DB insert SUCCESS');
    return { success: true };
  } catch (error: any) {
    console.error('[Signature] Error:', error);
    return { success: false, error: error.message };
  }
}

export async function getSignedUrl(
  bucket: 'ticket-evidences' | 'ticket-signatures',
  path: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 1 hour expiry

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
}

export async function deleteEvidence(
  evidenceId: string,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('ticket-evidences')
      .remove([filePath]);

    if (storageError) throw storageError;

    // Delete from database
    const { error: dbError } = await supabase
      .from('ticket_evidences')
      .delete()
      .eq('id', evidenceId);

    if (dbError) throw dbError;

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting evidence:', error);
    return { success: false, error: error.message };
  }
}
