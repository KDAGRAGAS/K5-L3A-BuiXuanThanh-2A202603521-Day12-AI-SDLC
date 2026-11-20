// Sinh game.contract.json từ src/core/config.js để hai bên không lệch nhau.
import { writeFileSync } from 'node:fs';
import { TUNING } from '../src/core/config.js';

export const CONTRACT = {
  contract_version: '1.0',
  team: '2A202603521-bui-xuan-thanh',
  build_cmd: 'npm install',
  run_cmd: 'npm start',
  headless_cmd: 'node src/headless/cli.js',
  tuning: TUNING,
};

if (process.argv[1] && process.argv[1].endsWith('gen-contract.mjs')) {
  writeFileSync(new URL('../game.contract.json', import.meta.url), JSON.stringify(CONTRACT, null, 2) + '\n');
  console.log('da ghi game.contract.json');
}
