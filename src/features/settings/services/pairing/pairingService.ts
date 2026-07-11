import { invokeCommand } from "@shared/services/db/invoke/command";

export interface PairingToken {
  token: string;
  device_name: string;
  created_at: number;
  expires_at: number;
}

export interface PairedDevice {
  id: string;
  device_name: string;
  device_type: string;
  token_hash: string;
  paired_at: number;
  last_seen_at: number;
  is_active: boolean;
}

export async function generateToken(deviceName: string): Promise<PairingToken> {
  return invokeCommand<PairingToken>("generate_qr_token", { deviceName });
}

export async function verifyToken(token: string, deviceType: string): Promise<PairedDevice> {
  return invokeCommand<PairedDevice>("verify_device_token", { token, deviceType });
}

export async function getQrPayload(token: PairingToken): Promise<string> {
  return invokeCommand<string>("get_qr_payload", { token });
}
