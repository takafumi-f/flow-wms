import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on('error', (err) => {
  // Redis未起動時は警告のみ（アプリ自体は継続動作）
  if (!err.message.includes('ECONNREFUSED')) {
    console.error('[Redis] error:', err.message);
  }
});

export default redis;

// キャッシュユーティリティ（Redis未接続時はスルー）
export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 60,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    const value = await fetcher();
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    return value;
  } catch {
    // Redisが使えない場合はfetcherを直接実行
    return fetcher();
  }
}

export async function invalidate(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // ignore
  }
}
