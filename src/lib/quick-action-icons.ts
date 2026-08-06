// Maps backend quick-action keys (QuickActionsController.CATALOG) to the
// hand-drawn icon assets in assets/icons, replacing the default emoji.
export const QuickActionIcons: Record<string, number> = {
  trash: require('@/assets/icons/trashcan.png'),
  dishwasher: require('@/assets/icons/dishwasher.png'),
  countertop: require('@/assets/icons/sponge.png'),
  tidy_livingroom: require('@/assets/icons/couch.png'),
  recycle: require('@/assets/icons/recycle.png'),
  bathroom_sink: require('@/assets/icons/water.png'),
  air_out: require('@/assets/icons/air.png'),
  wipe_table: require('@/assets/icons/tableclean.png'),
};
