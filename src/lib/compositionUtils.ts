import type { Material } from '../components/MaterialSlideOver';

/**
 * Extract fiber names from a material's composition.
 * Handles both parameters.composition_rows and legacy composition string.
 */
export function getFibersFromMaterial(m: Material): string[] {
  const fibers: string[] = [];

  // From composition_rows (structured)
  const rows = (m.parameters?.composition_rows as { fiber: string }[]) || [];
  rows.forEach((r) => {
    if (r.fiber?.trim()) fibers.push(r.fiber.trim());
  });

  // From composition string (legacy or when composition_rows empty)
  if (m.composition) {
    const parts = m.composition.split(',').map((s) => s.trim());
    const seen = new Set(fibers.map((f) => f.toLowerCase()));
    parts.forEach((s) => {
      const withPct = s.match(/\d+(?:\.\d+)?\s*%\s*(.+)$/);
      const fiber = withPct ? withPct[1].trim() : s;
      if (fiber && !seen.has(fiber.toLowerCase())) {
        seen.add(fiber.toLowerCase());
        fibers.push(fiber);
      }
    });
  }

  return fibers;
}

/**
 * Extract all unique fibers from a list of materials.
 * Returns sorted, unique fiber names (preserving first-seen casing for display).
 */
export function getUniqueFibersFromMaterials(materials: Material[]): string[] {
  const byLower = new Map<string, string>();
  materials.forEach((m) => {
    getFibersFromMaterial(m).forEach((f) => {
      const lower = f.toLowerCase();
      if (!byLower.has(lower)) byLower.set(lower, f);
    });
  });
  return Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * Check if a material contains any of the selected fibers (case-insensitive).
 */
export function materialContainsAnyFiber(m: Material, selectedFibers: string[]): boolean {
  if (selectedFibers.length === 0) return true;
  const matFibers = getFibersFromMaterial(m).map((f) => f.toLowerCase());
  const selLower = selectedFibers.map((s) => s.toLowerCase());
  return selLower.some((sel) => matFibers.some((f) => f === sel || f.includes(sel) || sel.includes(f)));
}

export interface TargetProductOption {
  id: string;
  name: string;
}

/**
 * Extract target product IDs from a material.
 * Considers: parameters.targeted_product_ids, targeted_custom_targets, and product_materials (Tech Pack links).
 */
export function getTargetProductIdsFromMaterial(m: Material): string[] {
  const ids: string[] = [];
  const p = m.parameters || {};
  const productIds = (p.targeted_product_ids as string[]) || [];
  ids.push(...productIds);
  const customTargets = (p.targeted_custom_targets as { id: string }[]) || [];
  customTargets.forEach((t) => {
    if (t?.id) ids.push(t.id);
  });
  // Also include products from product_materials (materials linked via Tech Pack)
  const pm = (m as Material & { product_materials?: { product_id: string }[] }).product_materials || [];
  pm.forEach((row) => {
    if (row?.product_id && !ids.includes(row.product_id)) ids.push(row.product_id);
  });
  return ids;
}

/**
 * Check if a material has any of the selected target product IDs.
 */
export function materialHasAnyTargetProduct(m: Material, selectedTargetIds: string[]): boolean {
  if (selectedTargetIds.length === 0) return true;
  const matIds = getTargetProductIdsFromMaterial(m);
  const selSet = new Set(selectedTargetIds);
  return matIds.some((id) => selSet.has(id));
}

/**
 * Build unique target product options from materials and a product id->name map.
 * Used for the target product filter dropdown.
 * Includes products from: parameters.targeted_product_ids, targeted_custom_targets, and product_materials.
 */
export function getUniqueTargetProductOptions(
  materials: Material[],
  productIdToName: Map<string, string>
): TargetProductOption[] {
  const byId = new Map<string, string>();
  materials.forEach((m) => {
    const p = m.parameters || {};
    const productIds = (p.targeted_product_ids as string[]) || [];
    productIds.forEach((id) => {
      if (id && !byId.has(id)) {
        const name = productIdToName.get(id);
        if (name) byId.set(id, name); // only include if product exists and has a name
      }
    });
    const customTargets = (p.targeted_custom_targets as { id: string; name: string }[]) || [];
    customTargets.forEach((t) => {
      if (t?.id && t?.name && !byId.has(t.id)) {
        byId.set(t.id, t.name); // only include if custom target has a name
      }
    });
    // Also include products from product_materials (Tech Pack links)
    const pm = (m as Material & { product_materials?: { product_id: string }[] }).product_materials || [];
    pm.forEach((row) => {
      if (row?.product_id && !byId.has(row.product_id)) {
        const name = productIdToName.get(row.product_id);
        if (name) byId.set(row.product_id, name);
      }
    });
  });
  return Array.from(byId.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
