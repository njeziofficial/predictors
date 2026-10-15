// Passkeys: signing in with the phone's fingerprint, face or screen lock instead of a password
// (WebAuthn). The backend's PasskeyService checks everything; this file talks to the browser:
// whether this device can, what to call it, and turning the server's options into the browser's
// format and its answers back into JSON.

/** How this device checks it's you, in its own words, for buttons and explanations. */
export interface BiometricLabel {
  // "Face ID or Touch ID", "fingerprint or face unlock"…
  method: string;
  // A name for the passkey, so the player can tell their devices apart in Profile.
  deviceName: string;
}

const ua = () => navigator.userAgent;

export const biometricLabel = (): BiometricLabel => {
  const agent = ua();
  if (/iphone|ipod/i.test(agent)) return { method: "Face ID or Touch ID", deviceName: "iPhone" };
  if (/ipad/i.test(agent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))
    return { method: "Face ID or Touch ID", deviceName: "iPad" };
  if (/android/i.test(agent)) return { method: "fingerprint or face unlock", deviceName: "Android phone" };
  if (/macintosh|mac os x/i.test(agent)) return { method: "Touch ID", deviceName: "Mac" };
  if (/windows/i.test(agent)) return { method: "Windows Hello", deviceName: "Windows computer" };
  return { method: "fingerprint or face", deviceName: "This device" };
};

/** Whether this device can sign in with fingerprint or face: it has one, and the browser can use it. */
export async function biometricsAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential || !navigator.credentials) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Which passkey is this device's (its credential id, base64url), once it's been set up or used
// here, so Profile can show the switch for this device and the sign-in page can lead with it.
const HERE_KEY = "op_passkey_here";
export const passkeyIdHere = (): string | null => {
  try {
    const id = localStorage.getItem(HERE_KEY);
    return id && id !== "1" ? id : null;
  } catch {
    return null;
  }
};
export const passkeyUsedHere = () => passkeyIdHere() !== null;
export const rememberPasskeyHere = (credentialId: string | null) => {
  try {
    if (credentialId) localStorage.setItem(HERE_KEY, credentialId);
    else localStorage.removeItem(HERE_KEY);
  } catch {
    // Storage unavailable: the button is still there, just not first.
  }
};

/**
 * After a passkey is removed from the account: tells the phone so it can drop it from its list
 * too, where the browser supports that (Chrome 132+, Safari 26+). Elsewhere the phone keeps
 * offering it, and signing in with it just says it's no longer set up.
 */
export const forgetPasskeyOnDevice = async (credentialId: string) => {
  if (passkeyIdHere() === credentialId) rememberPasskeyHere(null);
  try {
    const signal = (
      window.PublicKeyCredential as unknown as {
        signalUnknownCredential?: (o: { rpId: string; credentialId: string }) => Promise<void>;
      }
    )?.signalUnknownCredential;
    await signal?.call(window.PublicKeyCredential, { rpId: location.hostname, credentialId });
  } catch {
    // Not supported, or the phone didn't have it: nothing to do.
  }
};

// ── base64url ↔ bytes ─────────────────────────────────────────────────────────

export const fromB64url = (value: string): ArrayBuffer => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
};

