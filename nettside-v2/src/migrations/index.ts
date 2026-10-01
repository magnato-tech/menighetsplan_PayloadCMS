import * as migration_20261001_083636_initial from './20261001_083636_initial';

export const migrations = [
  {
    up: migration_20261001_083636_initial.up,
    down: migration_20261001_083636_initial.down,
    name: '20261001_083636_initial'
  },
];
