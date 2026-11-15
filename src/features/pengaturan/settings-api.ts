import { invoke } from "@tauri-apps/api/core";

import type {
  AccountCreateInput,
  AccountUpdateInput,
  BackupInfo,
  BackupSnapshot,
  EmployeeInput,
  RestoreInfo,
} from "./types";

export async function updateBusinessProfileRequest(
  token: string,
  input: {
    businessName: string;
    ownerName: string;
    address: string;
    phone: string;
  },
): Promise<void> {
  return invoke<void>("update_business_profile", {
    token,
    businessName: input.businessName,
    ownerName: input.ownerName,
    address: input.address,
    phone: input.phone,
  });
}

export async function createEmployeeRequest(
  token: string,
  input: EmployeeInput,
): Promise<number> {
  return invoke<number>("create_employee", {
    token,
    name: input.name,
    position: input.position,
    phone: input.phone,
    address: input.address,
  });
}

export async function updateEmployeeRequest(
  token: string,
  employeeId: number,
  input: EmployeeInput,
): Promise<void> {
  return invoke<void>("update_employee", {
    token,
    employeeId,
    name: input.name,
    position: input.position,
    phone: input.phone,
    address: input.address,
  });
}

export async function setEmployeeActiveRequest(
  token: string,
  employeeId: number,
  isActive: boolean,
): Promise<void> {
  return invoke<void>("set_employee_active", {
    token,
    employeeId,
    isActive,
  });
}

export async function deleteEmployeeRequest(
  token: string,
  employeeId: number,
): Promise<void> {
  return invoke<void>("delete_employee", { token, employeeId });
}

export async function createAccountRequest(
  token: string,
  input: AccountCreateInput,
): Promise<number> {
  return invoke<number>("create_user_account", {
    token,
    employeeId: input.employeeId,
    username: input.username,
    password: input.password,
    isActive: input.isActive,
  });
}

export async function updateAccountRequest(
  token: string,
  accountId: number,
  input: AccountUpdateInput,
): Promise<void> {
  return invoke<void>("update_user_account", {
    token,
    accountId,
    employeeId: input.employeeId,
    username: input.username,
    isActive: input.isActive,
  });
}

export async function setAccountActiveRequest(
  token: string,
  accountId: number,
  isActive: boolean,
): Promise<void> {
  return invoke<void>("set_user_account_active", {
    token,
    accountId,
    isActive,
  });
}

export async function deleteAccountRequest(
  token: string,
  accountId: number,
): Promise<void> {
  return invoke<void>("delete_user_account", { token, accountId });
}

export async function changePasswordRequest(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return invoke<void>("change_password", {
    token,
    currentPassword,
    newPassword,
  });
}

export async function prepareDatabaseBackupRequest(
  token: string,
): Promise<BackupSnapshot> {
  return invoke<BackupSnapshot>("prepare_database_backup", { token });
}

export async function finalizeDatabaseBackupRequest(
  token: string,
  snapshotPath: string,
  targetPath: string,
): Promise<BackupInfo> {
  return invoke<BackupInfo>("finalize_database_backup", {
    token,
    snapshotPath,
    targetPath,
  });
}

export async function discardDatabaseBackupRequest(
  token: string,
  snapshotPath: string,
): Promise<void> {
  return invoke<void>("discard_database_backup", { token, snapshotPath });
}

export async function restoreDatabaseRequest(
  token: string,
  path: string,
): Promise<RestoreInfo> {
  return invoke<RestoreInfo>("restore_database", { token, path });
}
