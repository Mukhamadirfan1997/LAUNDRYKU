import { invoke } from "@tauri-apps/api/core";

export interface ItemInput {
  name: string;
  unit: string;
  price: number;
  stock: number;
  isActive: boolean;
}

export interface ServiceInput {
  category: string;
  speed: string;
  unit: string;
  price: number;
  isActive: boolean;
}

export async function createItemRequest(
  token: string,
  input: ItemInput,
): Promise<number> {
  return invoke<number>("create_item", {
    token,
    name: input.name,
    unit: input.unit,
    price: input.price,
    stock: input.stock,
    isActive: input.isActive,
  });
}

export async function updateItemRequest(
  token: string,
  itemId: number,
  input: ItemInput,
): Promise<void> {
  return invoke<void>("update_item", {
    token,
    itemId,
    name: input.name,
    unit: input.unit,
    price: input.price,
    stock: input.stock,
    isActive: input.isActive,
  });
}

export async function setItemActiveRequest(
  token: string,
  itemId: number,
  isActive: boolean,
): Promise<void> {
  return invoke<void>("set_item_active", {
    token,
    itemId,
    isActive,
  });
}

export async function deleteItemRequest(
  token: string,
  itemId: number,
): Promise<void> {
  return invoke<void>("delete_item", {
    token,
    itemId,
  });
}

export async function createServiceRequest(
  token: string,
  input: ServiceInput,
): Promise<number> {
  return invoke<number>("create_service", {
    token,
    category: input.category,
    speed: input.speed,
    unit: input.unit,
    price: input.price,
    isActive: input.isActive,
  });
}

export async function updateServiceRequest(
  token: string,
  serviceId: number,
  input: ServiceInput,
): Promise<void> {
  return invoke<void>("update_service", {
    token,
    serviceId,
    category: input.category,
    speed: input.speed,
    unit: input.unit,
    price: input.price,
    isActive: input.isActive,
  });
}

export async function deleteServiceRequest(
  token: string,
  serviceId: number,
): Promise<void> {
  return invoke<void>("delete_service", {
    token,
    serviceId,
  });
}

export async function setServiceActiveRequest(
  token: string,
  serviceId: number,
  isActive: boolean,
): Promise<void> {
  return invoke<void>("set_service_active", {
    token,
    serviceId,
    isActive,
  });
}
