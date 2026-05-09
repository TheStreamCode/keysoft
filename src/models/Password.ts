export interface Password {
  id: string;
  title: string;
  username: string;
  password: string;
  website?: string;
  notes?: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
  strengthScore?: number; // Punteggio di sicurezza (0-4)
  expiryDate?: number; // Timestamp di scadenza
}

export interface PasswordCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface PasswordFilter {
  searchTerm?: string;
  category?: string;
  sortBy?: 'title' | 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
}
