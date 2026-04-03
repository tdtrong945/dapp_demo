/**
 * Gym Backend Services - Unified Exports
 *
 * This module exports all gym backend services for easy integration:
 * - syncGymEvents: Listen to contract events and sync to Supabase
 * - gymMemberService: Member CRUD operations
 * - paymentVerificationService: Payment tracking and verification
 *
 * Usage in Express/API:
 *   import { gymMemberService, paymentVerificationService, startEventListener } from './services/gymBackendServices'
 */

export { startEventListener } from "../scripts/syncGymEvents";
export {
  GymMemberService,
  gymMemberService,
} from "../scripts/gymMemberService";
export {
  PaymentVerificationService,
  paymentVerificationService,
  type PaymentTransaction,
  type PaymentRefund,
} from "../scripts/paymentVerificationService";
