export interface LocalizedText {
  en: string;
  it: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  count?: number;
  isDefault?: boolean;
}
