// Sign in / create account (F12.2), and the account-deletion confirm (F12.9).

import { useState } from 'react';
import { View } from 'react-native';

import { useAccount } from '../core/useAccount';
import { useStore } from '../core/store';
import { colors, radius, space } from '../core/theme';
import { todayKey } from '../core/dates';
import { saveJson } from '../core/exportFile';
import { Button, Field, Press, Segmented, T } from './ui';
import { Sheet } from './parts';

export function AccountSheet({ visible, onClose, initialMode = 'signup', onDone }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Back up & sync">
      {visible ? <AccountForm initialMode={initialMode} onClose={onClose} onDone={onDone} /> : null}
    </Sheet>
  );
}

function AccountForm({ initialMode, onClose, onDone }) {
  const { signIn, finishSignIn, cancelSignIn } = useAccount();
  const { settings } = useStore();
  const [mode, setMode] = useState(initialMode); // 'signup' | 'login' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // signed in, waiting on merge vs replace
  const hasLocalData = settings.onboarded === '1';

  const done = () => {
    onClose();
    if (onDone) onDone();
  };

  const handle = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (r?.choose) setPending(r.pending);
      else done();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <ChooseData
        busy={busy}
        error={error}
        onPick={(strategy) => handle(() => finishSignIn(pending, strategy))}
        onCancel={() => {
          cancelSignIn(pending);
          setPending(null);
        }}
      />
    );
  }

  if (mode === 'reset') {
    return <ResetForm email={email} setEmail={setEmail} onBack={() => setMode('login')} onResult={(r) => (r?.choose ? setPending(r.pending) : done())} />;
  }

  const submit = () => {
    if (!email.trim() || !password) return;
    handle(() => signIn(mode, email.trim(), password));
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
      {mode === 'login' ? (
        <Press onPress={() => { setMode('reset'); setError(null); }} style={{ marginTop: space.md, alignSelf: 'flex-start' }}>
          <T v="emphasis" style={{ color: colors.sunbeam, fontSize: 14 }}>Forgot password?</T>
        </Press>
      ) : null}
      <T v="caption" style={{ marginTop: space.md }}>
        {mode === 'login' && hasLocalData
          ? "If your account already has plans too, you'll get to choose what happens to this device's."
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

// This device and the account both hold plans. Merging keeps everything
// (duplicates like two "Academics" areas can appear); replacing makes this
// device a copy of the account. Offer an export before anything is replaced.
function ChooseData({ busy, error, onPick, onCancel }) {
  const { exportData } = useAccount();
  const [exported, setExported] = useState(false);
  return (
    <View>
      <T v="h2">This device has its own plans.</T>
      <T style={{ color: colors.muted, marginTop: space.sm }}>So does your account. What should happen to the ones here?</T>
      <Press onPress={() => onPick('replace')} disabled={busy} style={{ marginTop: space.lg, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface }}>
        <T v="emphasis">Use my account's plans</T>
        <T v="caption">This device becomes a copy of your account. What's only here is removed.</T>
      </Press>
      <Press onPress={() => onPick('merge')} disabled={busy} style={{ marginTop: space.sm, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface }}>
        <T v="emphasis">Keep both</T>
        <T v="caption">Everything here is added to your account. Areas set up on both may show twice — archive the extras.</T>
      </Press>
      <Press
        onPress={async () => {
          await saveJson(`lumo-this-device-${todayKey()}.json`, await exportData());
          setExported(true);
        }}
        style={{ marginTop: space.md, alignSelf: 'flex-start' }}
      >
        <T v="caption" style={{ color: colors.lagoon }}>{exported ? 'Saved a copy of this device ✓' : "Save a copy of this device's data first"}</T>
      </Press>
      {error ? <T style={{ color: colors.blush, marginTop: space.md }}>{error}</T> : null}
      <Button kind="ghost" title={busy ? 'Working…' : 'Cancel'} onPress={onCancel} disabled={busy} style={{ marginTop: space.lg }} />
    </View>
  );
}

function ResetForm({ email, setEmail, onBack, onResult }) {
  const { requestReset, confirmReset } = useAccount();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <T v="h2">Reset your password</T>
      {!sent ? (
        <>
          <T style={{ color: colors.muted, marginTop: space.sm }}>We'll email you a 6-digit code.</T>
          <Field value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={{ marginTop: space.lg }} />
          {error ? <T style={{ color: colors.blush, marginTop: space.md }}>{error}</T> : null}
          <Button
            title={busy ? 'Sending…' : 'Send code'}
            disabled={busy || !email.trim()}
            onPress={() => run(async () => { await requestReset(email.trim()); setSent(true); })}
            style={{ marginTop: space.lg }}
          />
        </>
      ) : (
        <>
          <T style={{ color: colors.muted, marginTop: space.sm }}>If {email.trim()} has an account, a code is on its way. It works for 15 minutes.</T>
          <Field value={code} onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="6-digit code" keyboardType="number-pad" style={{ marginTop: space.lg }} />
          <Field value={password} onChangeText={setPassword} placeholder="New password (8+ characters)" secureTextEntry autoComplete="new-password" style={{ marginTop: space.sm }} />
          {error ? <T style={{ color: colors.blush, marginTop: space.md }}>{error}</T> : null}
          <Button
            title={busy ? 'One sec…' : 'Set password and sign in'}
            disabled={busy || code.length !== 6 || password.length < 8}
            onPress={() => run(async () => onResult(await confirmReset(email.trim(), code, password)))}
            style={{ marginTop: space.lg }}
          />
          <Press onPress={() => { setSent(false); setCode(''); }} style={{ marginTop: space.md, alignSelf: 'flex-start' }}>
            <T v="caption" style={{ color: colors.sunbeam }}>Didn't get it? Send another</T>
          </Press>
        </>
      )}
      <Button kind="quiet" title="Back to sign in" onPress={onBack} style={{ marginTop: space.sm }} />
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
