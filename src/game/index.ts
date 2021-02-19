import { GAME_GRID_SIZE } from '@app/config';
import log from '@app/log';
import Player from '@app/models/player';
import { getCellAreaWidthAndHeight } from '@app/utils';
import {
  ShipType,
  ShipSize,
  ShipData,
  Grid,
  ShipPositionData,
  Orientation
} from './types';
import { ShipsLockedSchema } from '@app/payloads/schemas';

const EXPECTED_OCCUPIED_SQUARES: number = Object.values(ShipSize).reduce(
  (total, v) => {
    return total + parseInt(v.split('x')[0], 10);
  },
  0
);

/**
 * Validate a ship placement payload. Code is not great, not terrible.
 * Refer to the "pieces.locked.json" file, or tests for a sample payload.
 *
 * Steps:
 *
 * 1. JSON payload validation using a schema
 * 2. Generate a NxN grid array[][]
 * 3. Verify ships are within bounds
 *
 * @param placementData
 */
export function validateShipPlacement(
  placementData: unknown
): ShipPositionData {
  const result = ShipsLockedSchema.validate(placementData, {
    abortEarly: false,
    stripUnknown: false,
    allowUnknown: false
  });

  const errors = result.error || result.errors;

  if (errors) {
    throw errors;
  }

  // Cast the data to the correct type now that Joi validated it, then use it
  // to populate a grid using the keys (ship types) from the validated payload
  const validatedPlacementData = placementData as ShipPositionData;
  const grid = generateEmptyGridArray();

  Object.keys(validatedPlacementData).forEach((ship) => {
    const shipType = ship as ShipType;

    populateGridWithShipData(
      getCellAreaWidthAndHeight(ShipSize[shipType]).x,
      validatedPlacementData[shipType],
      grid
    );
  });

  // Prints the NxN grid for debugging purposes. It may be wider than N cells
  // if a player is sending invalid inputs, or being nefarious
  // populatedGrid.forEach(r => console.log(r))

  // Validate that:
  // 1. ships do not overlap (squares can only contain 0 or 1 values)
  // 2. ships do no stick out over the edges (array must have length N)
  let occupiedSquares = 0;
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i];

    if (row.length !== GAME_GRID_SIZE) {
      throw new Error('a ship is over the edge of the board');
    }

    for (let j = 0; j < row.length; j++) {
      const val = row[j];

      if (val > 1) {
        throw new Error(`ships are overlapping at grid [${j}, ${i}]`);
      }

      if (val !== 0) {
        occupiedSquares++;
      }
    }
  }

  if (occupiedSquares !== EXPECTED_OCCUPIED_SQUARES) {
    throw new Error(
      `${occupiedSquares} grid positions were occupied, but ${EXPECTED_OCCUPIED_SQUARES} was the expected value`
    );
  }

  return placementData as ShipPositionData;
}

/**
 * Increments the value of squares that a ship occupies in the given NxN grid.
 * This grid can be used to find ships that are out of bounds or overlapping.
 * @param size
 * @param ship
 * @param grid
 */
function populateGridWithShipData(size: number, ship: ShipData, grid: Grid) {
  const rootX = ship.origin[0];
  const rootY = ship.origin[1];

  if (isNaN(size)) {
    throw new Error('failed to parse ship size to a number');
  }

  for (let i = 0; i < size; i++) {
    if (ship.orientation === Orientation.Horizontal) {
      const row = rootY;
      const col = rootX + i;

      grid[row][col] += 1;
    } else {
      const row = rootY + i;
      const col = rootX;

      grid[row][col] += 1;
    }
  }
}

/**
 * Determines if the given player has lost the game, i.e all their ships
 * cells have been hit, and thus all their ships are destroyed
 * @param {Player} player
 */
export function isGameOverForPlayer(player: Player): boolean {
  const shipPositions = player.getShipPositionData();

  log.trace(
    `checking if player ${player.getUUID()} lost match. ships: %j`,
    shipPositions
  );

  if (!shipPositions) {
    return false;
  } else {
    return Object.values(shipPositions)
      .map((s) => s.cells)
      .flat()
      .every((c) => c.hit === true);
  }
}

/**
 * Generates an empty (filled with zeroes) 2D grid that's NxN in size
 */
function generateEmptyGridArray(): Grid {
  const grid: Grid = [];

  for (let i = 0; i < GAME_GRID_SIZE; i++) {
    grid[i] = [];

    for (let j = 0; j < GAME_GRID_SIZE; j++) {
      grid[i][j] = 0;
    }
  }

  return grid;
}
