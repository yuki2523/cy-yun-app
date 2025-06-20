import React, { useState, useEffect, useContext } from 'react';
import { Flex, Button } from 'antd';
import '../css/MyProfile.css';
import axiosInstance from '../utils/axiosInstance';
import Components from '../components';
import { GlobalContext } from '../App';

const {
  UserEditModal,
  MailChangeModal
} = Components;

const MyProfile = () => {
  const { messageApi, setAppLoading } = useContext(GlobalContext);
  const [userProfile, setUserProfile] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false); // editModal 显示开关
  const [mailChangeModalOpen, setMailChangeModalOpen] = useState(false); // MailChangeModal 显示开关
  // const userId = window.localStorage.getItem('yunId');

  const fetchUserProfile = async () => {
    try {
      setAppLoading(true);
      const response = await axiosInstance.get(`/user-management/user-profile/`);
      console.log(response);
      if (response.status === 200) {
        let code = response.data.code;
        let message = response.data.message;
        let data = response.data.data;
        if (code === '1') {
          setUserProfile(data);
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
      setAppLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, [])

  const refreshParentUserProfile = () => { // 父组件里刷新User信息
    fetchUserProfile();
  };

  return (
    <Flex align="center" justify="center" vertical style={{ minHeight: '0', background: '#f5f6fa', padding: '2.5rem 0 0 0' }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        maxWidth: 680,
        width: '100%',
        padding: '2.5rem 2.5rem 2rem 2.5rem',
        margin: '0 auto',
        minWidth: 0
      }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 24, textAlign: 'center', letterSpacing: 1 }}>ProfilePage</h1>
        <Flex vertical gap={24}>
          <Flex align="center" justify="space-between">
            <span style={{ color: '#888', fontSize: 16 }}>用户名</span>
            <span style={{ fontWeight: 500, fontSize: 18 }}>{userProfile?.userName || '-'}</span>
          </Flex>
          <Flex align="center" justify="space-between">
            <span style={{ color: '#888', fontSize: 16 }}>邮箱</span>
            <span style={{ fontWeight: 500, fontSize: 18 }}>{userProfile?.email || '-'}</span>
          </Flex>
          <Flex align="center" justify="space-between">
            <Button type="primary" ghost onClick={() => setEditModalOpen(true)} style={{ width: 120 }}>修改信息</Button>
            <Button type="primary" onClick={() => setMailChangeModalOpen(true)} style={{ width: 120 }}>更换邮箱</Button>
          </Flex>
        </Flex>
      </div>
      <UserEditModal editModalOpen={editModalOpen} updateEditModalOpen={() => setEditModalOpen(false)} refreshParent={refreshParentUserProfile} />
      <MailChangeModal modalOpen={mailChangeModalOpen} updateModalOpen={() => setMailChangeModalOpen(false)} refreshParent={refreshParentUserProfile} />
    </Flex>
  );
}

export default MyProfile;