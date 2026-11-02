# Kit2 slice guide

All files in this folder's sibling asset directory, `public/ui/kit2/`, are transparent WebP files. The button pieces are intended to be composed as left / stretchable middle / right layers; the CSS helper is in [`app/kit2.css`](../../../app/kit2.css).

| Asset family | Source size | Slice inset | Notes |
| --- | ---: | ---: | --- |
| `btn-<color>-*.webp` | 64×160 / 16×160 / 64×160 | 64px left and right | The 16px middle strip can stretch horizontally; all seven colors share the same 160px height. |
| `panel-cream.webp` | 900×620 | 90px on every edge | Plain cream center; use as a nine-slice frame. |
| `panel-wood.webp` | 900×620 | 90px on every edge | Wood border, plain center; use as a nine-slice frame. |
| `modal-frame.webp` | 720×960 | 112px top, 74px right, 96px bottom, 74px left | Leafy top is kept in the top slice; center is plain. |
| `sign-*.webp` | varies | n/a | Decorative blank headers; scale the whole image. |

Live text is intentionally absent from every image and belongs in the HTML layer.
