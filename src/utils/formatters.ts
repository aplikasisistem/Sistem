export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
