import { Maps, Position } from '../types';
import { bombSetup, convertRawPath, drive, getPathToNearestItems } from '../utils';
import { EARLY_GAME_TILE_LIMIT } from '../constants';

export const collectGodBadge = (maps: Maps, playerPosition: Position, godBadges: Position[]) => {
  if (godBadges.length === 0) {
    return true;
  }

  const rawPathToGodBadge = getPathToNearestItems(maps, EARLY_GAME_TILE_LIMIT, playerPosition, godBadges);
  if (rawPathToGodBadge) {
    const path = convertRawPath(rawPathToGodBadge);
    // console.log(getDirection(rawPathToGodBadge[0], rawPathToGodBadge[1]));
    if (path) {
      drive(path);
    } else {
      // const facedDirection = getDirection(playerPosition, rawPathToGodBadge[1]);
      drive(bombSetup());
    }
  }

  return false;
};
