import { invoke } from "@tauri-apps/api/core";

export interface CustomerInput {
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
}

export async function createCustomerRequest(
  token: string,
  input: CustomerInput,
): Promise<number> {
  return invoke<number>("create_customer", {
    token,
    name: input.name,
    phone: input.phone,
    address: input.address,
    notes: input.notes,
  });
}

export async function updateCustomerRequest(
  token: string,
  customerId: number,
  input: CustomerInput,
): Promise<void> {
  return invoke<void>("update_customer", {
    token,
    customerId,
    name: input.name,
    phone: input.phone,
    address: input.address,
    notes: input.notes,
  });
}

export async function deleteCustomerRequest(
  token: string,
  customerId: number,
): Promise<void> {
  return invoke<void>("delete_customer", {
    token,
    customerId,
  });
}
