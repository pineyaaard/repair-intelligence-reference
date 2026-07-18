#!/usr/bin/env node
import { SAMPLE_MESSAGE } from './fixtures.js';
import { parseVehiclePrefill, confirmVehicleChoice } from './vehiclePrefill.js';
import { unionVehicleOptions } from './catalogUnion.js';
import { buildRepairPath, renderRepairPath } from './repairPath.js';
import { PrivacySafeErrorRollup } from './errorRollup.js';

const args = process.argv.slice(2);
const readArgument = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const text = readArgument('--text') ?? SAMPLE_MESSAGE;
const prefill = parseVehiclePrefill(text);
const options = unionVehicleOptions(prefill.values);

console.log('Repair Intelligence Reference (synthetic, offline)');
console.log(`Input: ${text}`);
console.log(`Prefill: ${JSON.stringify(prefill.values)}`);
console.log(`Confirmation required: ${prefill.confirmationRequired}`);

if (options.length === 0) {
  console.log('No synthetic catalog option matched. Add or correct the missing fields, then retry.');
  process.exitCode = 1;
} else {
  console.log('Visible catalog options:');
  options.forEach((option, index) => {
    console.log(
      `  ${index + 1}. ${option.make} ${option.model} ${option.year} ${option.variant} — ${option.availableFrom.join(', ')}`
    );
  });

  if (!args.includes('--confirm')) {
    console.log('Stopped before catalog access: run with --confirm after the user selects an option.');
  } else {
    const requestedIndex = Number(readArgument('--choice') ?? '1') - 1;
    const option = options[requestedIndex];
    if (!option) throw new Error('Selected option does not exist.');

    const confirmation = confirmVehicleChoice(prefill, option);
    const path = buildRepairPath(option, 'front-brake-service');
    console.log(`Confirmed explicitly: ${confirmation.confirmationSource}`);
    console.log(renderRepairPath(path));

    if (args.includes('--demo-error')) {
      const rollup = new PrivacySafeErrorRollup();
      const syntheticVehicleId = 'A'.repeat(17);
      rollup.record({
        route: '/demo/estimate?contact=example@invalid.test',
        status: 502,
        error: `Synthetic upstream timeout for ${syntheticVehicleId}`
      });
      console.log('Privacy-safe error rollup:');
      console.log(JSON.stringify(rollup.list(), null, 2));
    }
  }
}
