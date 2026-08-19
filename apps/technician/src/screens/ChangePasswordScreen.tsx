import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuth } from '../services/auth-context';
import { supabase } from '../services/supabase';

export default function ChangePasswordScreen() {
  const { profile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Al menos 1 mayúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Al menos 1 minúscula');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Al menos 1 número');
    }

    return { valid: errors.length === 0, errors };
  }

  async function handleUpdatePassword() {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa ambos campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      Alert.alert(
        'Contraseña inválida',
        'La contraseña debe cumplir:\n\n' + validation.errors.map(e => `• ${e}`).join('\n')
      );
      return;
    }

    setSubmitting(true);

    try {
      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      // Update must_change_password flag
      if (profile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', profile.id);

        if (profileError) {
          // Log error but don't block user - they can still use the app
          console.error('Error updating profile:', profileError);
          Alert.alert(
            'Advertencia',
            'La contraseña fue actualizada pero hubo un problema. Contacta a soporte si esto persiste.'
          );
        }
      }

      Alert.alert(
        'Éxito',
        'Tu contraseña ha sido actualizada correctamente',
        [{ text: 'Continuar' }]
      );

      // Force reload of profile to update must_change_password state
      // The auth context will handle navigation
      window.location.reload();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar la contraseña');
    } finally {
      setSubmitting(false);
    }
  }

  const passwordValidation = validatePassword(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Crea tu nueva contraseña</Text>
        <Text style={styles.subtitle}>
          Estás usando una contraseña temporal. Por seguridad, debes crear una nueva contraseña.
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nueva contraseña</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Mínimo 8 caracteres"
            secureTextEntry
            editable={!submitting}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repite la contraseña"
            secureTextEntry
            editable={!submitting}
            autoCapitalize="none"
          />
        </View>

        {/* Password requirements */}
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Requisitos de contraseña:</Text>
          {[
            { text: 'Al menos 8 caracteres', met: newPassword.length >= 8 },
            { text: 'Al menos 1 mayúscula', met: /[A-Z]/.test(newPassword) },
            { text: 'Al menos 1 minúscula', met: /[a-z]/.test(newPassword) },
            { text: 'Al menos 1 número', met: /[0-9]/.test(newPassword) },
          ].map((req, index) => (
            <View key={index} style={styles.requirementRow}>
              <Text style={req.met ? styles.checkMark : styles.crossMark}>
                {req.met ? '✓' : '○'}
              </Text>
              <Text style={[styles.requirementText, req.met && styles.requirementMet]}>
                {req.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Password match indicator */}
        {confirmPassword.length > 0 && (
          <View style={styles.matchContainer}>
            {passwordsMatch ? (
              <Text style={styles.matchSuccess}>✓ Las contraseñas coinciden</Text>
            ) : (
              <Text style={styles.matchError}>Las contraseñas no coinciden</Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            submitting && styles.buttonDisabled,
            (!passwordValidation.valid || !passwordsMatch) && styles.buttonDisabled,
          ]}
          onPress={handleUpdatePassword}
          disabled={submitting || !passwordValidation.valid || !passwordsMatch}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Actualizar contraseña</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  requirementsContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkMark: {
    fontSize: 16,
    color: '#10B981',
    marginRight: 8,
    width: 20,
  },
  crossMark: {
    fontSize: 16,
    color: '#9ca3af',
    marginRight: 8,
    width: 20,
  },
  requirementText: {
    fontSize: 13,
    color: '#6b7280',
  },
  requirementMet: {
    color: '#10B981',
    fontWeight: '500',
  },
  matchContainer: {
    marginBottom: 20,
  },
  matchSuccess: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '500',
  },
  matchError: {
    fontSize: 13,
    color: '#DC2626',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
