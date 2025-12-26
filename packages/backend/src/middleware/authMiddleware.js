/**
 * API Key 认证中间件
 */
function createAuthMiddleware(config) {
  return async (req, reply) => {
    return new Promise((resolve, reject) => {
      const done = (err) => {
        if (err) reject(err);
        else resolve();
      };

      // 公开端点不需要认证
      if (req.url.indexOf("/v1/messages") === -1) {
        return done();
      }

      const apiKey = config.APIKEY;
      if (!apiKey) {
        // 如果没有设置 API key，允许本地 CORS
        const allowedOrigins = [
          `http://127.0.0.1:${config.PORT || 3457}`,
          `http://localhost:${config.PORT || 3457}`,
        ];
        if (
          req.headers.origin &&
          !allowedOrigins.includes(req.headers.origin)
        ) {
          reply.status(403).send("CORS not allowed for this origin");
          return done(new Error("CORS not allowed"));
        } else {
          reply.header(
            "Access-Control-Allow-Origin",
            `http://127.0.0.1:${config.PORT || 3457}`
          );
          reply.header(
            "Access-Control-Allow-Origin",
            `http://localhost:${config.PORT || 3457}`
          );
        }
        return done();
      }

      const authHeaderValue =
        req.headers.authorization || req.headers["x-api-key"];

      const authKey = Array.isArray(authHeaderValue)
        ? authHeaderValue[0]
        : authHeaderValue || "";

      if (!authKey) {
        reply.status(401).send("APIKEY is missing");
        return done(new Error("APIKEY is missing"));
      }
      let token = "";
      if (authKey.startsWith("Bearer")) {
        token = authKey.split(" ")[1];
      } else {
        token = authKey;
      }

      if (token !== apiKey) {
        reply.status(401).send("Invalid API key");
        return done(new Error("Invalid API key"));
      }

      done();
    });
  };
}

module.exports = {
  createAuthMiddleware,
};
