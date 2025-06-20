const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/cy-yun",
    createProxyMiddleware({
      target: "https://www.ying2233.cn/cy-yun",
      changeOrigin: true, // 允许跨域
    })
  );
};
