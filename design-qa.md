# Design QA — Arched photo treatment

- source visual truth path: `docs/reference-arched-photo.jpg`
- implementation URL: `http://localhost:4173/#wedding-card`
- combined comparison URL: `http://localhost:4173/docs/qa-compare.html`
- mobile viewport: `390 × 844` CSS px
- source pixels: `720 × 1280`
- implementation capture pixels: `390 × 844`
- device scale factor: `1`
- density normalization: the source and the live `390 × 844` implementation were rendered side by side inside a `1000 × 900` comparison view without stretching.
- state: invitation card open, `.couple` section centered, scroll-reveal transition completed.

## Findings

No actionable P0, P1, or P2 differences remain for the requested image-embedding treatment.

- Fonts and typography: the implementation keeps the existing Iran Nastaliq typography and moves the section text to white with a restrained shadow, matching the reference's readable text-over-photo treatment.
- Spacing and layout rhythm: the image is now isolated inside a tall, narrow arched capsule with generous ivory space around it. Its proportions and vertical rhythm closely follow the reference while fitting the existing card width.
- Colors and visual tokens: white/ivory, black, and the existing gold token are preserved. The photo frame uses a fine gold inner edge and a second subtle outer gold edge.
- Image quality and asset fidelity: the user-supplied `IMG_5600.JPG` is optimized to `1200 × 1600` for the web and cropped with `cover` inside the frame; the couple and bouquet remain the focal point without stretching.
- Copy and content: the existing names and invitation text remain editable HTML content and are unchanged.

## Full-view comparison evidence

The combined comparison at `docs/qa-compare.html` shows the reference and mobile implementation in one browser capture. Both use a tall arched photo window, thin gold edging, ivory surrounding space, a warm photo crop, and white calligraphic text inside the image.

## Focused region comparison evidence

The photo-frame region was inspected at `390 × 844`. The gold edge is continuous, the upper arch and rounded lower corners are clean, the image crop preserves the couple's hands and bouquet, and all text remains legible. No additional crop was required because the comparison view renders the target component at readable size.

## Comparison history

1. The original implementation used the photo as a full rectangular section background with a translucent white overlay; this was the core P1 mismatch against the selected reference.
2. The photo was moved into a dedicated `.couple__portrait` frame with an arched capsule silhouette, double gold edge, ivory surround, white text, and mobile-specific proportions.
3. The revised implementation was rendered at `390 × 844` and compared side by side with the source. No further P0/P1/P2 issues were found. The main app console had no errors.

## Implementation checklist

- [x] Tall arched image window
- [x] Fine gold double outline
- [x] Ivory negative space around the photo
- [x] White Nastaliq text inside the photo
- [x] Requested `IMG_5600.JPG` installed and optimized
- [x] Smooth image/text reveal preserved
- [x] Mobile crop and console verified

## Follow-up polish

- P3: If desired, the frame can be made slightly wider or the image darkening reduced after reviewing it on the final guest devices.

final result: passed
