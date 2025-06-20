import { useEffect, useState, useContext } from 'react';
import { Table, Switch, Button, Flex, Collapse } from 'antd';
import axiosInstance from '../utils/axiosInstance';
import { formatDate } from '../utils/utils';
import { GlobalContext } from '../App';
import Components from '../components';
const {
  StorageQuotaModal,
} = Components;

const AdminPage = () => {
  const { messageApi, setAppLoading } = useContext(GlobalContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [registerEnable, setRegisterEnable] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [ossInfo, setOssInfo] = useState(null);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [quotaUser, setQuotaUser] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const userId = window.localStorage.getItem('yunId');

  useEffect(() => {
    fetchUsers();
    fetchRegisterEnable();
    fetchOssInfo();
  }, []);

  const fetchUsers = async (current = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const offset = (current - 1) * pageSize;
      const limit = pageSize;
      const res = await axiosInstance.get('/user-management/user-list/', 
        { params: { offset, limit } }
      );
      if (res.status === 200 && res.data.code === '1' && Array.isArray(res.data.data?.items)) {
        setUsers(res.data.data.items);
        setPagination(prev => ({
          ...prev,
          total: res.data.data?.total || 0,
          current,
          pageSize,
        }));
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    }
    setLoading(false);
  };

  const handleTableChange = (pag) => {
    fetchUsers(pag.current, pag.pageSize);
  };

  const fetchRegisterEnable = async () => {
    try {
      const res = await axiosInstance.get('/settings-management/get-register-enable/');
      if (res.status === 200 && res.data.code === '1') {
        setRegisterEnable(res.data.data?.registerEnable === '1');
      }
    } catch {}
  };

  const handleRegisterSwitch = async (checked) => {
    setRegisterLoading(true);
    try {
      const res = await axiosInstance.post('/settings-management/set-register-enable/', { registerEnable: checked ? '1' : '0' });
      if (res.status === 200 && res.data.code === '1') {
        setRegisterEnable(checked);
        messageApi.success('注册许可已更新');
      } else {
        messageApi.error(res.data?.message || '更新失败');
      }
    } catch {
      messageApi.error('更新失败');
    }
    setRegisterLoading(false);
  };

  const fetchOssInfo = async () => {
    try {
      const res = await axiosInstance.get('/settings-management/oss-stat/');
      if (res.status === 200 && res.data.code === '1') {
        setOssInfo(res.data.data);
      }
    } catch {}
  };

  const handleActiveSwitch = async (user, checked) => {
    setAppLoading(true);
    try {
      const res = await axiosInstance.post('/user-management/update-user-active/', { userId: user.id, isActive: checked ? '1' : '0' });
      if (res.status === 200 && res.data.code === '1') {
        setAppLoading(false);
        fetchUsers(pagination.current, pagination.pageSize);
        messageApi.success('用户状态已更新');
      } else {
        messageApi.error(res.data?.message || '更新失败');
      }
    } catch {
      messageApi.error('用户状态更新失败');
    }
    setAppLoading(false);
  };

  const handleUpdateStorage = (user) => {
    setQuotaUser(user);
    setQuotaModalOpen(true);
  };

  const handleQuotaOk = async (params) => {
    setQuotaLoading(true);
    try {
      const res = await axiosInstance.post('/user-management/update-user-storage-quota/', params);
      if (res.status === 200 && res.data.code === '1') {
        messageApi.success('存储上限已更新');
        setQuotaModalOpen(false);
        fetchUsers(pagination.current, pagination.pageSize);
      } else {
        messageApi.error(res.data?.message || '更新失败');
      }
    } catch {
      messageApi.error('更新失败');
    }
    setQuotaLoading(false);
  };

  const columns = [
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '用户名', dataIndex: 'userName', key: 'userName' },
    {
      title: '可用状态',
      dataIndex: 'deletedAt',
      key: 'status',
      render: (deletedAt, record) =>
        deletedAt ? (
          <span style={{ color: 'red' }}>已删除</span>
        ) : (
          <Switch
            checked={record.isActive}
            onChange={checked => handleActiveSwitch(record, checked)}
            size="small"
            disabled={record.id === userId} // 禁用当前用户的开关
          />
        ),
    },
    {
      title: '在线编辑存储使用',
      key: 'online_edit_storage',
      render: (_, record) => {
        const s = record.storageUsed || {};
        const used = (Number(s.online_edit_used) / (1024 ** 2)).toFixed(2);
        const limit = (Number(s.online_edit_limit) / (1024 ** 2)).toFixed(0);
        return `${used}MB / ${limit}MB`;
      },
    },
    {
      title: '上传文件存储使用',
      key: 'upload_storage',
      render: (_, record) => {
        const s = record.storageUsed || {};
        const used = (Number(s.upload_used) / (1024 ** 3)).toFixed(2);
        const limit = (Number(s.upload_limit) / (1024 ** 3)).toFixed(0);
        return `${used}GB / ${limit}GB`;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (val) => formatDate(val),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Button size="small" type='link' onClick={() => handleUpdateStorage(record)}>
          存储更新
        </Button>
      ),
    },
  ];

  return (
    <Flex vertical style={{ maxWidth: '80rem', width: '100%', minWidth: 0, margin: '2rem auto', padding: '0 1rem', boxSizing: 'border-box' }}>
      <h1>AdminPage</h1>
      <Collapse style={{marginBottom: 24}} defaultActiveKey={['1','2']}>
        <Collapse.Panel header="系统参数控制" key="1">
          <Flex align="center" gap={16} wrap="wrap">
            <span>注册许可：</span>
            <Switch
              checked={registerEnable}
              loading={registerLoading}
              onChange={handleRegisterSwitch}
              checkedChildren="许可"
              unCheckedChildren="停止"
            />
          </Flex>
        </Collapse.Panel>
        <Collapse.Panel header="全系统内存使用状态" key="2">
          {ossInfo ? (
            <Flex gap={32} align="center" wrap="wrap">
              <span>文件总数：<b>{ossInfo.objectCount}</b></span>
              <span>已用空间：<b>{(Number(ossInfo.storageUsed) / (1024 ** 2)).toFixed(2)} MB</b></span>
            </Flex>
          ) : (
            <span style={{color:'#888'}}>加载中...</span>
          )}
        </Collapse.Panel>
      </Collapse>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 'max-content' }}
      />
      <StorageQuotaModal
        open={quotaModalOpen}
        onCancel={() => setQuotaModalOpen(false)}
        onOk={handleQuotaOk}
        user={quotaUser}
        loading={quotaLoading}
      />
    </Flex>
  );
};

export default AdminPage;
