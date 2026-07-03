/** 内存级取消标志，每 1000 行检查，重启后自然清空 */
const cancelFlags: Set<number> = new Set();
export { cancelFlags };
