import { z } from 'zod';
import { Note } from '../../models/Note';
import { Password } from '../../models/Password';
import { bytesToHex, getRandomBytes } from '../../utils/cryptoRandom';

const SHORT_TEXT_MAX = 200;
const SECRET_TEXT_MAX = 5000;
export const MAX_BACKUP_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_BACKUP_PASSWORDS = 1000;
export const MAX_BACKUP_NOTES = 5000;

const optionalTimestampSchema = z.number().finite().nonnegative().optional();
const optionalShortTextSchema = z.string().max(SHORT_TEXT_MAX).optional();

const passwordSchema = z.object({
  id: optionalShortTextSchema,
  title: z.string().min(1).max(SHORT_TEXT_MAX),
  username: z.string().max(SHORT_TEXT_MAX),
  password: z.string().min(1).max(SECRET_TEXT_MAX),
  website: optionalShortTextSchema,
  notes: z.string().max(SECRET_TEXT_MAX).optional(),
  category: optionalShortTextSchema,
  createdAt: optionalTimestampSchema,
  updatedAt: optionalTimestampSchema,
  strengthScore: z.number().int().min(0).max(4).optional(),
  expiryDate: optionalTimestampSchema,
});

const noteSchema = z.object({
  id: optionalShortTextSchema,
  title: z.string().min(1).max(SHORT_TEXT_MAX),
  content: z.string().max(SECRET_TEXT_MAX),
  createdAt: optionalTimestampSchema,
  updatedAt: optionalTimestampSchema,
  color: optionalShortTextSchema,
  isPinned: z.boolean().optional(),
});

const backupDataSchema = z
  .object({
    passwords: z.array(passwordSchema).max(MAX_BACKUP_PASSWORDS).optional(),
    notes: z.array(noteSchema).max(MAX_BACKUP_NOTES).optional(),
  })
  .refine((data) => Array.isArray(data.passwords) || Array.isArray(data.notes), {
    message: 'Backup must include passwords or notes',
  });

export interface ValidatedBackupData {
  passwords?: Password[];
  notes?: Note[];
}

export function isBackupFileSizeAllowed(size: number | undefined): boolean {
  return (
    size === undefined ||
    (Number.isSafeInteger(size) && size >= 0 && size <= MAX_BACKUP_FILE_SIZE_BYTES)
  );
}

function createImportId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${bytesToHex(getRandomBytes(8))}`;
}

export function validateBackupData(input: unknown): ValidatedBackupData {
  const result = backupDataSchema.safeParse(input);
  if (!result.success) {
    throw new Error('Invalid backup data');
  }

  const now = Date.now();
  return {
    passwords: result.data.passwords?.map((password): Password => ({
      id: password.id ?? createImportId('password'),
      title: password.title,
      username: password.username,
      password: password.password,
      website: password.website,
      notes: password.notes,
      category: password.category,
      createdAt: password.createdAt ?? now,
      updatedAt: password.updatedAt ?? now,
      strengthScore: password.strengthScore,
      expiryDate: password.expiryDate,
    })),
    notes: result.data.notes?.map((note): Note => ({
      id: note.id ?? createImportId('note'),
      title: note.title,
      content: note.content,
      createdAt: note.createdAt ?? now,
      updatedAt: note.updatedAt ?? now,
      color: note.color,
      isPinned: note.isPinned ?? false,
    })),
  };
}
