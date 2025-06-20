require('dotenv').config();
const express = require('express');
const OSS = require('ali-oss');
const { STS } = require('ali-oss');

const app = express();
app.use(express.json());

// 获取临时URL接口
app.get('/get-url', async (req, res) => {
  const { filePath, expires = 3600, downloadFlag = 0, fileName = '' } = req.query;
  if (!filePath) return res.status(400).json({ error: 'Missing object param' });

  const client = new OSS({
    region: process.env.REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.BUCKET,
    secure: true,
  });

  try {
    let url;
    if (parseInt(downloadFlag) ===  1) {
      // 如果是下载链接，设置Content-Disposition头
      url = client.signatureUrl(filePath, {
        expires: parseInt(expires, 10),
        response: {
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        },
      });
    } else {
      // 普通访问链接
      url = client.signatureUrl(filePath, { expires: parseInt(expires, 10) });
    }
    console.log(`${Date.now()} Generated URL: ${url}`);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取STS临时凭证接口
app.get('/get-sts', async (req, res) => {
  const { expires = 3600 } = req.query;
  const sts = new STS({
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  });

  try {
    const result = await sts.assumeRole(process.env.ROLE_ARN, null, parseInt(expires, 10), process.env.ROLE_SESSION_NAME);
    console.log(`${Date.now()} Generated STS credentials: ${JSON.stringify(result.credentials)}`);
    res.json({
      accessKeyId: result.credentials.AccessKeyId,
      accessKeySecret: result.credentials.AccessKeySecret,
      securityToken: result.credentials.SecurityToken,
      expiration: result.credentials.Expiration,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取BUCKET容量和剩余可使用容量接口
app.get('/get-bucket-stat', async (req, res) => {
  const client = new OSS({
    region: process.env.REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.BUCKET,
  });

  try {
    const result = await client.getBucketStat();
    console.log(`${Date.now()} Retrieved bucket info: ${JSON.stringify(result)}`);
    res.json({
      storageUsed: result.stat.Storage, // 已使用 单位：字节
      objectCount: result.stat.ObjectCount,
      // storageUsed: `${parseInt(result.stat.StandardStorage) + parseInt(result.stat.InfrequentAccessStorage) + parseInt(result.stat.ArchiveStorage) + parseInt(result.stat.ColdArchiveStorage) + parseInt(result.stat.DeepColdArchiveStorage)}`,
    });
  } catch (err) {
    console.error('GetBucketStat failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// 获取临时URL接口
app.get('/delete-file', async (req, res) => {
  const { filePath } = req.query;
  if (!filePath) return res.status(400).json({ error: 'Missing object param' });

  const client = new OSS({
    region: process.env.REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.BUCKET,
  });

  try {
    const result = await client.delete(filePath);
    console.log('删除成功:', result);
    res.json({ result });
  } catch (err) {
    console.error('删除失败:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(8081, () => {
  console.log(`OSS service listening on http://127.0.0.1:8081`);
});