


process.env.TRYJS_DEBUG
    max               : process.env.TRYJS_FORK_POOL_MAX || 10,
    min               : process.env.TRYJS_FORK_POOL_MIN || 2,
    idleTimeoutMillis : process.env.TRYJS_FORK_POOL_IDLE || 9999,
    reapIntervalMillis: process.env.TRYJS_FORK_POOL_REAP || 3333,

