import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailOutlined, SafetyOutlined } from '@ant-design/icons';
import { Button, Form, Input, Flex, Row, Col } from 'antd';
import axiosInstance from '../utils/axiosInstance';
import { GlobalContext } from '../App';
import formCheck from '../utils/formCheck';

const {
  formRules
} = formCheck;
const ForgotPassword = () => {
  const { messageApi } = useContext(GlobalContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [form] = Form.useForm(); // 使用 useForm 处理表单
  const [countdown, setCountdown] = useState(0);

  const onFinish = async (values) => {
    console.log('Received values of form: ', values);
    try {
      setLoading(true);
      const response = await axiosInstance.post(`/user-management/forget-password/`, {
        ...values,
        captchaId,
      });
      console.log(response);
      if (response.status === 200) {
        let code = response.data.code;
        let data = response.data.data;
        let message = response.data.message;
        if (code === '1') {
          messageApi.open({
            type: 'success',
            content: `Password reset your password`,
          });
          navigate(`/reset-password?token=${data.token}&email=${data.email}`);
        } else {
          messageApi.open({
            type: 'error',
            content: `${message}`,
          });
        }
      }
    } catch (error) {
      console.error('Error sending password reset email:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetCaptcha = async () => {
    setCaptchaLoading(true)
    try {
      const values = await form.validateFields(['email']);
      console.log('values', values)
      const response = await axiosInstance.get(`/user-management/get-captcha/`, {
        params: { email: values.email }
      });
      console.log(response)
      if (response.status === 200) {
        let code = response.data.code;
        let message = response.data.message;
        let data = response.data.data;
        if (code === '1') {
          setCaptchaId(data.captchaId);
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

  return (
    <Flex justify='center' align='center' style={{ minHeight: '100vh', background: '#f5f6fa', padding: '2rem 0' }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        maxWidth: 420,
        width: '100%',
        padding: '2.5rem 2rem 2rem 2rem',
        margin: '0 auto',
        minWidth: 0
      }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32, textAlign: 'center', letterSpacing: 1, color: '#1677ff' }}>Forgot Password</h1>
        <Form
          form={form}
          name="forgot-password"
          initialValues={{
            remember: true,
          }}
          style={{ width: '100%' }}
          onFinish={onFinish}
        >
          <Form.Item
            name="email"
            rules={formRules.emailRules}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
          </Form.Item>
          <Form.Item>
            <Row gutter={8} style={{ width: '100%' }}>
              <Col span={12} style={{ minWidth: 0 }}>
                <Form.Item
                  name="captchaCode"
                  noStyle
                  rules={formRules.captchaCodeRules}
                >
                  <Input prefix={<SafetyOutlined />} placeholder="Captcha" size="large" style={{ width: 200 }} />
                </Form.Item>
              </Col>
              <Col span={12} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                <Button
                  loading={captchaLoading}
                  onClick={handleGetCaptcha}
                  disabled={countdown > 0}
                  style={{ width: 140 }}
                  size="large"
                >Get captcha</Button>
                {countdown > 0 && <span style={{ marginLeft: 10, fontSize: 13, color: '#888', width: 60 }}>{`Wait ${countdown} s`}</span>}
              </Col>
            </Row>
          </Form.Item>
          <Form.Item>
            <Button block type="primary" htmlType="submit" loading={loading} size="large" style={{ fontWeight: 600, letterSpacing: 1 }}>
              Submit
            </Button>
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              or <Link to="/login">Login now!</Link>
            </div>
          </Form.Item>
        </Form>
      </div>
    </Flex>
  );
};

export default ForgotPassword;