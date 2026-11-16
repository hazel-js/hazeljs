export interface BrandColors {
  primary?: string;
  background?: string;
  text?: string;
  muted?: string;
  buttonText?: string;
}

export interface BrandTheme {
  name: string;
  logoUrl?: string;
  colors?: BrandColors;
  footer?: string;
  supportEmail?: string;
  websiteUrl?: string;
}

export const DEFAULT_BRAND: BrandTheme = {
  name: 'Hazel',
  colors: {
    primary: '#0F766E',
    background: '#FFFFFF',
    text: '#111827',
    muted: '#6B7280',
    buttonText: '#FFFFFF',
  },
  footer: 'Sent by HazelJS',
};

export function resolveBrands(
  brand?: BrandTheme | Record<string, BrandTheme>
): Record<string, BrandTheme> {
  if (!brand) {
    return { default: DEFAULT_BRAND };
  }
  if ('name' in brand && typeof (brand as BrandTheme).name === 'string' && !isBrandMap(brand)) {
    return { default: brand as BrandTheme };
  }
  const map = brand as Record<string, BrandTheme>;
  return Object.keys(map).length > 0 ? map : { default: DEFAULT_BRAND };
}

function isBrandMap(value: BrandTheme | Record<string, BrandTheme>): boolean {
  const keys = Object.keys(value);
  if (keys.includes('name') && keys.includes('colors')) {
    return false;
  }
  return keys.every((k) => typeof (value as Record<string, BrandTheme>)[k]?.name === 'string');
}
