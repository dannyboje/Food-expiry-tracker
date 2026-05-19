import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { markEmailPromptShown, saveEmail } from '@/utils/email-capture';

interface Props {
  visible: boolean;
  onDone: () => void;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function EmailCaptureModal({ visible, onDone }: Props) {
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    await saveEmail(email);
    await markEmailPromptShown();
    setLoading(false);
    onDone();
  }

  async function handleSkip() {
    await markEmailPromptShown();
    onDone();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inner}>

          <Text style={styles.logo}>🥗</Text>
          <Text style={styles.title}>Fresh Ahead</Text>
          <Text style={styles.subtitle}>Stay in the loop</Text>
          <Text style={styles.body}>
            Drop your email and we'll let you know about new features,{'\n'}
            tips, and improvements — no spam, ever.
          </Text>

          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="you@example.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            value={email}
            onChangeText={(v) => { setEmail(v); setError(''); }}
            onSubmitEditing={handleSubmit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Saving…' : 'Keep me updated'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} hitSlop={12}>
            <Text style={styles.skip}>No thanks, skip</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0FDF4' },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  logo: { fontSize: 64 },
  title: { fontSize: 30, fontWeight: '900', color: '#14532D', marginTop: 4 },
  subtitle: { fontSize: 20, fontWeight: '700', color: '#16A34A' },
  body: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 4,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  inputError: { borderColor: '#FCA5A5' },
  error: { color: '#DC2626', fontSize: 13, alignSelf: 'flex-start' },
  btn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  skip: { color: '#6B7280', fontSize: 14, marginTop: 8 },
});
