/**
 * Format location text for display: strip shelf designators so we show only
 * the actual place (node name, "With …", or address). Shelf is not a first-class
 * concept in the app, so we normalize any legacy ", Shelf X" suffix away.
 */
export function formatLocationForDisplay(locationText: string | null | undefined): string {
  if (locationText == null || locationText.trim() === "") return ""
  const trimmed = locationText.trim()
  // Remove trailing ", Shelf <token>" (e.g. ", Shelf A", ", shelf 1") so we show location only.
  const withoutShelf = trimmed.replace(/,?\s*Shelf\s+[A-Za-z0-9]+$/i, "").trim()
  return withoutShelf || trimmed
}
