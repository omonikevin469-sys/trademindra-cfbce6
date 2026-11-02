import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/JournalText';
import { FontControl } from '@/components/FontControl';
import { useReadingScale } from '@/lib/readingPreferences';
import { Input, Label, TextField } from 'heroui-native';
import { Action, Heading, Message, Options, Page } from '@/components/JournalUI';
import { bilt } from '@/lib/bilt';
import { useCloud } from '@/lib/cloud';
import { errorFeedback, success } from '@/lib/journal';
type Stage = 'start' | 'signup-code' | 'reset-code' | 'password';
export function EmailAccount() {
  const scale = useReadingScale();
  const textStyle = {
    fontSize: 16 * scale,
    lineHeight: 24 * scale,
    height: undefined,
    minHeight: 48 * scale,
    paddingVertical: 12,
  };
  const [mode, setMode] = useState('Sign in');
  const [stage, setStage] = useState<Stage>('start');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const address = email.trim().toLowerCase();
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
      errorFeedback();
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      throw new Error('Enter your account email address.');
    if (mode === 'Forgot password') {
      const { error: e } = await bilt.auth.resetPasswordForEmail(address);
      if (e) throw new Error(e.message);
      setStage('reset-code');
      setNotice(`Enter the six-digit code sent to ${address}.`);
    } else if (mode === 'Create account') {
      if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
      if (password !== confirm) throw new Error('The passwords do not match.');
      const { error: e } = await bilt.auth.signUp({ email: address, password });
      if (e) throw new Error(e.message);
      setStage('signup-code');
      setNotice(`Enter the six-digit code sent to ${address}.`);
    } else {
      const { data, error: e } = await bilt.auth.signInWithPassword({ email: address, password });
      if (e) throw new Error(e.message);
      if (!data.user?.email_confirmed_at) throw new Error('Verify your email before signing in.');
      success();
    }
  };
  const verify = async () => {
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit email code.');
    const resetting = stage === 'reset-code';
    if (resetting) useCloud.setState({ recovery: true });
    const { error: e } = await bilt.auth.verifyOtp({
      email: address,
      token: code,
      type: stage === 'signup-code' ? 'signup' : 'recovery',
    });
    if (e) {
      if (resetting) useCloud.setState({ recovery: false });
      throw new Error(e.message);
    }
    if (resetting) {
      setStage('password');
      setPassword('');
      setConfirm('');
      setNotice('');
    }
    success();
  };
  const updatePassword = async () => {
    if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
    if (password !== confirm) throw new Error('The passwords do not match.');
    const { error: e } = await bilt.auth.updateUser({ password });
    if (e) throw new Error(e.message);
    useCloud.setState({ recovery: false });
    success();
  };
  const coded = stage === 'signup-code' || stage === 'reset-code';
  return (
    <Page>
      <Heading title="TradeMindra Ultra" />
      <View className="gap-5">
        <Text className="text-foreground text-xl" style={{ fontFamily: 'Inter_600SemiBold' }}>
          {coded ? 'Verify your email' : stage === 'password' ? 'Set a new password' : mode}
        </Text>
        {stage === 'start' ? (
          <Options
            options={['Sign in', 'Create account']}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setError('');
              setNotice('');
            }}
          />
        ) : null}
        {stage === 'start' ? (
          <TextField>
            <Label>Email</Label>
            <Input
              className="border-field-border h-auto rounded-xl border"
              style={textStyle}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          </TextField>
        ) : null}
        {notice ? <Text className="text-foreground">{notice}</Text> : null}
        {coded ? (
          <TextField>
            <Label>Email verification code</Label>
            <Input
              className="border-field-border h-auto rounded-xl border"
              style={textStyle}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
            />
          </TextField>
        ) : null}
        {stage === 'password' || (stage === 'start' && mode !== 'Forgot password') ? (
          <TextField>
            <Label>{stage === 'password' ? 'New password' : 'Password'}</Label>
            <Input
              className="border-field-border h-auto rounded-xl border"
              style={textStyle}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete={mode === 'Sign in' ? 'current-password' : 'new-password'}
            />
          </TextField>
        ) : null}
        {stage === 'password' || (stage === 'start' && mode === 'Create account') ? (
          <TextField>
            <Label>Confirm password</Label>
            <Input
              className="border-field-border h-auto rounded-xl border"
              style={textStyle}
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="none"
              autoComplete="new-password"
            />
          </TextField>
        ) : null}
        {error ? <Message text={error} /> : null}
        <Action
          disabled={busy}
          label={
            busy
              ? 'Please wait…'
              : coded
                ? 'Verify email'
                : stage === 'password'
                  ? 'Save password'
                  : mode === 'Forgot password'
                    ? 'Send verification code'
                    : mode
          }
          onPress={() => {
            void run(coded ? verify : stage === 'password' ? updatePassword : send);
          }}
        />
        {coded ? (
          <Action
            secondary
            disabled={busy}
            label="Resend code"
            onPress={() => {
              void run(async () => {
                const { error: e } =
                  stage === 'signup-code'
                    ? await bilt.auth.resend({ type: 'signup', email: address })
                    : await bilt.auth.resetPasswordForEmail(address);
                if (e) throw new Error(e.message);
                setNotice(`A new code was sent to ${address}.`);
              });
            }}
          />
        ) : null}
        {stage === 'start' ? (
          <Action
            secondary
            disabled={busy}
            label={mode === 'Forgot password' ? 'Back to sign in' : 'Forgot password?'}
            onPress={() => {
              setMode(mode === 'Forgot password' ? 'Sign in' : 'Forgot password');
              setError('');
            }}
          />
        ) : stage !== 'password' ? (
          <Action
            secondary
            disabled={busy}
            label="Back to sign in"
            onPress={() => {
              setStage('start');
              setMode('Sign in');
              setError('');
              setNotice('');
              useCloud.setState({ recovery: false });
            }}
          />
        ) : null}
      </View>
      <View className="gap-3">
        <Text className="text-foreground text-lg">Font size</Text>
        <FontControl />
      </View>
      <Text className="text-foreground text-sm">
        Sign in with the same verified email on another phone to open your saved journal. Closed
        trades cannot be edited or deleted.
      </Text>
    </Page>
  );
}
