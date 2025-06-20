import { useState, useEffect, useContext } from 'react';
import { Button, Modal, Form, Input } from 'antd';
import axiosInstance from '../utils/axiosInstance';
import { GlobalContext } from '../App';
import formCheck from '../utils/formCheck';

const {
  formRules
} = formCheck;
const UserEditModal = ({ editModalOpen, updateEditModalOpen, refreshParent }) => {
  const { messageApi } = useContext(GlobalContext);
  const [loading, setLoading] = useState(true);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form] = Form.useForm(); // 使用 useForm 处理表单

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/user-management/user-profile/`);
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
      const response = await axiosInstance.post(`/user-management/update-user-info/`, {
        ...values
      });
      console.log(response)
      if (response.status === 200) {
        let code = response.data.code;
        let message = response.data.message;
        let data = response.data.data;
        if (code === '1') {
          updateEditModalOpen(false);
          setConfirmLoading(false);
          refreshParent();
          window.localStorage.setItem('userName', data.userName);
          messageApi.open({
            type: 'success',
            content: `user:${data.userName} ${message}`,
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
    }
  }

  useEffect(() => {
    if (editModalOpen) {
      fetchUserProfile();
    }
    form.resetFields(); // 重置表单
  }, [editModalOpen])

  return (
    <Modal
      title={<p>User Edit</p>}
      footer={
        <div>
          <Button onClick={() => updateEditModalOpen(false)} size='large' style={{marginRight: 10}}>
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
      open={editModalOpen}
      onCancel={() => updateEditModalOpen(false)}
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
          label="User Name"
          name="userName"
          rules={formRules.userNameRules}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default UserEditModal;