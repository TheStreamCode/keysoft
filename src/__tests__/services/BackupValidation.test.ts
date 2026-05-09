import { validateBackupData } from '../../services/import-export/backupValidation';

describe('Backup import validation', () => {
  it('should normalize valid passwords and notes', () => {
    const now = 1625097600000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const result = validateBackupData({
      passwords: [
        {
          id: 'password-1',
          title: 'Email',
          username: 'user@example.com',
          password: 'secret',
        },
      ],
      notes: [
        {
          id: 'note-1',
          title: 'Recovery',
          content: 'codes',
        },
      ],
    });

    expect(result.passwords).toEqual([
      expect.objectContaining({
        id: 'password-1',
        title: 'Email',
        username: 'user@example.com',
        password: 'secret',
        createdAt: now,
        updatedAt: now,
      }),
    ]);
    expect(result.notes).toEqual([
      expect.objectContaining({
        id: 'note-1',
        title: 'Recovery',
        content: 'codes',
        createdAt: now,
        updatedAt: now,
        isPinned: false,
      }),
    ]);
  });

  it('should reject backups without passwords or notes arrays', () => {
    expect(() => validateBackupData({ version: '1.0' })).toThrow('Invalid backup data');
  });

  it('should reject malformed password and note objects', () => {
    expect(() =>
      validateBackupData({
        passwords: [{ title: 'Email', username: 'user@example.com' }],
      }),
    ).toThrow('Invalid backup data');

    expect(() =>
      validateBackupData({
        notes: [{ title: 'Recovery', content: 123 }],
      }),
    ).toThrow('Invalid backup data');
  });
});
