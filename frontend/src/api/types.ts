/** DTOs mirror the public Java service records; no demo data is injected. */
export type VehicleStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD'

export interface VehiclePhoto {
  id: number
  url: string
  thumbnailUrl: string
  position: number
  cover: boolean
}

export interface Vehicle {
  id: number
  brand: string
  model: string
  year: number
  price: number
  mileage: number
  fuelType: string
  status: VehicleStatus
  transmission: string | null
  enginePowerHp: number | null
  color: string | null
  description: string | null
  archived: boolean
  version: number
  photos: VehiclePhoto[]
}

/** Status is controlled exclusively by the reservation/payment workflow. */
export interface VehicleRequest {
  brand: string
  model: string
  year: number
  price: number
  mileage: number
  fuelType: string
  transmission?: string | null
  enginePowerHp?: number | null
  color?: string | null
  description?: string | null
  version?: number
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED'

export interface Order {
  id: number
  userId: number | null
  customerName: string
  customerEmail: string
  vehicleId: number
  price: number
  status: OrderStatus
  createdAt: string
}

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'OWNER'

export interface User {
  id: number
  firstName: string
  lastName: string
  email: string
  role: UserRole
  enabled: boolean
  createdAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest extends LoginRequest {
  firstName: string
  lastName: string
}

export interface OwnerSetupRequest extends RegisterRequest {
  setupKey: string
}

export interface OwnerSetupStatus {
  setupAvailable: boolean
}

export interface TokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
}
