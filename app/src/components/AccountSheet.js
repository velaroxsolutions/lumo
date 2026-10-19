// Sign in / create account (F12.2), and the account-deletion confirm (F12.9).

import { useState } from 'react';
import { View } from 'react-native';

import { useAccount } from '../core/useAccount';
import { useStore } from '../core/store';
import { colors, space } from '../core/theme';
import { Button, Field, Segmented, T } from './ui';
import { Sheet } from './parts';

export function AccountSheet({ visible, onClose, initialMode = 'signup', onDone }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Back up & sync">
      {visible ? <AccountForm initialMode={initialMode} onClose={onClose} onDone={onDone} /> : null}
    </Sheet>
  );
}

function AccountForm({ initialMode, onClose, onDone }) {
  const { signIn } = useAccount();
  const { settings } = useStore();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const hasLocalData = settings.onboarded === '1';

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(mode, email.trim(), password);
      onClose();
      if (onDone) onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Segmented
        value={mode}
        onChange={(m) => { setMode(m); setError(null); }}
        options={[{ value: 'signup', label: 'Create account' }, { value: 'login', label: 'Sign in' }]}
      />
      <Field
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        style={{ marginTop: space.lg }}
      />
      <Field
        value={password}
        onChangeText={setPassword}
        placeholder={mode === 'signup' ? 'Password (8+ characters)' : 'Password'}
        secureTextEntry
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        onSubmitEditing={submit}
        style={{ marginTop: space.sm }}
      />
      {error ? <T style={{ color: colors.blush, marginTop: space.md }}>{error}</T> : null}
      <T v="caption" style={{ marginTop: space.md }}>
        {mode === 'login' && hasLocalData
          ? "What's on this device is merged into your account — nothing here is lost."
          : 'Your plans stay on this device and back up to your account, so another phone or the web picks up where you left off.'}
      </T>
      <Button
        title={busy ? 'One sec…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        onPress={submit}
        disabled={busy || !email.trim() || !password}
        style={{ marginTop: space.lg }}
      />
    </View>
  );
}

export function DeleteAccountSheet({ visible, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Delete account">
      {visible ? <DeleteForm onClose={onClose} /> : null}
    </Sheet>
  );
}

function DeleteForm({ onClose }) {
  const { deleteAccount, email } = useAccount();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <T>
        This deletes {email} and everything backed up to it from the server. What's on this device stays here, so
        you can keep using lumo without an account.
      </T>
      <Field
        value={password}
        onChangeText={setPassword}
        placeholder="Password to confirm"
        secureTextEntry
        style={{ marginTop: space.lg }}
      />
      {error ? <T style={{ color: colors.blush, marginTop: space.md }}>{error}</T> : null}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        <Button kind="ghost" title="Keep it" onPress={onClose} />
        <Button kind="secondary" title={busy ? 'Deleting…' : 'Delete for good'} onPress={confirm} disabled={busy || !password} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
