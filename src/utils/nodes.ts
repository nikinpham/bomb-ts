import { FlatMap, TreeNode } from '../types';
import { TILE_TYPE } from '../constants';

export const getNeighborNodes = (val: number, mapWidth: number) => {
  const cols = mapWidth;
  return [val - 1, val + 1, val - cols, val + cols];
};

export const createTreeNode = (
  val: number,
  dir: string | null = null,
  parent: TreeNode | null = null,
  isSpoil: boolean = false
): TreeNode => {
  return {
    val,
    dir,
    parent,
    boxes: 0,
    isolatedBoxes: 0,
    distance: parent ? parent.distance + (isSpoil ? 0.1 : 1) : 0,
    bonusPoints: parent ? parent.bonusPoints : 0,
    playerFootprint: false,
    children: []
  };
};

export const checkForGoodSpot = (spot: TreeNode, goodSpot: TreeNode) => {
  // let points = spot.boxes * spot.isolatedBoxes * 0.5;
  // let goodSpotPoints = goodSpot.boxes * goodSpot.isolatedBoxes * 0.5;
  // if (!this.isFullPower()) {
  //   points =
  //     spot.boxes * 0.7 + spot.bonusPoints * 0.2 * spot.isolatedBoxes * 0.5;
  //   goodSpotPoints =
  //     goodSpot.boxes * 0.7 +
  //     goodSpot.bonusPoints * 0.2 * goodSpot.isolatedBoxes * 0.5;
  // }
  const points = spot.boxes * 0.7 + spot.bonusPoints * 0.2 * spot.isolatedBoxes * 0.5;
  const goodSpotPoints = goodSpot.boxes * 0.7 + goodSpot.bonusPoints * 0.2 * goodSpot.isolatedBoxes * 0.5;
  return goodSpotPoints < points;
};

export const scanRawMap = (
  startNode: TreeNode,
  map: FlatMap,
  cols: number,
  callback: (node: TreeNode) => [TreeNode | null, boolean]
) => {
  const queue = [startNode];
  const visited = new Set([startNode.val]);
  while (queue.length) {
    const currentNode = queue.shift()!;

    if (callback) {
      const [r, ignoreThisNode] = callback(currentNode);
      if (ignoreThisNode) {
        continue;
      }
      if (r) {
        return r;
      }
    }

    const neighbors = getNeighborNodes(currentNode.val, cols);

    for (let idx in neighbors) {
      const neighbor = neighbors[idx];
      const cellValue = map[neighbor];
      if (cellValue === TILE_TYPE.ROAD) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          const dir = parseInt(idx, 10) + 1;
          const neighborNode = createTreeNode(neighbor, dir.toString(), currentNode);
          currentNode.children.push(neighborNode);
          queue.push(neighborNode);
        }
      }
    }
  }

  return null;
};
