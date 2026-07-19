import { sourceVehiclesForOption } from './catalogUnion.js';

/**
 * A node is selected from the user-confirmed option, then compatible source
 * records can contribute complementary synthetic parts. This is a visual path,
 * not a substitute for real repair procedures or fitment verification.
 */
export function buildRepairPath(option, repairNodeId, sources) {
  const records = sourceVehiclesForOption(option, sources);
  const nodeRecords = records
    .map(({ source, vehicle }) => ({ source, node: vehicle.nodes.find((node) => node.id === repairNodeId) }))
    .filter(({ node }) => Boolean(node));

  if (nodeRecords.length === 0) {
    throw new Error(`No synthetic repair node named ${repairNodeId} is available for the selected option.`);
  }

  const firstNode = nodeRecords[0].node;
  const parts = new Map();
  const evidenceWarnings = [];

  for (const { source, node } of nodeRecords.slice(1)) {
    if (node.label !== firstNode.label || JSON.stringify(node.diagram) !== JSON.stringify(firstNode.diagram)) {
      evidenceWarnings.push({
        type: 'node-conflict',
        sourceId: source.id,
        message: 'A lower-priority source describes this repair node differently.'
      });
    }
  }

  for (const { source, node } of nodeRecords) {
    for (const part of node.parts) {
      const current = parts.get(part.id);
      if (!current) {
        parts.set(part.id, { ...part, availableFrom: [source.id], conflicts: [] });
      } else if (current.label === part.label && current.quantity === part.quantity) {
        current.availableFrom.push(source.id);
      } else {
        current.conflicts.push({ sourceId: source.id, label: part.label, quantity: part.quantity });
        evidenceWarnings.push({
          type: 'part-conflict',
          sourceId: source.id,
          partId: part.id,
          message: 'A lower-priority source describes this synthetic part differently.'
        });
      }
    }
  }

  return {
    vehicleOptionId: option.id,
    node: {
      id: firstNode.id,
      label: firstNode.label,
      diagram: firstNode.diagram
    },
    parts: [...parts.values()].sort((a, b) => a.label.localeCompare(b.label)),
    catalogProvenance: nodeRecords.map(({ source }) => source.id),
    evidenceWarnings
  };
}
export function renderRepairPath(path) {
  const diagram = path.node.diagram.map((item) => `[${item}]`).join(' -> ');
  const partLines = path.parts.map((part) => {
    const sourceList = part.availableFrom.join(', ');
    return `   |- ${part.quantity} x ${part.label}  (${sourceList})`;
  });

  return [
    `Repair node: ${path.node.label}`,
    `Visual path: ${diagram}`,
    'Parts:',
    ...partLines
  ].join('\n');
}
