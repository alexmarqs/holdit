import { marketingOgImage } from "@/components/map/marketing-og";
import { OG_SIZE } from "@/components/map/wall-card";
import { SHARE_TITLE } from "./copy";

/*
 * One poster, re-exported by an `opengraph-image` file in every segment that
 * needs one.
 */
export const alt = SHARE_TITLE;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return marketingOgImage();
}
