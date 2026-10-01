import * as migration_20261001_083636_initial from './20261001_083636_initial';
import * as migration_20261001_144559_gruppemelding_type from './20261001_144559_gruppemelding_type';

export const migrations = [
  {
    up: migration_20261001_083636_initial.up,
    down: migration_20261001_083636_initial.down,
    name: '20261001_083636_initial',
  },
  {
    up: migration_20261001_144559_gruppemelding_type.up,
    down: migration_20261001_144559_gruppemelding_type.down,
    name: '20261001_144559_gruppemelding_type'
  },
];
