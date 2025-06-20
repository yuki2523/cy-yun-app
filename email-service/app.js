const express = require("express");
const sendEmail = require("./mail");

const app = express();
app.use(express.json());

app.post("/send-email", (req, res) => {
  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ error: "缺少必要的参数" });
  }

  // 调用邮件发送函数，但不等待其完成
  sendEmail(to, subject, html);

  // 立即返回响应
  res.status(202).json({ message: "邮件发送请求已接收，正在处理中" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`邮件服务运行在 http://localhost:${PORT}`);
});