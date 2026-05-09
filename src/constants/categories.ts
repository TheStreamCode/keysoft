import { Category } from '../types/index';

interface DefaultCategoryDefinition {
  id: string;
  translationKey: string;
  icon: string;
  color: string;
}

// Unified category colors without light/dark distinctions
export const CATEGORY_COLORS = {
  favorites: '#FF9800', // arancione
  email: '#4CAF50', // verde
  social: '#2196F3', // blu
  business: '#673AB7', // viola
  banking: '#F44336', // rosso
  shopping: '#00BCD4', // ciano
  gaming: '#9C27B0', // viola-rosa
  music: '#E91E63', // rosa
  other: '#607D8B', // blu-grigio
};

const DEFAULT_CATEGORY_DEFINITIONS: DefaultCategoryDefinition[] = [
  {
    id: 'favorites',
    translationKey: 'category_favorites',
    icon: 'star',
    color: CATEGORY_COLORS.favorites,
  },
  {
    id: 'email',
    translationKey: 'category_email',
    icon: 'mail-outline',
    color: CATEGORY_COLORS.email,
  },
  {
    id: 'social',
    translationKey: 'category_social',
    icon: 'logo-facebook',
    color: CATEGORY_COLORS.social,
  },
  {
    id: 'business',
    translationKey: 'category_business',
    icon: 'briefcase-outline',
    color: CATEGORY_COLORS.business,
  },
  {
    id: 'banking',
    translationKey: 'category_banking',
    icon: 'card-outline',
    color: CATEGORY_COLORS.banking,
  },
  {
    id: 'shopping',
    translationKey: 'category_shopping',
    icon: 'cart-outline',
    color: CATEGORY_COLORS.shopping,
  },
  {
    id: 'gaming',
    translationKey: 'category_gaming',
    icon: 'game-controller-outline',
    color: CATEGORY_COLORS.gaming,
  },
  {
    id: 'music',
    translationKey: 'category_music',
    icon: 'musical-notes-outline',
    color: CATEGORY_COLORS.music,
  },
];

// Get base categories with translated labels
export const getDefaultCategories = (t: (key: string) => string): Category[] =>
  DEFAULT_CATEGORY_DEFINITIONS.map((category) => ({
    id: category.id,
    name: t(category.translationKey) || category.id,
    icon: category.icon,
    color: category.color,
    count: 0,
    isDefault: true,
  }));

// Updated helper that uses translations
export const getAdaptiveCategories = (
  _isDarkMode: boolean,
  t: (key: string) => string,
): Category[] => {
  return getDefaultCategories(t);
};

// Get the translated category name by ID
export const getCategoryName = (categoryId: string, t?: (key: string) => string): string => {
  if (!t) {
    return categoryId;
  }

  // Use translations when available
  const translationKey = `category_${categoryId}`;
  const translatedName = t(translationKey);

  return translatedName || categoryId;
};

// Get colors for the selected category state
export const getSelectedCategoryColors = (categoryId: string) => {
  // Normalize the category ID to lowercase to handle both "Email" and "email"
  const normalizedId = categoryId.toLowerCase();

  // Map category IDs to colors
  const colorKey =
    normalizedId === 'business'
      ? 'business'
      : normalizedId === 'gaming'
        ? 'gaming'
        : normalizedId === 'favorites'
          ? 'favorites'
          : normalizedId === 'music'
            ? 'music'
            : normalizedId in CATEGORY_COLORS
              ? normalizedId
              : 'other';

  const categoryColor = CATEGORY_COLORS[colorKey as keyof typeof CATEGORY_COLORS];

  // Selected-category colors with transparent background and colored border
  return {
    backgroundColor: 'transparent', // Sfondo trasparente per adattarsi allo sfondo dell'app
    textColor: categoryColor,
    borderColor: categoryColor,
  };
};

// Get the category color by ID
export const getCategoryColor = (categoryId: string): string => {
  // Normalize the category ID to lowercase to handle both "Email" and "email"
  const normalizedId = categoryId.toLowerCase();

  const colorKey =
    normalizedId === 'business'
      ? 'business'
      : normalizedId === 'gaming'
        ? 'gaming'
        : normalizedId === 'favorites'
          ? 'favorites'
          : normalizedId === 'music'
            ? 'music'
            : normalizedId in CATEGORY_COLORS
              ? normalizedId
              : 'other';

  return CATEGORY_COLORS[colorKey as keyof typeof CATEGORY_COLORS];
};
