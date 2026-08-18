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

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('ticket-evidences')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Insert evidence record
    const { data, error: dbError } = await supabase
      .from('ticket_evidences')
      .insert({
        ticket_id: ticketId,
        type: 'SOLUTION',
        file_url: fileName, // Store path, not public URL
        created_by: userId,
        latitude,
        longitude,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return { success: true, evidenceId: data.id };
  } catch (error: any) {
    console.error('Error uploading evidence:', error);
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
    const fileName = `${ticketId}/signature-${timestamp}.png`;

    // Convert URI to blob
    const response = await fetch(signatureUri);
    const blob = await response.blob();

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('ticket-signatures')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true, // Allow replacing signature
      });

    if (uploadError) throw uploadError;

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

    if (dbError) throw dbError;

    return { success: true };
  } catch (error: any) {
    console.error('Error uploading signature:', error);
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