export const toB64url = (buffer: ArrayBuffer | ArrayBufferView): string => {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// The server's options as JSON (byte fields base64url); only the fields the browser uses.
interface CredentialDescriptorJson {
  type: "public-key";
  id: string;
  transports?: AuthenticatorTransport[];
}
export interface CreationOptionsJson {
  rp: PublicKeyCredentialRpEntity;
  user: { id: string; name: string; displayName: string };
  challenge: string;
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  excludeCredentials?: CredentialDescriptorJson[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
}
export interface RequestOptionsJson {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: CredentialDescriptorJson[];
  userVerification?: UserVerificationRequirement;
}

const descriptor = (d: CredentialDescriptorJson): PublicKeyCredentialDescriptor => ({
  type: d.type,
  id: fromB64url(d.id),
  ...(d.transports?.length ? { transports: d.transports } : {}),
});

export const creationOptions = (json: CreationOptionsJson): PublicKeyCredentialCreationOptions => ({
  rp: json.rp,
  user: { ...json.user, id: fromB64url(json.user.id) },
  challenge: fromB64url(json.challenge),
  pubKeyCredParams: json.pubKeyCredParams,
  timeout: json.timeout,
  excludeCredentials: (json.excludeCredentials ?? []).map(descriptor),
  authenticatorSelection: json.authenticatorSelection,
  attestation: json.attestation ?? "none",
});

export const requestOptions = (json: RequestOptionsJson): PublicKeyCredentialRequestOptions => ({
  challenge: fromB64url(json.challenge),
  timeout: json.timeout,
  rpId: json.rpId,
  allowCredentials: (json.allowCredentials ?? []).map(descriptor),
  userVerification: json.userVerification ?? "required",
});

// ── The ceremonies ────────────────────────────────────────────────────────────

/** A device's answer, as the server's JSON (byte fields base64url). */
export interface PasskeyAnswer {
  id: string;
  rawId: string;
  type: string;
  response: Record<string, unknown>;
  clientExtensionResults: unknown;
}

/** Thrown when the player closed the prompt or the device said no: nothing to report. */
export class PasskeyCancelled extends Error {
  constructor() {
    super("Cancelled.");
  }
}

// Under this, a refusal came before any prompt could have been shown: the phone said no by
// itself (no passkey manager, no screen lock…) rather than the player cancelling.
const INSTANT_MS = 1500;

const browserError = (err: unknown, startedAt: number, creating: boolean): Error => {
  if (err instanceof DOMException) {
    // NotAllowedError: dismissed, timed out, or refused. AbortError: cancelled.
    if (err.name === "AbortError") return new PasskeyCancelled();
    if (err.name === "NotAllowedError") {
      if (Date.now() - startedAt > INSTANT_MS) return new PasskeyCancelled();
      return new Error(
        creating
          ? "Your phone didn't let the app save a passkey. Check that a screen lock and a fingerprint or face are set up, and that a passkey manager is on (Android: Settings › Passwords & accounts › Google Password Manager; iPhone: Settings › Passwords › iCloud Keychain)."
          : "Your phone has no fingerprint or face sign-in for this account. Sign in with your password, then turn it on in Profile.",
      );
    }
    if (err.name === "InvalidStateError") return new Error("This device is already set up for your account.");
    if (err.name === "SecurityError") return new Error("Passkeys don't work on this address. Open the app from its usual link.");
    // Anything else: say what the phone said, so it can be looked into.
    return new Error(`Your phone couldn't do that (${err.name}${err.message ? `: ${err.message}` : ""}).`);
  }
  return err instanceof Error ? err : new Error("Your device couldn't do that.");
};

/** Asks the device to create a passkey; the answer as the server's JSON. */
export async function createPasskey(options: CreationOptionsJson): Promise<PasskeyAnswer> {
  let credential: PublicKeyCredential;
  const startedAt = Date.now();
  try {
    credential = (await navigator.credentials.create({ publicKey: creationOptions(options) })) as PublicKeyCredential;
  } catch (err) {
    throw browserError(err, startedAt, true);
  }
  if (!credential) throw new PasskeyCancelled();
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: toB64url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: toB64url(response.attestationObject),
      clientDataJSON: toB64url(response.clientDataJSON),
      transports: typeof response.getTransports === "function" ? response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
  };
}

/** Asks the device to sign in with one of its passkeys for this site; the answer as the server's JSON. */
export async function askForPasskey(options: RequestOptionsJson): Promise<PasskeyAnswer> {
  let credential: PublicKeyCredential;
  const startedAt = Date.now();
  try {
    credential = (await navigator.credentials.get({ publicKey: requestOptions(options) })) as PublicKeyCredential;
  } catch (err) {
    throw browserError(err, startedAt, false);
  }
  if (!credential) throw new PasskeyCancelled();
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: toB64url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: toB64url(response.authenticatorData),
      signature: toB64url(response.signature),
      clientDataJSON: toB64url(response.clientDataJSON),
      userHandle: response.userHandle ? toB64url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
  };
}

// ── The one-time offer after a password sign-in (BiometricOffer) ─────────────

const OFFER_KEY = "op_offer_passkey";
const OFFER_DECLINED_KEY = "op_passkey_offer_declined";

/** After a password sign-in: the next screen may offer fingerprint/face for next time. */
export const offerBiometricsNextScreen = () => {
  try {
    sessionStorage.setItem(OFFER_KEY, "1");
  } catch {
    // Storage unavailable: no offer, Profile still has it.
  }
};

/** Whether to offer now; asking once uses the offer up. */
export const takeBiometricsOffer = (): boolean => {
  try {
    if (sessionStorage.getItem(OFFER_KEY) !== "1") return false;
    sessionStorage.removeItem(OFFER_KEY);
    return localStorage.getItem(OFFER_DECLINED_KEY) !== "1" && !passkeyUsedHere();
  } catch {
    return false;
  }
};

/** "Not now": this device isn't offered again (Profile still has it). */
export const declineBiometricsOffer = () => {
  try {
    localStorage.setItem(OFFER_DECLINED_KEY, "1");
  } catch {
    // Storage unavailable: offered again next sign-in, nothing worse.
  }
};
