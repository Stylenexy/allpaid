/** Rounded branches shared by the main diagram and the four small trees. */
export function routePath(fromX: number, fromY: number, toX: number, toY: number) {
  const mid = fromY + (toY - fromY) * .55;
  return `M${fromX} ${fromY}V${mid - 10}Q${fromX} ${mid} ${toX} ${mid}V${toY}`;
}

export const ROUTE_LAYOUTS = {
  wide: { width: 1100, height: 410, rootX: 550, xs: [140, 390, 640, 950], leaves: [570, 720, 870, 1020], nodeWidth: 200, childWidth: 130 },
  phone: { width: 360, height: 360, rootX: 180, xs: [45, 135, 225, 315], leaves: [45, 135, 225, 315], nodeWidth: 80, childWidth: 80 },
} as const;
