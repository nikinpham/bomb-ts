import { parentPort } from "worker_threads";

const findPath = (
  start: TPosition,
  end: TPosition,
  obstacles: TPosition[]
): TPosition[] => {
  return [];
};

parentPort?.on("message", (data: IFindPathData) => {
  const path = findPath(data.start, data.end, data.obstacles);
  parentPort?.postMessage(path);
});
