import { invoke } from "@tauri-apps/api/core";

import type { ActivityAction } from "@/db/types";

import type { LoginResponse, SessionValidation } from "./types";

export async function loginRequest(
  username: string,
  password: string,
): Promise<LoginResponse> {
  return invoke<LoginResponse>("login", { username, password });
}

export async function validateSessionRequest(
  token: string,
): Promise<SessionValidation> {
  return invoke<SessionValidation>("validate_session", { token });
}

export async function logoutRequest(token: string): Promise<void> {
  return invoke<void>("logout", { token });
}

export interface LogActivityInput {
  action: ActivityAction;
  entity?: string;
  entityId?: number;
  description: string;
}

/** Mencatat aktivitas memakai identitas sesi yang sedang aktif di Rust. */
export async function logActivityRequest(
  token: string,
  input: LogActivityInput,
): Promise<void> {
  return invoke<void>("log_activity", {
    token,
    action: input.action,
    entity: input.entity ?? null,
    entityId: input.entityId ?? null,
    description: input.description,
  });
}
