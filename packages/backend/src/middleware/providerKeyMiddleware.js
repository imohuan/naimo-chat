/**
 * Provider 层密钥轮换中间件：
 * - 支持 api_keys 数组（优先）/api_key 单键
 * - 轮询选择可用 key，遇到 401/403/429/5xx 时冷却当前 key
 * - 仅在当前进程内维护状态，重启后状态重置
 */

// 构造轮询 + 冷却器：记录每个 provider 的 key 列表、当前位置、冷却时间、并发占用

const { getProviderService, setProvider } = require("../utils");

const normalize = (name = "") => String(name || "").toLowerCase();

// 根据 providerService 或静态配置获取目标 provider
const resolveProviderTarget = (providerService, providerName, config) => {
  if (providerService) {
    const target = providerService.getProvider(providerName);
    if (target) return target;
  }
  const list = config.Providers || config.providers || [];
  return Array.isArray(list)
    ? list.find((p) => normalize(p.name) === normalize(providerName))
    : null;
};

function createKeyRotator(providers = []) {
  const state = new Map();

  providers.forEach((p) => {
    const hasApiKeys = Array.isArray(p.api_keys);
    // 读取可用密钥：优先使用 api_keys，多 key；无则回退单 key
    const keys =
      hasApiKeys && p.api_keys.length
        ? [...p.api_keys]
        : p.api_key
        ? [p.api_key]
        : [];
    if (!keys.length) return;

    // 每个 provider 可选配置 limit（单 key 并发上限）；未配置或 <=0 则不做并发限制
    const limit = Number(p.limit) > 0 ? Number(p.limit) : 0;

    state.set(normalize(p.name), {
      keys,
      index: 0,
      disabledUntil: new Map(), // key -> timestamp
      inflight: new Map(), // key -> 当前并发数
      limit,
    });
  });

  const updateKeys = (providerName, keys) => {
    const s = state.get(normalize(providerName));
    if (!s) return null;
    s.keys = keys;
  };

  const next = (providerName) => {
    // 轮询取下一个未处于冷却期的 key；若全部在冷却则返回 null
    const s = state.get(normalize(providerName));
    if (!s) return null;

    const now = Date.now();
    for (let i = 0; i < s.keys.length; i += 1) {
      const idx = s.index; // 当前指针
      s.index = (s.index + 1) % s.keys.length; // 指针后移（轮询）
      const key = s.keys[idx]; // 取出本次候选 key
      const inUse = s.inflight.get(key) || 0;
      // limit<=0 表示不限制并发；否则要求 inUse < limit
      if (
        (s.disabledUntil.get(key) || 0) <= now &&
        (s.limit <= 0 || inUse < s.limit)
      ) {
        s.inflight.set(key, inUse + 1); // 占位，防止并发超限
        return key;
      }
    }
    return null;
  };

  const cooldown = (providerName, key, ms) => {
    // 将指定 key 冷却 ms 毫秒，用于 401/429/5xx 等错误后跳过
    const s = state.get(normalize(providerName));
    if (!s) return;
    const until = Date.now() + Math.max(ms, 0); // 计算冷却截止时间
    s.disabledUntil.set(key, until); // 记录冷却
  };

  const release = (providerName, key) => {
    const s = state.get(normalize(providerName));
    if (!s) return;
    const inUse = s.inflight.get(key) || 0;
    // 当前计数 inUse 小于等于 1，说明释放后没有占用者了，直接删除该 key 的并发记录。（一个key可以被多次使用，这里的占用数也会累计）
    if (inUse <= 1) {
      s.inflight.delete(key);
    } else {
      // 否则并发数减一，继续保留记录。
      s.inflight.set(key, inUse - 1);
    }
  };

  return { state, next, cooldown, release, updateKeys };
}

async function waitForAvailableKey(rotator, providerName, options = {}) {
  const {
    timeoutMs = 15_000, // 等待可用 key 的最大时间
    minSleepMs = 50, // 最小休眠时间，避免忙轮询
    maxSleepMs = 500, // 最大休眠时间，避免等待过长
  } = options;

  const start = Date.now();
  // 轮询直到拿到可用 key，或超时
  while (Date.now() - start < timeoutMs) {
    const key = rotator.next(providerName);
    if (key) return key;

    const state = rotator.state.get(normalize(providerName));
    if (!state) return null;

    // 计算下次醒来的时间：取最早冷却结束时间，避免过度等待
    const now = Date.now();
    let sleep = maxSleepMs;
    state.keys.forEach((k) => {
      const disabledUntil = state.disabledUntil.get(k) || 0;
      if (disabledUntil > now) {
        sleep = Math.min(sleep, disabledUntil - now);
      }
    });
    sleep = Math.min(maxSleepMs, Math.max(minSleepMs, sleep));

    await new Promise((resolve) => setTimeout(resolve, sleep));
  }

  return null; // 超时未获取到可用 key
}

