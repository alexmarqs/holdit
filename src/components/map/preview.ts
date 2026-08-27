/**
 * Whether the dashed square is packed onto the wall.
 *
 * The buy form always keeps the quoted amount and URL. This only decides if
 * the map shows the projection. Fullscreen already hides the form, so a ghost
 * there is an unexplained hole.
 */
export function mapPreviewActive(input: {
  wantPreview: boolean;
  amountCents: number | null;
  fullscreen: boolean;
}): boolean {
  return input.wantPreview && input.amountCents !== null && !input.fullscreen;
}
