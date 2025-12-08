/**
 * Input sanitization utilities
 * Helps prevent XSS and injection attacks
 */

/**
 * Sanitize HTML string
 * Removes potentially dangerous HTML tags and attributes
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Remove script tags and event handlers
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');
}

/**
 * Sanitize string input
 * Removes control characters and normalizes whitespace
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  return input
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Sanitize URL
 * Validates and sanitizes URL input
 */
export function sanitizeUrl(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  try {
    const url = new URL(input);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Sanitize email
 * Basic email validation and sanitization
 */
export function sanitizeEmail(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  const email = input.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return '';
  }

  return email;
}

/**
 * Sanitize SQL input (for raw queries)
 * Escapes special characters (use parameterized queries instead!)
 */
export function sanitizeSql(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // WARNING: This is a basic sanitization
  // Always use parameterized queries with Prisma instead!
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

/**
 * Sanitize object recursively
 * Applies sanitization to all string values in an object
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    sanitizeHtml?: boolean;
    sanitizeStrings?: boolean;
    allowedKeys?: string[];
    maxDepth?: number;
  } = {}
): T {
  const {
    sanitizeHtml: sanitizeHtmlFields = false,
    sanitizeStrings: sanitizeStringFields = true,
    allowedKeys,
    maxDepth = 10,
  } = options;

  if (maxDepth <= 0) {
    return obj;
  }

  const sanitized = {} as T;

  for (const [key, value] of Object.entries(obj)) {
    // Skip disallowed keys
    if (allowedKeys && !allowedKeys.includes(key)) {
      continue;
    }

    if (typeof value === 'string') {
      if (sanitizeHtmlFields) {
        (sanitized as Record<string, unknown>)[key] = sanitizeHtml(value);
      } else if (sanitizeStringFields) {
        (sanitized as Record<string, unknown>)[key] = sanitizeString(value);
      } else {
        (sanitized as Record<string, unknown>)[key] = value;
      }
    } else if (Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? sanitizeObject(item as Record<string, unknown>, {
              sanitizeHtml: sanitizeHtmlFields,
              sanitizeStrings: sanitizeStringFields,
              maxDepth: maxDepth - 1,
            })
          : typeof item === 'string'
            ? sanitizeHtmlFields
              ? sanitizeHtml(item)
              : sanitizeStringFields
                ? sanitizeString(item)
                : item
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(
        value as Record<string, unknown>,
        {
          sanitizeHtml: sanitizeHtmlFields,
          sanitizeStrings: sanitizeStringFields,
          maxDepth: maxDepth - 1,
        }
      );
    } else {
      (sanitized as Record<string, unknown>)[key] = value;
    }
  }

  return sanitized;
}

/**
 * Escape HTML entities
 * Converts special characters to HTML entities
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return input.replace(/[&<>"']/g, (m) => map[m]);
}

