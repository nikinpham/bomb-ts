import { parentPort } from "worker_threads";

const findPath = (
  start: TPosition,
  end: TPosition,
  obstacles: TPosition[]
): TPosition[] => {
  console.log(start, end, obstacles)
  return [];
};

parentPort?.on("message", (data: IFindPathData): void => {
  const path = findPath(data.start, data.end, data.obstacles);
  parentPort?.postMessage(path);
});
