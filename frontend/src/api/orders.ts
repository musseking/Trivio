import { ApiError, request } from './client'
import type { Order } from './types'

/** Ownership is resolved by the server from the JWT; this API accepts no user ID. */
export async function getMyOrders(accessToken: string, signal?: AbortSignal): Promise<Order[]> {
  const orders = await request<Order[]>('/orders/mine', { accessToken, signal })
  if (!Array.isArray(orders)) throw new ApiError(502, 'Server je vratio neočekivan odgovor porudžbina.')
  return orders
}