function createProviderKeyMiddleware(config, server = null) {
  const providers = config.Providers || config.providers || [];
  const rotator = createKeyRotator(providers);

  const preHandler = async (req, _reply) => {
    // 仅对 /v1/messages 生效；token 计数接口直接跳过
    if (
      !req.url.startsWith("/v1/messages") ||
      req.url.startsWith("/v1/messages/count_tokens")
    ) {
      return;
    }

    // 预期 model 形如 "provider,model"；前半段视为 provider 名
    const model = req.body?.model;
    if (!model || typeof model !== "string") return;
    const [providerName] = model.split(",");
    const providerService = getProviderService(server);

    // 如果请求体中携带了临时 apiKey，则直接使用该 key，跳过轮询
    const bodyApiKey =
      typeof req.body?.apiKey === "string"
        ? req.body.apiKey.trim()
        : typeof req.body?.api_key === "string"
        ? req.body.api_key.trim()
        : typeof req.body?.key === "string"
        ? req.body.key.trim()
        : "";

    if (bodyApiKey) {
      const target = resolveProviderTarget(
        providerService,
        providerName,
        config
      );

      if (target) {
        await setProvider(target, { apiKey: bodyApiKey }, config, server);
        // 标记已使用临时 key，避免后续释放轮询资源
        req.rotatedProvider = providerName;
        req.rotatedApiKey = bodyApiKey;
        req.rotatedReleased = true;
      }
      return;
    }

    // 更新 provider 的 keys
    if (providerService) {
      const provider = providerService.getProvider(providerName);
      if (provider) {
        rotator.updateKeys(providerName, provider.apiKeys);
      }
    }

    // 判断是否存在 api_keys 如果存在才会进行轮询，否则直接退出
    const stateData = rotator.state.get(normalize(providerName));
    if (!stateData || !Array.isArray(stateData.keys)) return;

    // 若并发已满或处于冷却，则等待可用 key
    const apiKey = await waitForAvailableKey(rotator, providerName, {
      timeoutMs:
        Number(config.keyWaitTimeoutMs) > 0
          ? Number(config.keyWaitTimeoutMs)
          : 60_000,
    });

    // 将选出的 key 写回当前 provider 配置，供后续上游请求使用
    // 优先从 server 实例获取 provider
    const target = resolveProviderTarget(providerService, providerName, config);

    if (!apiKey) {
      if (target) {
        await setProvider(target, { apiKey: "sk-xxx" }, config, server);
      }
      return;
    }

    if (target) {
      await setProvider(target, { apiKey }, config, server);
      req.rotatedProvider = providerName;
      req.rotatedApiKey = apiKey;
      req.rotatedReleased = false; // 避免重复释放
    }
  };

  const releaseOnce = (req) => {
    if (!req.rotatedProvider || !req.rotatedApiKey || req.rotatedReleased)
      return;
    rotator.release(req.rotatedProvider, req.rotatedApiKey);
    req.rotatedReleased = true;
  };

  const onError = async (req, _reply, error) => {
    // 按上游错误类型冷却当前 key，防止短期重复触发失败
    if (!req.rotatedProvider || !req.rotatedApiKey) return;
    releaseOnce(req); // 出错立即释放占用
    const status = error?.statusCode || error?.status || error?.code;
    if (status === 401 || status === 403) {
      // 鉴权失败/禁用：长时间冷却，防止继续打无效 key
      rotator.cooldown(req.rotatedProvider, req.rotatedApiKey, 60 * 60 * 1000); // 1h 冷却
    } else if (status === 429) {
      // 触发限流：短期冷却让配额恢复
      rotator.cooldown(req.rotatedProvider, req.rotatedApiKey, 60 * 1000); // 1min 冷却
    } else if (status >= 500 && status < 600) {
      // 上游故障：短冷却后可重试其他 key/等待恢复
      rotator.cooldown(req.rotatedProvider, req.rotatedApiKey, 10 * 1000); // 短冷却
    }
  };

  const onSend = async (req, _reply, _payload) => {
    // 正常返回时释放并发占用
    releaseOnce(req);
  };

  return { preHandler, onError, onSend };
}

module.exports = {
  createProviderKeyMiddleware,
};
