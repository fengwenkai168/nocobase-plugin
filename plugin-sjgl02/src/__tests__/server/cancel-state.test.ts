import { cancelFlags } from '../../server/actions/cancel-state';

describe('cancelFlags', () => {
  beforeEach(() => {
    cancelFlags.clear();
  });

  it('初始状态为空集合', () => {
    expect(cancelFlags.size).toBe(0);
  });

  it('add 后 has 返回 true', () => {
    cancelFlags.add(100);
    expect(cancelFlags.has(100)).toBe(true);
    expect(cancelFlags.size).toBe(1);
  });

  it('支持多个任务 ID', () => {
    cancelFlags.add(1);
    cancelFlags.add(2);
    cancelFlags.add(3);
    expect(cancelFlags.size).toBe(3);
    expect(cancelFlags.has(1)).toBe(true);
    expect(cancelFlags.has(2)).toBe(true);
    expect(cancelFlags.has(3)).toBe(true);
  });

  it('delete 后 has 返回 false', () => {
    cancelFlags.add(100);
    cancelFlags.delete(100);
    expect(cancelFlags.has(100)).toBe(false);
    expect(cancelFlags.size).toBe(0);
  });

  it('delete 不存在的 ID 不报错', () => {
    expect(() => cancelFlags.delete(999)).not.toThrow();
  });

  it('clear 清空所有标志', () => {
    cancelFlags.add(1);
    cancelFlags.add(2);
    cancelFlags.add(3);
    cancelFlags.clear();
    expect(cancelFlags.size).toBe(0);
    expect(cancelFlags.has(1)).toBe(false);
  });

  it('重复 add 同一 ID 不会增加 size', () => {
    cancelFlags.add(100);
    cancelFlags.add(100);
    expect(cancelFlags.size).toBe(1);
  });
});
