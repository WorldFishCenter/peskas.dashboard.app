/*
 * How a ToggleGroupItem shows what the reader picked: classes on the item keyed on
 * `aria-pressed`, the way shadcn's Toggle docs style a pressed toggle
 * (`group-aria-pressed/toggle:`). The item's own pressed style, `bg-muted`, is too faint
 * to read as a choice.
 */

/** One choice among several (the time range, a measure): the chosen item takes the accent colour. */
export const CHOSEN =
  "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground";

/**
 * A legend that filters the map, every item on at first: an item switched off fades and is
 * struck through, so the ones left on read as the selection. Its swatch takes `SWATCH_ON`.
 */
export const LEGEND_FILTER =
  "aria-pressed:bg-transparent not-aria-pressed:text-muted-foreground not-aria-pressed:line-through";

/** A legend item's colour swatch: full while the item is on, faint once it is off. */
export const SWATCH_ON = "opacity-30 group-aria-pressed/toggle:opacity-100";
