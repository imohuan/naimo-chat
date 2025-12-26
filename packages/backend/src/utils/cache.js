/**
 * 简单的 LRU 缓存实现
 * 使用 Map 实现最近最少使用（Least Recently Used）缓存策略
 */
class SimpleLRUCache {
  /**
   * 创建 LRU 缓存实例
   * @param {number} [max=100] - 缓存的最大容量
   */
  constructor(max = 100) {
    this.max = max;
    this.cache = new Map();
  }
  /**
   * 获取缓存值
   * 如果键存在，将其移到最近使用的位置
   * @param {*} key - 缓存键
   * @returns {*} 缓存值，如果不存在则返回 undefined
   */
  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  /**
   * 设置缓存值
   * 如果键已存在则更新，如果缓存已满则删除最旧的项
   * @param {*} key - 缓存键
   * @param {*} value - 缓存值
   * @returns {void}
   */
  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  /**
   * 设置缓存值（put 的别名）
   * @param {*} key - 缓存键
   * @param {*} value - 缓存值
   * @returns {void}
   */
  set(key, value) {
    this.put(key, value);
  }
  /**
   * 检查缓存中是否存在指定的键
   * @param {*} key - 缓存键
   * @returns {boolean} 如果键存在返回 true，否则返回 false
   */
  has(key) {
    return this.cache.has(key);
  }
}

module.exports = {
  SimpleLRUCache,
};
