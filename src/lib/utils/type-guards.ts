/**
 * Runtime type guard functions for validating data at runtime
 * Provides type-safe narrowing for untrusted or dynamically typed data
 */

import type { ImageAttachment, SerializedImageAttachment } from '@/lib/agent/types'

/**
 * Type guard for ImageAttachment/SerializedImageAttachment
 * Validates the discriminator and required fields
 */
export function isImageAttachment(value: unknown): value is ImageAttachment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: unknown }).type === 'image' &&
    'mimeType' in value &&
    typeof (value as { mimeType: unknown }).mimeType === 'string' &&
    'data' in value &&
    typeof (value as { data: unknown }).data === 'string'
  )
}

/**
 * Type guard for ImageAttachment[] array
 */
export function isImageAttachments(value: unknown): value is ImageAttachment[] {
  return Array.isArray(value) && value.every(isImageAttachment)
}

/**
 * Type guard for SerializedImageAttachment (alias, same shape as ImageAttachment)
 */
export const isSerializedImageAttachment: (value: unknown) => value is SerializedImageAttachment = isImageAttachment
