import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import SignatureScreen from 'react-native-signature-canvas';
import { useAuth } from '../services/auth-context';
import { supabase } from '../services/supabase';
import {
  uploadEvidence,
  uploadSignature,
  getSignedUrl,
  deleteEvidence,
} from '../services/storage-helper';
import {
  Ticket,
  Client,
  TicketEvidence,
  TicketSignature,
  getTicketSlaState,
  getTicketSlaLabel,
  formatTicketAge,
  formatTicketFolio,
  TicketSlaState,
} from '@wisper/shared';

interface TicketWithClient extends Ticket {
  client: Client;
}

export default function TicketDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { ticketId } = (route.params as any) || {};

  const [ticket, setTicket] = useState<TicketWithClient | null>(null);
  const [evidences, setEvidences] = useState<TicketEvidence[]>([]);
  const [signature, setSignature] = useState<TicketSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [technicianNotes, setTechnicianNotes] = useState('');
  const [solutionText, setSolutionText] = useState('');

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signedByName, setSignedByName] = useState('');
  const signatureRef = useRef<any>(null);

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  async function loadTicket() {
    try {
      setLoading(true);

      // Load ticket with client
      const { data: ticketData, error } = await supabase
        .from('tickets')
        .select(`
          *,
          client:clients(*)
        `)
        .eq('id', ticketId)
        .single();

      if (error) throw error;
      setTicket(ticketData as any);
      setTechnicianNotes(ticketData.technician_notes || '');
      setSolutionText(ticketData.solution_text || '');
      setSignedByName(ticketData.client?.name || '');

      // Load evidences
      const { data: evidencesData } = await supabase
        .from('ticket_evidences')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      setEvidences(evidencesData || []);

      // Load signature
      const { data: signatureData } = await supabase
        .from('ticket_signatures')
        .select('*')
        .eq('ticket_id', ticketId)
        .single();

      setSignature(signatureData);
    } catch (error: any) {
      console.error('Error loading ticket:', error);
      Alert.alert('Error', 'No se pudo cargar el ticket');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartTicket() {
    if (!ticket) return;

    try {
      setSaving(true);

      const updates: any = {
        status: 'IN_REVIEW',
      };

      // Only set started_at if not already set
      if (!ticket.started_at) {
        updates.started_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) throw error;

      await loadTicket();
      Alert.alert('Éxito', 'Atención iniciada');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProgress() {
    if (!ticket) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('tickets')
        .update({
          technician_notes: technicianNotes.trim() || null,
          solution_text: solutionText.trim() || null,
        })
        .eq('id', ticketId);

      if (error) throw error;

      Alert.alert('Éxito', 'Progreso guardado');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePause() {
    Alert.prompt(
      'Pausar ticket',
      'Indica la razón',
      async (reason: string) => {
        if (!reason.trim()) return;

        try {
          setSaving(true);

          const { error } = await supabase
            .from('tickets')
            .update({ status: 'PAUSED' })
            .eq('id', ticketId);

          if (error) throw error;

          // Add note to history
          await supabase.from('ticket_status_history').insert({
            ticket_id: ticketId,
            previous_status: 'IN_REVIEW',
            new_status: 'PAUSED',
            notes: reason.trim(),
          });

          await loadTicket();
          Alert.alert('Éxito', 'Ticket pausado');
        } catch (error: any) {
          Alert.alert('Error', error.message);
        } finally {
          setSaving(false);
        }
      },
      'plain-text'
    );
  }

  async function handleResume() {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('tickets')
        .update({ status: 'IN_REVIEW' })
        .eq('id', ticketId);

      if (error) throw error;

      await loadTicket();
      Alert.alert('Éxito', 'Atención reanudada');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  }

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a las fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  }

  async function uploadImage(imageUri: string) {
    try {
      setUploading(true);

      // Compress image
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Get location
      let location = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          location = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
        }
      } catch (locError) {
        console.log('Location not available');
      }

      // Upload
      const result = await uploadEvidence(
        ticketId,
        manipResult.uri,
        location?.latitude || null,
        location?.longitude || null,
        profile!.id
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      await loadTicket();
      Alert.alert('Éxito', 'Evidencia subida');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo subir la evidencia');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteEvidence(evidence: TicketEvidence) {
    Alert.alert(
      'Eliminar evidencia',
      '¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteEvidence(evidence.id, evidence.file_url);
            if (result.success) {
              await loadTicket();
              Alert.alert('Éxito', 'Evidencia eliminada');
            } else {
              Alert.alert('Error', result.error || 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  }

  async function handleCaptureSignature() {
    setShowSignatureModal(true);
  }

  async function handleSignatureOK(signature: string) {
    try {
      setUploading(true);
      setShowSignatureModal(false);

      if (!signedByName.trim()) {
        Alert.alert('Error', 'Ingresa el nombre de quien firma');
        return;
      }

      // Get location
      let location = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          location = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
        }
      } catch (locError) {
        console.log('Location not available');
      }

      // Upload signature
      const result = await uploadSignature(
        ticketId,
        signature,
        signedByName.trim(),
        location?.latitude || null,
        location?.longitude || null
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      await loadTicket();
      Alert.alert('Éxito', 'Firma capturada');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo guardar la firma');
    } finally {
      setUploading(false);
    }
  }

  async function handleCloseTicket() {
    if (!ticket) return;

    // Validate
    const errors: string[] = [];
    if (!solutionText.trim()) {
      errors.push('Captura la solución realizada');
    }
    if (evidences.length === 0) {
      errors.push('Agrega al menos una evidencia');
    }
    if (!signature) {
      errors.push('Obtén la firma del cliente');
    }

    if (errors.length > 0) {
      Alert.alert(
        'Faltan datos',
        errors.map(e => `• ${e}`).join('\n')
      );
      return;
    }

    Alert.alert(
      'Cerrar ticket',
      `¿Confirmas el cierre exitoso del ticket ${formatTicketFolio(ticket.folio)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          onPress: async () => {
            try {
              setSaving(true);

              const { error } = await supabase
                .from('tickets')
                .update({
                  status: 'RESOLVED',
                  closed_at: new Date().toISOString(),
                  technician_notes: technicianNotes.trim() || null,
                  solution_text: solutionText.trim(),
                })
                .eq('id', ticketId);

              if (error) throw error;

              await loadTicket();
              Alert.alert('Éxito', 'Ticket cerrado exitosamente', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  function openMaps() {
    if (!ticket?.client) return;

    const { latitude, longitude, address } = ticket.client;

    if (latitude && longitude) {
      const url = Platform.select({
        ios: `maps:0,0?q=${latitude},${longitude}`,
        android: `geo:0,0?q=${latitude},${longitude}`,
      });
      Linking.openURL(url!);
    } else if (address) {
      const encodedAddress = encodeURIComponent(address);
      const url = Platform.select({
        ios: `maps:0,0?q=${encodedAddress}`,
        android: `geo:0,0?q=${encodedAddress}`,
      });
      Linking.openURL(url!);
    }
  }

  function getSlaColor(slaState: TicketSlaState): string {
    switch (slaState) {
      case TicketSlaState.GREEN:
        return '#10B981';
      case TicketSlaState.YELLOW:
        return '#F59E0B';
      case TicketSlaState.RED:
      case TicketSlaState.OVERDUE:
        return '#DC2626';
      default:
        return '#6B7280';
    }
  }

  const isResolved = ticket?.status === 'RESOLVED';
  const isCancelled = ticket?.status === 'CANCELLED';
  const isReadOnly = isResolved || isCancelled;
  const canStart = ticket?.status === 'ASSIGNED' || ticket?.status === 'PENDING';
  const canPause = ticket?.status === 'IN_REVIEW';
  const canResume = ticket?.status === 'PAUSED';
  const canClose = ticket?.status === 'IN_REVIEW' || ticket?.status === 'PAUSED';

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text>Ticket no encontrado</Text>
      </View>
    );
  }

  const slaState = getTicketSlaState(ticket.created_at);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.folio}>{formatTicketFolio(ticket.folio)}</Text>
          <View style={[styles.slaBadge, { backgroundColor: getSlaColor(slaState) }]}>
            <Text style={styles.slaBadgeText}>{getTicketSlaLabel(slaState)}</Text>
          </View>
        </View>
        <Text style={styles.age}>{formatTicketAge(ticket.created_at)}</Text>
      </View>

      {isResolved && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>✅ Ticket cerrado exitosamente</Text>
        </View>
      )}

      {canStart && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStartTicket}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>
            {saving ? 'Iniciando...' : 'INICIAR ATENCIÓN'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cliente</Text>
        <Text style={styles.clientName}>{ticket.client?.name}</Text>
        <Text style={styles.text}>{ticket.client?.address}</Text>
        {ticket.client?.reference && (
          <Text style={styles.textSmall}>Ref: {ticket.client.reference}</Text>
        )}
        {ticket.client?.phone && (
          <Text style={styles.textSmall}>Tel: {ticket.client.phone}</Text>
        )}
        <TouchableOpacity style={styles.linkButton} onPress={openMaps}>
          <Text style={styles.linkButtonText}>Cómo llegar →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipo de falla</Text>
        <Text style={styles.text}>{ticket.failure_type}</Text>
      </View>

      {ticket.admin_notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observaciones (admin)</Text>
          <Text style={styles.text}>{ticket.admin_notes}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Observaciones del técnico</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={technicianNotes}
          onChangeText={setTechnicianNotes}
          placeholder="Agrega tus observaciones..."
          editable={!isReadOnly}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Solución realizada</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={solutionText}
          onChangeText={setSolutionText}
          placeholder="Describe la solución..."
          editable={!isReadOnly}
        />
      </View>

      {!isReadOnly && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleSaveProgress}
          disabled={saving}
        >
          <Text style={styles.secondaryButtonText}>
            {saving ? 'Guardando...' : 'Guardar progreso'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Evidencias ({evidences.length})</Text>
          {!isReadOnly && (
            <View style={styles.evidenceButtons}>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={handleTakePhoto}
                disabled={uploading}
              >
                <Text style={styles.smallButtonText}>Tomar foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={handlePickImage}
                disabled={uploading}
              >
                <Text style={styles.smallButtonText}>Galería</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {uploading && <ActivityIndicator style={styles.loader} />}

        <View style={styles.evidenceGrid}>
          {evidences.map(evidence => (
            <EvidenceCard
              key={evidence.id}
              evidence={evidence}
              onDelete={!isReadOnly ? handleDeleteEvidence : undefined}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Firma del cliente</Text>
        {signature ? (
          <View>
            <Text style={styles.successSmall}>✅ Firma capturada</Text>
            <Text style={styles.textSmall}>Firmado por: {signature.signed_by_name}</Text>
            <Text style={styles.textSmall}>
              {new Date(signature.signed_at).toLocaleString('es-MX')}
            </Text>
            {!isReadOnly && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleCaptureSignature}
              >
                <Text style={styles.linkButtonText}>Volver a capturar</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {!isReadOnly && (
              <>
                <TextInput
                  style={styles.input}
                  value={signedByName}
                  onChangeText={setSignedByName}
                  placeholder="Nombre de quien firma"
                />
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleCaptureSignature}
                  disabled={uploading}
                >
                  <Text style={styles.secondaryButtonText}>Capturar firma</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>

      {canPause && (
        <TouchableOpacity
          style={styles.warningButton}
          onPress={handlePause}
          disabled={saving}
        >
          <Text style={styles.warningButtonText}>Pausar</Text>
        </TouchableOpacity>
      )}

      {canResume && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleResume}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>Retomar atención</Text>
        </TouchableOpacity>
      )}

      {canClose && (
        <TouchableOpacity
          style={styles.successButton}
          onPress={handleCloseTicket}
          disabled={saving}
        >
          <Text style={styles.successButtonText}>
            {saving ? 'Cerrando...' : 'CERRAR TICKET'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.bottomSpace} />

      <Modal
        visible={showSignatureModal}
        animationType="slide"
        onRequestClose={() => setShowSignatureModal(false)}
      >
        <View style={styles.signatureContainer}>
          <Text style={styles.signatureTitle}>Firma del cliente</Text>
          <SignatureScreen
            ref={signatureRef}
            onOK={handleSignatureOK}
            onEmpty={() => Alert.alert('Error', 'La firma está vacía')}
            descriptionText="Firma dentro del recuadro"
            clearText="Limpiar"
            confirmText="Aceptar firma"
            webStyle={`.m-signature-pad {box-shadow: none; border: 1px solid #e5e5e5;} .m-signature-pad--body {border: none;} .m-signature-pad--footer {display: none; margin: 0px;}`}
          />
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowSignatureModal(false)}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

function EvidenceCard({ evidence, onDelete }: { evidence: TicketEvidence; onDelete?: (e: TicketEvidence) => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    loadImage();
  }, [evidence.file_url]);

  async function loadImage() {
    const url = await getSignedUrl('ticket-evidences', evidence.file_url);
    setImageUrl(url);
  }

  return (
    <View style={styles.evidenceCard}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.evidenceImage} />
      ) : (
        <ActivityIndicator />
      )}
      {onDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(evidence)}
        >
          <Text style={styles.deleteButtonText}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  folio: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  slaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  slaBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  age: {
    fontSize: 14,
    color: '#6b7280',
  },
  successBanner: {
    backgroundColor: '#D1FAE5',
    padding: 16,
    alignItems: 'center',
  },
  successText: {
    color: '#065F46',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111827',
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  text: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  textSmall: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#3B82F6',
    padding: 14,
    margin: 16,
    marginTop: 0,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  warningButton: {
    backgroundColor: '#F59E0B',
    padding: 14,
    margin: 16,
    marginTop: 0,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  successButton: {
    backgroundColor: '#10B981',
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderRadius: 8,
    alignItems: 'center',
  },
  successButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    paddingVertical: 8,
  },
  linkButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  evidenceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  smallButtonText: {
    fontSize: 12,
    color: '#374151',
  },
  loader: {
    marginVertical: 12,
  },
  evidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  evidenceCard: {
    width: 100,
    height: 100,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  successSmall: {
    color: '#10B981',
    fontWeight: '600',
    marginBottom: 4,
  },
  bottomSpace: {
    height: 40,
  },
  signatureContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  signatureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
    textAlign: 'center',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#DC2626',
    fontSize: 16,
  },
});
