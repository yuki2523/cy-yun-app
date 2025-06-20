import { useState, useEffect, useContext } from 'react';
import { Button, Table, Flex, Popconfirm } from 'antd';
import { formatDate } from '../utils/utils';
import axiosInstance from '../utils/axiosInstance';
import { Base64 } from 'js-base64';
import { GlobalContext } from '../App';
import Components from '../components';
const {
  FilePreviewModal,
  PreviewerModal
} = Components;

const RecycleBin = () => {
  const { messageApi, setAppLoading } = useContext(GlobalContext);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [onlineEditPreviewModalOpen, setOnlineEditPreviewModalOpen] = useState(false);
  const [onlineEditPreviewContent, setOnlineEditPreviewContent] = useState('');

  useEffect(() => {
    fetchRecycleBin(pagination.current, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecycleBin = async (current = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const offset = (current - 1) * pageSize;
      const limit = pageSize;
      const response = await axiosInstance.get('/file-management/recycle-bin/', {
        params: { offset, limit }
      });
      if (response.status === 200 && response.data.code === '1') {
        setDataSource(response.data.data?.items || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.data?.total || 0,
          current,
          pageSize,
        }));
      } else {
        messageApi.open({
          type: 'error',
          content: response.data?.message || '加载回收站失败',
        });
      }
    } catch (error) {
      messageApi.open({
        type: 'error',
        content: '加载回收站失败',
      });
    }
    setLoading(false);
  };

  const handleTableChange = (pag) => {
    fetchRecycleBin(pag.current, pag.pageSize);
  };

  const handleOnlineEditFilePreview = async (record) => {
    if (record.id) {
      try {
        setAppLoading(true);
        const res = await axiosInstance.post('/file-management/get-online-edit-file/', { fileId: record.id });
        if (res.status === 200 && res.data.code === '1') {
          setOnlineEditPreviewContent(res.data.data.fileContent.content || '');
          setOnlineEditPreviewModalOpen(true);
        } else {
          messageApi.open({ type: 'error', content: '获取文件内容失败' });
        }
      } catch {
        messageApi.open({ type: 'error', content: '获取文件内容失败' });
      } finally {
        setAppLoading(false);
      }
    }
  };

  const previewFile = async (record) => {
    if (record.is_folder) {
      messageApi.open({
        type: 'info',
        content: '暂不支持文件夹预览',
      });
      return;
    }
    if (record.online_editable) {
      handleOnlineEditFilePreview(record);
      return;
    }
    try {
      const response = await axiosInstance.get(`/file-management/get-preview-temp-path/`, {
        params: {
          ossPath: record.oss_path
        }
      });
      let tempUrl;
      if (response.status === 200 && response.data.code === '1') {
        tempUrl = response.data.data.tempUrl;
      }
      if (tempUrl) {
        setPreviewUrl(`/cy-yun/file-preview/onlinePreview?url=${encodeURIComponent(Base64.encode(tempUrl))}`);
        setPreviewModalOpen(true);
      } else {
        messageApi.open({
          type: 'error',
          content: `预览失败`,
        });
      }
    } catch (error) {
      messageApi.open({
        type: 'error',
        content: `预览失败`,
      });
    }
  };

  const restoreFile = async (record) => {
    try {
      const response = await axiosInstance.post('/file-management/restore/', {
        id: record.id
      });
      if (response.status === 200 && response.data.code === '1') {
        messageApi.open({
          type: 'success',
          content: '恢复成功',
        });
        fetchRecycleBin(pagination.current, pagination.pageSize);
      } else {
        messageApi.open({
          type: 'error',
          content: response.data?.message || '恢复失败',
        });
      }
    } catch (error) {
      messageApi.open({
        type: 'error',
        content: '恢复失败',
      });
    }
  };

  const deletePermanently = async (record) => {
    try {
      const response = await axiosInstance.post('/file-management/hard-delete-file/', {
        id: record.id
      });
      if (response.status === 200 && response.data.code === '1') {
        messageApi.open({
          type: 'success',
          content: '物理删除成功',
        });
        fetchRecycleBin(pagination.current, pagination.pageSize);
      } else {
        messageApi.open({
          type: 'error',
          content: response.data?.message || '物理删除失败',
        });
      }
    } catch (error) {
      messageApi.open({
        type: 'error',
        content: '物理删除失败',
      });
    }
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <span>
          {record.is_folder ? '📁 ' : '📄 '}
          {text}
        </span>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size) => size || '-',
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      render: (pathArr) => {
        if (Array.isArray(pathArr) && pathArr.length > 0) {
          return `/ ${pathArr.map(item => item.name).join(' / ')} /`;
        }
        return '/';
      },
    },
    {
      title: '删除时间',
      dataIndex: 'deleted_at',
      key: 'deleted_at',
      render: (val) => formatDate(val),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Flex gap="small">
          <Button type="link" size="small" onClick={() => previewFile(record)} disabled={record.is_folder}>预览</Button>
          <Popconfirm
            title="确认恢复此文件？"
            onConfirm={() => restoreFile(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small">恢复</Button>
          </Popconfirm>
          <Popconfirm
            title="确认要物理删除此文件？此操作不可恢复！"
            onConfirm={() => deletePermanently(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>物理删除</Button>
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  return (
    <Flex justify='center' align='flex-start' vertical style={{ maxWidth: '80rem', width: '100%', minWidth: 0, margin: '0 auto', padding: '0 1rem', boxSizing: 'border-box' }}>
      <h1>RecycleBin</h1>
      <div style={{width:'100%', overflowX: 'auto'}}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={dataSource}
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
      </div>
      <FilePreviewModal
        open={previewModalOpen}
        onCancel={() => { setPreviewModalOpen(false); setPreviewUrl(''); }}
        previewUrl={previewUrl}
      />
      <PreviewerModal
        open={onlineEditPreviewModalOpen}
        onCancel={() => setOnlineEditPreviewModalOpen(false)}
        content={onlineEditPreviewContent}
      />
    </Flex>
  );
};

export default RecycleBin;