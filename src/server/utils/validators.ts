
import { ObjectId } from 'mongodb';

export function validateObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): boolean {
  // At least 8 characters, with at least 1 uppercase letter, 1 lowercase letter, and 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
}

export function sanitizeInput(input: string): string {
  // Basic sanitization to prevent MongoDB injection
  return input.replace(/[${}()]/g, '');
}

export function validateSongInput(input: any): boolean {
  const genreValid = Array.isArray(input.genre)
    ? input.genre.length > 0 && input.genre.every((g: any) => typeof g === 'string')
    : typeof input.genre === 'string';
  return (
    input &&
    typeof input.title === 'string' &&
    typeof input.artist === 'string' &&
    genreValid &&
    typeof input.lyrics === 'string' &&
    typeof input.createdBy === 'string' &&
    validateObjectId(input.createdBy)
  );
}

export function validateGroupInput(input: any): boolean {
  return (
    input &&
    typeof input.name === 'string' &&
    typeof input.description === 'string' &&
    typeof input.organizationId === 'string' &&
    validateObjectId(input.organizationId) &&
    Array.isArray(input.members) &&
    input.members.every((memberId: string) => validateObjectId(memberId))
  );
}

export function validateMessageInput(input: any): boolean {
  return (
    input &&
    typeof input.content === 'string' &&
    typeof input.groupId === 'string' &&
    validateObjectId(input.groupId)
  );
}
