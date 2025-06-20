import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Form, Input, Flex } from 'antd';
import axiosInstance from '../utils/axiosInstance';
import { GlobalContext } from '../App';
import formCheck from '../utils/formCheck';
const {
  formRules
} = formCheck;

const Login = () => {
  const navigate = useNavigate();
  const { messageApi } = useContext(GlobalContext);
  const [loading, setLoading] = useState(false);

  const onFinish = (values) => {
    console.log('Received values of form: ', values);
    handleLogin(values.email, values.password)
  };

  const handleLogin = async (email, password) => {
    email = email.trim();
    password = password.trim();

    try {
      setLoading(true)
      const response = await axiosInstance.post(`/user-management/login/`, {
        email,
        password
      });
      console.log(response)
      if (response.status === 200) {
        let code = response.data.code;
        let message = response.data.message;
        let data = response.data.data;
        if (code === '1') {
          messageApi.open({
            type: 'success',
            content: `user:${data.userName} ${message}`,
          });
          window.localStorage.setItem('isYunLogin', true);
          window.localStorage.setItem('yunId', data.yunId);
          window.localStorage.setItem('userName', data.userName);
          window.localStorage.setItem('userGroup', data.userGroup);
          // window.localStorage.setItem('role', data.role);
          navigate('/main-page');
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
      setLoading(false)
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
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32, textAlign: 'center', letterSpacing: 1, color: '#1677ff' }}>Login</h1>
        <Form
          name="login"
          style={{ width: '100%' }}
          onFinish={onFinish}
        >
          <Form.Item
            name="email"
            rules={formRules.emailRules}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={formRules.passwordRules}
          >
            <Input prefix={<LockOutlined />} type="password" placeholder="Password" size="large" />
          </Form.Item>
          <Form.Item>
            <Flex justify="space-between" align="center" style={{ fontSize: 14 }}>
              <Link to="/register">Register now!</Link>
              <Link to="/forgot-password">Forgot password</Link>
            </Flex>
          </Form.Item>
          <Form.Item>
            <Button block type="primary" htmlType="submit" loading={loading} size="large" style={{ fontWeight: 600, letterSpacing: 1 }}>
              Log in
            </Button>
          </Form.Item>
        </Form>
      </div>
    </Flex>
  );
};

export default Login;