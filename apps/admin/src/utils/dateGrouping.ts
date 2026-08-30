/**
 * Date grouping utilities for activity timeline
 */

export interface DateGroup<T> {
  label: string;
  date: Date;
  items: T[];
}

/**
 * Groups items by date with labels: HOY, AYER, or formatted date
 */
export function groupByDate<T extends { created_at: string }>(
  items: T[]
): DateGroup<T>[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = new Map<string, T[]>();

  items.forEach((item) => {
    const itemDate = new Date(item.created_at);
    const itemDay = new Date(
      itemDate.getFullYear(),
      itemDate.getMonth(),
      itemDate.getDate()
    );

    let key: string;
    if (itemDay.getTime() === today.getTime()) {
      key = 'HOY';
    } else if (itemDay.getTime() === yesterday.getTime()) {
      key = 'AYER';
    } else {
      // Format as "DD MMM" (e.g., "27 AGO")
      key = itemDay.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
      }).toUpperCase();
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  });

  // Convert to array and sort by date (most recent first)
  return Array.from(groups.entries())
    .map(([label, items]) => ({
      label,
      date: new Date(items[0].created_at),
      items,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Truncates text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Checks if text is long enough to warrant expansion
 */
export function isLongText(text: string, threshold: number = 150): boolean {
  return text.length > threshold;
}
