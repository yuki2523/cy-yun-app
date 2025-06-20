import React, { useState, useEffect, useContext } from 'react';
import { Button, Modal, Form, Input, Row, Col } from 'antd';
import axiosInstance from '../utils/axiosInstance';
import { GlobalContext } from '../App';
import formCheck from '../utils/formCheck';

const {
  formRules
} = formCheck;
const MailChangeModal = ({ modalOpen, updateModalOpen, refreshParent }) => {
  const { messageApi } = useContext(GlobalContext);
  const [loading, setLoading] = useState(true);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [form] = Form.useForm(); // 使用 useForm 处理表单
  const [countdown, setCountdown] = useState(0);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/user-management/user-profile/`);
      console.log(response)
      if (response.status === 200) {
        let code = response.data.code;
        let message = response.data.message;
        let data = response.data.data;
        if (code === '1') {
          form.setFieldsValue(data);
        } else {
          messageApi.open({
            type: 'error',
            content: `${message}`,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setConfirmLoading(true);
    try {
      const values = await form.validateFields();
      console.log(values)
      const response = await axiosInstance.post(`/user-management/update-email/`, {
        ...values,
        captchaId,
      });
      console.log(response)
      if (response.status === 200) {
        let code = response.data.code;
        let message = response.data.message;
        let data = response.data.data;
        if (code === '1') {
          updateModalOpen(false);
          setConfirmLoading(false);
          refreshParent();
          messageApi.open({
            type: 'success',
            content: `newEmail${data.email} ${message}`,
          });
        } else {
          messageApi.open({
            type: 'error',
            content: `${message}`,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setConfirmLoading(false);
    }
  }

  const handleGetCaptcha = async () => {
    setCaptchaLoading(true)
    try {
      const response = await axiosInstance.get(`/user-management/user-get-captcha/`);
      console.log(response)
      if (response.status === 200) {
        let code = response.data.code;
        let message = response.data.message;
        let data = response.data.data;
        if (code === '1') {
          setCaptchaId(data.captchaId);
          messageApi.open({
            type: 'success',
            content: `${message}`,
          });
          setCountdown(60); // 设置倒计时为 60 秒
          const interval = setInterval(() => {
            setCountdown(prevCountdown => {
              if (prevCountdown <= 1) {
                clearInterval(interval);
                return 0;
              }
              return prevCountdown - 1;
            });
          }, 1000);
        } else {
          messageApi.open({
            type: 'error',
            content: `${message}`,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setCaptchaLoading(false)
    }
  }

  useEffect(() => { // 打开页面加载userProfile
    if (modalOpen) {
      fetchUserProfile();
    }
    form.resetFields(); // 重置表单
  }, [modalOpen])

  return (
    <Modal
      title={<p>Change Email</p>}
      footer={
        <div>
          <Button onClick={() => updateModalOpen(false)} size='large' style={{marginRight: 10}}>
            Cancel
          </Button>
          <Button type="primary" onClick={handleSubmit} size='large'>
            Submit
          </Button>
        </div>
      }
      loading={loading}
      confirmLoading={confirmLoading}
      width={740}
      open={modalOpen}
      onCancel={() => updateModalOpen(false)}
      initialValues={null}
    >
      <Form
        labelCol={{
          span: 6,
        }}
        wrapperCol={{
          span: 14,
        }}
        layout="horizontal"
        size={680}
        form={form}
      >
        <Form.Item
          label="User Email"
          name="email">
          <Input disabled/>
        </Form.Item>
        <Form.Item
          label="New Email"
          name="newEmail"
          rules={formRules.emailRules}>
          <Input/>
        </Form.Item>
        <Form.Item label="Captcha">
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item
                name="captchaCode"
                noStyle
                rules={formRules.captchaCodeRules}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Button
                loading={captchaLoading}
                onClick={handleGetCaptcha}
                disabled={countdown > 0}
              >Get captcha</Button>
              {countdown > 0 && <span style={{ marginLeft: 10 }}>{`Wait ${countdown} s`}</span>}
            </Col>
          </Row>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MailChangeModal;