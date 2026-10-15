import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  biometricLabel,
  creationOptions,
  declineBiometricsOffer,
  fromB64url,
  offerBiometricsNextScreen,
  passkeyIdHere,
  passkeyUsedHere,
  rememberPasskeyHere,
  requestOptions,
  takeBiometricsOffer,
  toB64url,
} from "@/lib/passkeys";

const passkeyOptions = vi.fn();
const passkeyLogin = vi.fn();
const listPasskeys = vi.fn();
const removePasskey = vi.fn(async (_id: string) => {});
const getPasskeySettings = vi.fn();
const setPasskeySettings = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    auth: { passkeyOptions: () => passkeyOptions(), passkeyLogin: (...a: unknown[]) => passkeyLogin(...a) },
    passkeys: { list: () => listPasskeys(), registrationOptions: vi.fn(), register: vi.fn(), remove: (id: string) => removePasskey(id) },
    admin: { passkeySettings: { get: () => getPasskeySettings(), set: (on: boolean) => setPasskeySettings(on) } },
  },
}));
let currentUser: { id: string; mustResetPassword: boolean } | null = null;
vi.mock("@/context/AppContext", () => ({ useApp: () => ({ currentUser }) }));

const setAgent = (agent: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(agent);

// A device that has a fingerprint or face, and answers as told.
const fakeDevice = (get: () => Promise<unknown>) => {
  vi.stubGlobal("PublicKeyCredential", { isUserVerifyingPlatformAuthenticatorAvailable: async () => true });
  Object.defineProperty(navigator, "credentials", { configurable: true, value: { get: vi.fn(get), create: vi.fn() } });
};

const bytes = (...b: number[]) => new Uint8Array(b).buffer;

describe("passkey formats", () => {
  it("round-trips base64url, including the characters base64 spells differently", () => {
    const data = new Uint8Array([0, 251, 255, 62, 63, 1, 2]);
    const encoded = toB64url(data);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(new Uint8Array(fromB64url(encoded))).toEqual(data);
  });

  it("turns the server's options into what the browser takes", () => {
    const created = creationOptions({
      rp: { id: "octopus.example", name: "Octopus Prediction" },
      user: { id: toB64url(bytes(1, 2, 3)), name: "pat@test", displayName: "Pat" },
      challenge: toB64url(bytes(9, 9)),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      excludeCredentials: [{ type: "public-key", id: toB64url(bytes(7)) }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
    });
    expect(new Uint8Array(created.user.id as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(created.challenge as ArrayBuffer)).toEqual(new Uint8Array([9, 9]));
    expect(new Uint8Array(created.excludeCredentials![0].id as ArrayBuffer)).toEqual(new Uint8Array([7]));
    expect(created.attestation).toBe("none");

    const requested = requestOptions({ challenge: toB64url(bytes(5)) });
    expect(requested.userVerification).toBe("required");
    expect(requested.allowCredentials).toEqual([]);
  });
});

describe("what to call it", () => {
  afterEach(() => vi.restoreAllMocks());

  it("says Face ID on iPhone and fingerprint on Android", () => {
    setAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(biometricLabel()).toEqual({ method: "Face ID or Touch ID", deviceName: "iPhone" });
    setAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)");
    expect(biometricLabel()).toEqual({ method: "fingerprint or face unlock", deviceName: "Android phone" });
  });
});

describe("the offer after a password sign-in", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("is made once, and never after Not now or once it's set up", () => {
    expect(takeBiometricsOffer()).toBe(false);
    offerBiometricsNextScreen();
    expect(takeBiometricsOffer()).toBe(true);
    expect(takeBiometricsOffer()).toBe(false);

    declineBiometricsOffer();
    offerBiometricsNextScreen();
    expect(takeBiometricsOffer()).toBe(false);

    localStorage.clear();
    rememberPasskeyHere("cred-1");
    expect(passkeyUsedHere()).toBe(true);
    offerBiometricsNextScreen();
    expect(takeBiometricsOffer()).toBe(false);
  });
});

describe("signing in with fingerprint or face", () => {
  beforeEach(() => {
    localStorage.clear();
    passkeyOptions.mockResolvedValue({ flowId: "f1", options: { challenge: toB64url(bytes(1)) } });
    setAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderButton = async (onSignedIn = vi.fn(), onError = vi.fn()) => {
    const { default: BiometricSignIn } = await import("@/components/BiometricSignIn");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BiometricSignIn onSignedIn={onSignedIn} onError={onError} />
      </QueryClientProvider>,
    );
    return { onSignedIn, onError };
  };

  const deviceAnswer = {
    id: "cred",
    rawId: bytes(1, 2),
    type: "public-key",
    response: { authenticatorData: bytes(3), signature: bytes(4), clientDataJSON: bytes(5), userHandle: bytes(6) },
    getClientExtensionResults: () => ({}),
  };

  it("signs in with the device's answer and remembers it's used here", async () => {
    fakeDevice(async () => deviceAnswer);
    passkeyLogin.mockResolvedValue({ token: "t", userId: "u1", name: "Pat" });
    const { onSignedIn } = await renderButton();

    const button = await screen.findByText("Sign in with fingerprint or face unlock");
    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" })));
    const [flowId, sent] = passkeyLogin.mock.calls[0];
    expect(flowId).toBe("f1");
    expect(sent).toMatchObject({ rawId: toB64url(bytes(1, 2)), response: { signature: toB64url(bytes(4)), userHandle: toB64url(bytes(6)) } });
    expect(passkeyIdHere()).toBe(toB64url(bytes(1, 2)));
  });

  it("says nothing when the player closes the prompt", async () => {
    // The prompt was up for a few seconds before they closed it.
    const now = Date.now();
    fakeDevice(async () => {
      vi.spyOn(Date, "now").mockReturnValue(now + 5_000);
      throw new DOMException("dismissed", "NotAllowedError");
    });
    const { onSignedIn, onError } = await renderButton();
    const button = await screen.findByText("Sign in with fingerprint or face unlock");
    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(navigator.credentials.get).toHaveBeenCalled());
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalledWith(expect.any(String));
  });

  it("says why when the phone refuses straight away, without showing a prompt", async () => {
    fakeDevice(async () => Promise.reject(new DOMException("refused", "NotAllowedError")));
    const { onError } = await renderButton();
    const button = await screen.findByText("Sign in with fingerprint or face unlock");
    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining("Your phone has no fingerprint or face sign-in")));
  });

  it("isn't shown on a device without fingerprint or face", async () => {
    vi.stubGlobal("PublicKeyCredential", { isUserVerifyingPlatformAuthenticatorAvailable: async () => false });
    await renderButton();
    await act(async () => {});
    expect(screen.queryByText(/Sign in with/)).toBeNull();
  });
});

