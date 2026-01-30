/**
 * AI-friendly time formatting utilities with timezone and relative time info.
 */

export interface FormatTimeOptions {
  timezone?: string; // IANA timezone, e.g. 'America/New_York'. Defaults to local.
  referenceTime?: Date; // Reference time for relative calculation. Defaults to now.
}

/**
 * Formats duration in a human-friendly gradual way.
 * Shows the most relevant unit: seconds → minutes → hours → days → weeks → months → years.
 */
function formatRelativeDuration(diffMs: number): string {
  const absDiff = Math.abs(diffMs);
  const isPast = diffMs < 0;
  const suffix = isPast ? 'ago' : '';
  const prefix = isPast ? '' : 'in ';

  const seconds = Math.floor(absDiff / 1000);
  if (seconds < 60) {
    return `${prefix}${seconds}s${suffix ? ' ' + suffix : ''}`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${prefix}${minutes}m${suffix ? ' ' + suffix : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainingMins = minutes % 60;
    if (remainingMins > 0) {
      return `${prefix}${hours}h ${remainingMins}m${suffix ? ' ' + suffix : ''}`;
    }
    return `${prefix}${hours}h${suffix ? ' ' + suffix : ''}`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${prefix}${days}d ${remainingHours}h${suffix ? ' ' + suffix : ''}`;
    }
    return `${prefix}${days}d${suffix ? ' ' + suffix : ''}`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    const remainingDays = days % 7;
    if (remainingDays > 0) {
      return `${prefix}${weeks}w ${remainingDays}d${suffix ? ' ' + suffix : ''}`;
    }
    return `${prefix}${weeks}w${suffix ? ' ' + suffix : ''}`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${prefix}${months}mo${suffix ? ' ' + suffix : ''}`;
  }

  const years = Math.floor(days / 365);
  const remainingMonths = Math.floor((days % 365) / 30);
  if (remainingMonths > 0) {
    return `${prefix}${years}y ${remainingMonths}mo${suffix ? ' ' + suffix : ''}`;
  }
  return `${prefix}${years}y${suffix ? ' ' + suffix : ''}`;
}

/**
 * Formats duration for dates only (day granularity).
 * Shows days → weeks → months → years.
 */
function formatRelativeDays(diffMs: number): string {
  const absDiff = Math.abs(diffMs);
  const isPast = diffMs < 0;
  const suffix = isPast ? 'ago' : '';
  const prefix = isPast ? '' : 'in ';

  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return 'today';
  }
  if (days === 1) {
    return isPast ? 'yesterday' : 'tomorrow';
  }

  if (days < 7) {
    return `${prefix}${days}d${suffix ? ' ' + suffix : ''}`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    const remainingDays = days % 7;
    if (remainingDays > 0) {
      return `${prefix}${weeks}w ${remainingDays}d${suffix ? ' ' + suffix : ''}`;
    }
    return `${prefix}${weeks}w${suffix ? ' ' + suffix : ''}`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${prefix}${months}mo${suffix ? ' ' + suffix : ''}`;
  }

  const years = Math.floor(days / 365);
  const remainingMonths = Math.floor((days % 365) / 30);
  if (remainingMonths > 0) {
    return `${prefix}${years}y ${remainingMonths}mo${suffix ? ' ' + suffix : ''}`;
  }
  return `${prefix}${years}y${suffix ? ' ' + suffix : ''}`;
}

/**
 * Gets timezone abbreviation for display.
 */
function getTimezoneAbbr(date: Date, timezone?: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value ?? '';
  } catch {
    return '';
  }
}

/**
 * Formats a Date as an AI-friendly time string with timezone and relative time.
 * Example output: "2024-01-15 14:30:45 (PST) 2h 15m ago"
 */
export function formatTimeAI(date: Date, options?: FormatTimeOptions): string {
  const timezone = options?.timezone;
  const referenceTime = options?.referenceTime ?? new Date();

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const formatted = formatter.format(date).replace(',', '');
  const tzAbbr = getTimezoneAbbr(date, timezone);
  const diffMs = date.getTime() - referenceTime.getTime();
  const relative = formatRelativeDuration(diffMs);

  return `${formatted} (${tzAbbr}) ${relative}`;
}

/**
 * Formats a Date as an AI-friendly date-only string with timezone and relative time.
 * Example output: "2024-01-15 (PST) 3d ago"
 */
export function formatDateAI(date: Date, options?: FormatTimeOptions): string {
  const timezone = options?.timezone;
  const referenceTime = options?.referenceTime ?? new Date();

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const formatted = formatter.format(date);
  const tzAbbr = getTimezoneAbbr(date, timezone);
  const diffMs = date.getTime() - referenceTime.getTime();
  const relative = formatRelativeDays(diffMs);

  return `${formatted} (${tzAbbr}) ${relative}`;
}
