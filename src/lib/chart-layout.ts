/** Short names retain the source SKU as an unambiguous identifier. */
export function shortProductName(name: string, max = 20) {
  const clean = name
    .replace(/^HB\s+(?:HOF\s+)?/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(clean);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : clean;
}
export interface ChartPoint {
  sku: string;
  x: number;
  y: number;
  radius: number;
  label: string;
}
export interface LabelBox {
  sku: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pointX: number;
  pointY: number;
}
export function placeLabels(
  points: ChartPoint[],
  bounds: { left: number; top: number; width: number; height: number },
): LabelBox[] {
  const placed: LabelBox[] = [];
  // Prefer larger products, then SKU code, so labels do not jump between renders.
  for (const p of [...points].sort(
    (a, b) => b.radius - a.radius || a.sku.localeCompare(b.sku),
  )) {
    if (
      p.x < bounds.left ||
      p.x > bounds.left + bounds.width ||
      p.y < bounds.top ||
      p.y > bounds.top + bounds.height
    )
      continue;
    const width = Math.min(
        200,
        Math.max(70, Array.from(p.label).length * 6.5 + 14),
      ),
      height = 22;
    let best: LabelBox | undefined,
      bestScore = Infinity;
    const candidates: [number, number][] = [];
    for (let ring = 0; ring < 18; ring++)
      for (const [dx, dy] of [
        [0, -1],
        [1, -1],
        [-1, -1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [-1, 1],
        [0, 1],
      ]) {
        const distance = p.radius + 18 + ring * 23;
        const x = Math.max(
          bounds.left + 2,
          Math.min(
            bounds.left + bounds.width - width - 2,
            p.x + dx * distance - width / 2,
          ),
        );
        const y = Math.max(
          bounds.top + 32,
          Math.min(
            bounds.top + bounds.height - height - 28,
            p.y + dy * distance - height / 2,
          ),
        );
        candidates.push([x, y]);
      }
    // Search the whole plot as well as radial positions. Dense clusters near an
    // edge otherwise collapse many candidates onto the same clamped position.
    for (
      let y = bounds.top + 32;
      y <= bounds.top + bounds.height - height - 28;
      y += 28
    )
      for (
        let x = bounds.left + 2;
        x <= bounds.left + bounds.width - width - 2;
        x += 32
      )
        candidates.push([x, y]);
    for (const [x, y] of candidates) {
      const box = {
        sku: p.sku,
        x,
        y,
        width,
        height,
        pointX: p.x,
        pointY: p.y,
      };
      const overlaps = placed.reduce(
        (s, q) =>
          s +
          (x < q.x + q.width + 5 &&
          x + width + 5 > q.x &&
          y < q.y + q.height + 4 &&
          y + height + 4 > q.y
            ? 1
            : 0),
        0,
      );
      const hits = points.reduce(
        (s, q) =>
          s +
          (Math.hypot(
            q.x - Math.max(x, Math.min(q.x, x + width)),
            q.y - Math.max(y, Math.min(q.y, y + height)),
          ) <
          q.radius + 3
            ? 1
            : 0),
        0,
      );
      const score =
        overlaps * 100000 +
        hits * 10000 +
        Math.hypot(x + width / 2 - p.x, y + height / 2 - p.y);
      if (score < bestScore) {
        best = box;
        bestScore = score;
      }
    }
    if (best) placed.push(best);
  }
  return placed;
}
