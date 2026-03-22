import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function useBiometricAuth() {
  const { user, session } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (window.PublicKeyCredential) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setIsSupported(available);
        } catch {
          setIsSupported(false);
        }
      }
    };
    check();
  }, []);

  const fetchCredentials = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_webauthn_credentials')
      .select('*')
      .eq('user_id', user.id);
    setCredentials(data || []);
    setIsEnrolled((data || []).length > 0);
  }, [user]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const enrollBiometric = async (deviceName?: string) => {
    if (!user || !session) {
      toast.error('Please sign in first');
      return false;
    }
    setLoading(true);
    try {
      // Get registration challenge
      const { data: challengeData, error: challengeError } = await supabase.functions.invoke('webauthn', {
        body: { action: 'register-challenge' },
      });

      if (challengeError) throw new Error(challengeError.message);

      const { challenge, rp, user: rpUser } = challengeData;

      // Create credential using WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: base64ToArrayBuffer(challenge),
          rp: { name: rp.name, id: rp.id },
          user: {
            id: new TextEncoder().encode(rpUser.id),
            name: rpUser.name,
            displayName: rpUser.displayName,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' },  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      }) as PublicKeyCredential;

      if (!credential) throw new Error('Biometric enrollment cancelled');

      const response = credential.response as AuthenticatorAttestationResponse;
      const credentialId = arrayBufferToBase64(credential.rawId);
      const publicKey = arrayBufferToBase64(response.getPublicKey?.() || new ArrayBuffer(0));

      // Verify with server
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('webauthn', {
        body: {
          action: 'register-verify',
          credentialId,
          publicKey,
          deviceName: deviceName || getDeviceName(),
        },
      });

      if (verifyError) throw new Error(verifyError.message);

      toast.success('Biometric authentication enabled!');
      await fetchCredentials();
      return true;
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        toast.error('Biometric enrollment was cancelled');
      } else {
        toast.error(error.message || 'Failed to enable biometrics');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const authenticateWithBiometric = async (): Promise<boolean> => {
    setLoading(true);
    try {
      // Get authentication challenge
      const { data: challengeData, error: challengeError } = await supabase.functions.invoke('webauthn', {
        body: { action: 'auth-challenge' },
      });

      if (challengeError) throw new Error(challengeError.message);

      const { challenge, tempId, allowCredentials, rpId } = challengeData;

      // Authenticate with biometric
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: base64ToArrayBuffer(challenge),
          allowCredentials: allowCredentials.map((id: string) => ({
            id: base64ToArrayBuffer(id),
            type: 'public-key' as const,
            transports: ['internal' as AuthenticatorTransport],
          })),
          userVerification: 'required',
          rpId,
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (!assertion) throw new Error('Biometric authentication cancelled');

      const credentialId = arrayBufferToBase64(assertion.rawId);

      // Verify with server
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('webauthn', {
        body: {
          action: 'auth-verify',
          credentialId,
          tempId,
        },
      });

      if (verifyError) throw new Error(verifyError.message);

      if (verifyData.success && verifyData.token && verifyData.email) {
        // Use the token to sign in via OTP verification
        const { error: signInError } = await supabase.auth.verifyOtp({
          email: verifyData.email,
          token: verifyData.token,
          type: 'magiclink',
        });
        if (signInError) throw signInError;
        return true;
      }

      throw new Error('Authentication failed');
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        toast.error('Biometric authentication was cancelled');
      } else {
        toast.error(error.message || 'Biometric authentication failed');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeBiometric = async (credentialDbId: string) => {
    try {
      const { error } = await supabase
        .from('user_webauthn_credentials')
        .delete()
        .eq('id', credentialDbId);
      if (error) throw error;
      toast.success('Biometric credential removed');
      await fetchCredentials();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove credential');
    }
  };

  return {
    isSupported,
    isEnrolled,
    credentials,
    loading,
    enrollBiometric,
    authenticateWithBiometric,
    removeBiometric,
    fetchCredentials,
  };
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone (Face ID / Touch ID)';
  if (/iPad/.test(ua)) return 'iPad (Touch ID / Face ID)';
  if (/Macintosh/.test(ua)) return 'Mac (Touch ID)';
  if (/Android/.test(ua)) return 'Android (Fingerprint)';
  if (/Windows/.test(ua)) return 'Windows (Hello)';
  return 'Biometric Device';
}