describe("the one-time offer", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.stubGlobal("PublicKeyCredential", { isUserVerifyingPlatformAuthenticatorAvailable: async () => true });
    setAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    currentUser = { id: "u1", mustResetPassword: false };
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderOffer = async () => {
    const { default: BiometricOffer } = await import("@/components/BiometricOffer");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BiometricOffer />
      </QueryClientProvider>,
    );
  };

  it("asks after a password sign-in, and Not now stops it for this device", async () => {
    listPasskeys.mockResolvedValue([]);
    offerBiometricsNextScreen();
    await renderOffer();
    expect(await screen.findByText("Sign in faster next time?")).toBeTruthy();
    expect(screen.getByText("Use Face ID or Touch ID")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText("Not now"));
    });
    offerBiometricsNextScreen();
    expect(takeBiometricsOffer()).toBe(false);
  });

  it("doesn't ask someone who already has a passkey", async () => {
    listPasskeys.mockResolvedValue([{ id: "p1", name: "iPhone", createdAt: new Date().toISOString(), lastUsedAt: null }]);
    offerBiometricsNextScreen();
    await renderOffer();
    await waitFor(() => expect(listPasskeys).toHaveBeenCalled());
    expect(screen.queryByText("Sign in faster next time?")).toBeNull();
  });
});

describe("the on/off switch in Profile", () => {
  const here = { id: "p1", name: "iPhone", createdAt: new Date().toISOString(), lastUsedAt: null, credentialId: "cred-here" };
  const other = { id: "p2", name: "Android phone", createdAt: new Date().toISOString(), lastUsedAt: null, credentialId: "cred-other" };

  beforeEach(() => {
    localStorage.clear();
    removePasskey.mockClear();
    vi.stubGlobal("PublicKeyCredential", { isUserVerifyingPlatformAuthenticatorAvailable: async () => true });
    setAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderCard = async () => {
    const { BiometricsCard } = await import("@/components/BiometricsCard");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BiometricsCard />
      </QueryClientProvider>,
    );
    return (await screen.findByRole("switch")) as HTMLButtonElement;
  };

  it("is on for the device whose passkey this is, with the others listed", async () => {
    rememberPasskeyHere("cred-here");
    listPasskeys.mockResolvedValue([here, other]);
    const toggle = await renderCard();
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(screen.getByText("Android phone")).toBeTruthy();
    expect(screen.queryByText("iPhone")).toBeNull(); // shown as the switch, not in the list
  });

  it("turning it off asks first, then removes this device's passkey", async () => {
    rememberPasskeyHere("cred-here");
    listPasskeys.mockResolvedValue([here, other]);
    const toggle = await renderCard();
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));

    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(await screen.findByText("Turn off Face ID or Touch ID on this device?")).toBeTruthy();
    expect(removePasskey).not.toHaveBeenCalled();

    listPasskeys.mockResolvedValue([other]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    });
    await waitFor(() => expect(removePasskey).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(passkeyIdHere()).toBeNull());
  });

  it("shows off when this device's passkey was removed elsewhere", async () => {
    rememberPasskeyHere("cred-gone");
    listPasskeys.mockResolvedValue([other]);
    const toggle = await renderCard();
    await waitFor(() => expect(passkeyIdHere()).toBeNull());
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });
});

describe("the system admin's reset setting", () => {
  it("shows the saved choice and saves a change", async () => {
    getPasskeySettings.mockResolvedValue({ removeOnPasswordReset: false });
    setPasskeySettings.mockResolvedValue({ removeOnPasswordReset: true });
    const { default: PasskeySettingsCard } = await import("@/components/PasskeySettingsCard");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PasskeySettingsCard />
      </QueryClientProvider>,
    );
    const toggle = await screen.findByRole("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(setPasskeySettings).toHaveBeenCalledWith(true);
    await waitFor(() => expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true"));
  });
});
