export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a number or numeric string with thousand separator using dot (.)
 * Example: 20000 -> "20.000", 1500000 -> "1.500.000"
 */
export function formatThousand(
  val: number | string | undefined | null,
  allowDecimal: boolean = false
): string {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val).trim();
  if (str === '') return '';

  if (allowDecimal) {
    // Standardize decimal: replace '.' with ',' if it looks like a decimal (or keep comma)
    // If the string contains comma:
    if (str.includes(',')) {
      const parts = str.split(',');
      const intPart = parts[0].replace(/\D/g, '');
      const decPart = parts.slice(1).join('').replace(/\D/g, '');
      const formattedInt = intPart ? new Intl.NumberFormat('id-ID').format(Number(intPart)) : '0';
      return `${formattedInt},${decPart}`;
    }
    // If string has a decimal dot (e.g. from raw number 2.5 or 0.75):
    if (str.includes('.')) {
      // Check if it's already an Indonesian thousand separator (multiple dots or ends with 3 digits)
      // vs a float representation from JS number like "2.5"
      const floatVal = parseFloat(str);
      if (!isNaN(floatVal) && str.indexOf('.') === str.lastIndexOf('.') && !/^\d{1,3}(\.\d{3})+$/.test(str)) {
        const parts = str.split('.');
        const intPart = parts[0].replace(/\D/g, '');
        const decPart = parts[1].replace(/\D/g, '');
        const formattedInt = intPart ? new Intl.NumberFormat('id-ID').format(Number(intPart)) : '0';
        return decPart ? `${formattedInt},${decPart}` : formattedInt;
      }
    }
  }

  // Pure integer formatting
  const cleanDigits = str.replace(/\D/g, '');
  if (!cleanDigits) return '';
  const num = parseInt(cleanDigits, 10);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('id-ID').format(num);
}

/**
 * Parse a formatted string (with dots as thousand separators) back to raw number
 * Example: "20.000" -> 20000, "1.500.000" -> 1500000, "2,5" -> 2.5
 */
export function parseThousand(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;

  if (str.includes(',')) {
    const parts = str.split(',');
    const intPart = parts[0].replace(/\D/g, '') || '0';
    const decPart = parts.slice(1).join('').replace(/\D/g, '') || '0';
    return parseFloat(`${intPart}.${decPart}`) || 0;
  }

  const clean = str.replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

/**
 * Returns raw numeric string (digits only or digits with . for float)
 */
export function getRawNumericString(val: string | number | undefined | null, allowDecimal: boolean = false): string {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val).trim();
  if (allowDecimal) {
    if (str.includes(',')) {
      const parts = str.split(',');
      const intPart = parts[0].replace(/\D/g, '');
      const decPart = parts.slice(1).join('').replace(/\D/g, '');
      return decPart ? `${intPart}.${decPart}` : intPart;
    }
  }
  return str.replace(/\D/g, '');
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatDateIndo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatDateTimeIndo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Calculates days remaining until expiration
 */
export function getDaysUntilExpired(expiredDateStr?: string): { days: number; isExpired: boolean; isNearExpired: boolean; label: string } | null {
  if (!expiredDateStr) return null;
  const exp = new Date(expiredDateStr);
  const now = new Date();
  // reset hours
  exp.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return {
      days: diffDays,
      isExpired: true,
      isNearExpired: false,
      label: `Kedaluwarsa (${Math.abs(diffDays)} hari lalu)`,
    };
  } else if (diffDays <= 30) {
    return {
      days: diffDays,
      isExpired: false,
      isNearExpired: true,
      label: `H-${diffDays} Kadaluwarsa`,
    };
  } else {
    return {
      days: diffDays,
      isExpired: false,
      isNearExpired: false,
      label: `${diffDays} hari lagi`,
    };
  }
}
