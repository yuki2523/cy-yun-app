import { useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Form, Input, Flex } from 'antd';
import axiosInstance from '../utils/axiosInstance';
import { GlobalContext } from '../App';
import formCheck from '../utils/formCheck';

const {
  formRules
} = formCheck;
const ResetPassword = () => {
  const navigate = useNavigate();
  const { messageApi } = useContext(GlobalContext);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const onFinish = async (values) => {
    console.log('Received values of form: ', values);
    try {
      setLoading(true);
      const response = await axiosInstance.post(`/user-management/reset-password/`, {
        token,
        ...values,
      });
      console.log(response);
      if (response.status === 200) {
        let code = response.data.code;
        let message = response.data.message;
        if (code === '1') {
          messageApi.open({
            type: 'success',
            content: `Password reset successful: ${message}`,
          });
          navigate('/login');
        } else {
          messageApi.open({
            type: 'error',
            content: `${message}`,
          });
        }
      }
    } catch (error) {
      console.error('Error resetting password:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex justify='center' align='center' style={{ minHeight: '91vh', background: '#f5f6fa', padding: '2rem 0' }}>
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
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32, textAlign: 'center', letterSpacing: 1, color: '#1677ff' }}>Reset Password</h1>
        <Form
          name="resetPassword"
          initialValues={{
            email: email, // 设置初始值
          }}
          style={{ width: '100%' }}
          onFinish={onFinish}
        >
          <Form.Item
            name="email"
            rules={formRules.emailRules}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" disabled size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={formRules.passwordRules}
            hasFeedback
          >
            <Input.Password prefix={<LockOutlined />} type="password" placeholder="New Password" size="large" />
          </Form.Item>
          <Form.Item
            name="password2"
            dependencies={['password']}
            hasFeedback
            rules={[
              {
                required: true,
                message: 'Please confirm your new Password!',
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('The two passwords that you entered do not match!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} type="password" placeholder="Confirm New Password" size="large" />
          </Form.Item>
          <Form.Item>
            <Button block type="primary" htmlType="submit" loading={loading} size="large" style={{ fontWeight: 600, letterSpacing: 1 }}>
              Reset Password
            </Button>
          </Form.Item>
        </Form>
      </div>
    </Flex>
  );
};

export default ResetPassword;