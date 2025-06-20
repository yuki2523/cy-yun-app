import React, { useState, useEffect } from 'react';
import { Modal, Input, Form } from 'antd';

const FileRenameModal = ({
  open,
  onCancel,
  onOk,
  originalName,
  loading
}) => {
  const [form] = Form.useForm();
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ newName: originalName });
    }
  }, [open]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);
      await onOk(values.newName);
      setConfirmLoading(false);
      form.resetFields();
    } catch (e) {
      setConfirmLoading(false);
    }
  };

  return (
    <Modal
      title="重命名文件/文件夹"
      open={open}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      confirmLoading={loading || confirmLoading}
      okText="确定"
      cancelText="取消"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" initialValues={{ newName: originalName }}>
        <Form.Item label="原名称">
          <Input value={originalName} disabled />
        </Form.Item>
        <Form.Item
          label="新名称"
          name="newName"
          rules={[
            { required: true, message: '请输入新名称' },
            { max: 255, message: '名称过长' },
            { whitespace: true, message: '名称不能为空' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (value && value === originalName) {
                  return Promise.reject(new Error('新名称不能与原名称相同'));
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <Input placeholder="请输入新名称" autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FileRenameModal;
