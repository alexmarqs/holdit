/**
 * Whether the dashed square is packed onto the wall.
 *
 * The buy form always keeps the quoted amount and URL. This only decides if
 * the map shows the projection. Fullscreen already hides the form, so a ghost
 * there is an unexplained hole — except on an empty wall, where the dashed
 * square *is* the map. No holders means no toggle: preview stays on.
 */
export function mapPreviewActive(input: {
  wantPreview: boolean;
  amountCents: number | null;
  fullscreen: boolean;
  empty: boolean;
}): boolean {
  if (input.amountCents === null) return false;
  if (input.empty) return true;
  return input.wantPreview && !input.fullscreen;
}
