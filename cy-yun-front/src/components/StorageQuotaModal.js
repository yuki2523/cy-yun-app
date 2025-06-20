import { useState, useEffect } from 'react';
import { Modal, Slider, InputNumber, Flex } from 'antd';

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

const StorageQuotaModal = ({ open, onCancel, onOk, user, loading }) => {
  // 初始值：接口传入的user.storageUsed
  const [onlineEditLimit, setOnlineEditLimit] = useState(0); // MB
  const [uploadLimit, setUploadLimit] = useState(0); // GB

  useEffect(() => {
    if (user && user.storageUsed) {
      setOnlineEditLimit(Math.round(Number(user.storageUsed.online_edit_limit) / MB));
      setUploadLimit(Math.round(Number(user.storageUsed.upload_limit) / GB));
    }
  }, [user, open]);

  return (
    <Modal
      open={open}
      title={`存储上限设置 - ${user?.userName || ''}`}
      onCancel={onCancel}
      onOk={() => onOk({
        userId: user?.storageUsed?.user_id,
        onlineEditLimit: String(onlineEditLimit * MB),
        uploadLimit: String(uploadLimit * GB),
      })}
      confirmLoading={loading}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={800}
    >
      <Flex vertical gap={24}>
        <Flex align="center" gap={16}>
          <span style={{width: 160}}>在线编辑存储上限：</span>
          <Slider
            min={0}
            max={1024}
            step={1}
            value={onlineEditLimit}
            onChange={setOnlineEditLimit}
            style={{ width: 600 }}
          />
          <InputNumber
            min={0}
            max={1024}
            step={1}
            value={onlineEditLimit}
            onChange={setOnlineEditLimit}
            style={{ width: 80 }}
          />
          <span>MB</span>
        </Flex>
        <Flex align="center" gap={16}>
          <span style={{width: 160}}>上传文件存储上限：</span>
          <Slider
            min={0}
            max={20}
            step={1}
            value={uploadLimit}
            onChange={setUploadLimit}
            style={{ width: 600 }}
          />
          <InputNumber
            min={0}
            max={20}
            step={1}
            value={uploadLimit}
            onChange={setUploadLimit}
            style={{ width: 80 }}
          />
          <span>GB</span>
        </Flex>
      </Flex>
    </Modal>
  );
};

export default StorageQuotaModal;
