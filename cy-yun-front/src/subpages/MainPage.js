import { useState, useEffect, useContext } from 'react';
import { Button, Table, Flex } from 'antd';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/utils';
import { Base64 } from 'js-base64';
import axiosInstance from '../utils/axiosInstance';
import { GlobalContext } from '../App';
import Components from '../components';
const {
  PreviewerModal,
  FilePreviewModal,
} = Components;

const MainPage = () => {
  const { messageApi, setEditableFileInfo, setAppLoading, setFileTreeExpandedKeys } = useContext(GlobalContext);
  const navigate = useNavigate();
  const [recentFiles, setRecentFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [filePreviewModalOpen, setFilePreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [storageInfo, setStorageInfo] = useState('');
  const userName = window.localStorage.getItem('userName') || '-';

  useEffect(() => {
    // 获取存储使用情况
    const fetchStorageInfo = async () => {
      try {
        const res = await axiosInstance.get('/user-management/user-storage-quota/');
        if (res.status === 200 && res.data.code === '1' && res.data.data) {
          const d = res.data.data;
          // 上传文件：字节转GB，精确到2位小数
          const uploadUsedGB = (Number(d.upload_used) / (1024 ** 3)).toFixed(2);
          const uploadLimitGB = (Number(d.upload_limit) / (1024 ** 3)).toFixed(0);
          // 在线编辑文件：字节转MB，精确到2位小数
          const onlineEditUsedMB = (Number(d.online_edit_used) / (1024 ** 2)).toFixed(2);
          const onlineEditLimitMB = (Number(d.online_edit_limit) / (1024 ** 2)).toFixed(0);
          setStorageInfo(
            `上传文件：${uploadUsedGB}GB / ${uploadLimitGB}GB  |  在线编辑文件：${onlineEditUsedMB}MB / ${onlineEditLimitMB}MB`
          );
        }
      } catch (e) {
        // 可选：setStorageInfo('获取失败');
      }
    };
    fetchStorageInfo();

    const fetchRecentFiles = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get('/file-management/get-recent-files/');
        if (res.status === 200 && res.data.code === '1') {
          setRecentFiles(res.data.data || []);
        } else {
          setRecentFiles([]);
        }
      } catch (e) {
        setRecentFiles([]);
      }
      setLoading(false);
    };
    fetchRecentFiles();
  }, []);

  const handleOpenFolder = (record) => {
    console.log('打开文件夹', record);
    setFileTreeExpandedKeys(record?.path?.map(item => item.id) || []);
    navigate('/file-list');
  }

  const onlineEditFile = (record, editMode) => {
    console.log('编辑', record);
    setEditableFileInfo({
      fileId: record.id,
      filePath: record.path && record.path.length ? `/ ${record.path.map(item => item.name).join(' / ')} ` : '',
      fileName: record.name,
      folderId: record.parent_id,
      editMode,
    });
    navigate('/online-editor');
  };

  const handlePreview = async (record) => {
    if (!record?.id) return;
    try {
      setAppLoading(true);
      if (record.online_editable) {
        // 可在线编辑文件，直接获取内容
        const res = await axiosInstance.post('/file-management/get-online-edit-file/', { fileId: record.id });
        if (res.status === 200 && res.data.code === '1') {
          setPreviewContent(res.data.data.fileContent.content || '');
          setPreviewModalOpen(true);
        } else {
          messageApi.open({ type: 'error', content: '获取文件内容失败' });
        }
      } else {
        // 其它文件，获取临时预览链接
        const response = await axiosInstance.get('/file-management/get-preview-temp-path/', {
          params: { ossPath: record.oss_path }
        });
        if (response.status === 200 && response.data.code === '1' && response.data.data?.tempUrl) {
          const tempUrl = response.data.data.tempUrl;
          setPreviewUrl(`/cy-yun/file-preview/onlinePreview?url=${encodeURIComponent(Base64.encode(tempUrl))}`);
          setFilePreviewModalOpen(true);
        } else {
          messageApi.open({ type: 'error', content: '预览失败' });
        }
      }
    } catch (e) {
      messageApi.open({ type: 'error', content: record.online_editable ? '获取文件内容失败' : '预览失败' });
    } finally {
      setAppLoading(false);
    }
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size) => size || '-',
    },
    {
      title: '路径',
      dataIndex: 'full_path',
      key: 'full_path',
      render: (full_path) => full_path || '/',
    },
    {
      title: '修改时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (val) => formatDate(val),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Flex gap="small">
          <Button size="small" onClick={() => handleOpenFolder(record)}>打开文件夹</Button>
          <Button size="small" onClick={() => handlePreview(record)}>查看</Button>
          {record.online_editable && (
            <Button size="small" type="primary" onClick={() => {onlineEditFile(record, '1')}}>编辑</Button>
          )}
        </Flex>
      ),
    },
  ];

  return (
    <Flex justify='center' align='flex-start' vertical style={{ maxWidth: '80rem', width: '100%', minWidth: 0, margin: '0 auto', padding: '0 1rem', boxSizing: 'border-box' }}>
      <h1>MainPage</h1>
      <Flex justify='space-between' align='center' style={{width:'100%',marginTop:'2rem',marginBottom:'2rem', flexWrap: 'wrap', gap: 16}}>
        <div>用户名：<b>{userName}</b></div>
        <div>存储使用情况：<b>{storageInfo}</b></div>
      </Flex>
      <div style={{width:'100%', overflowX: 'auto'}}>
        <h2 style={{margin:'1rem 0'}}>最近文件</h2>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={recentFiles}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </div>
      <PreviewerModal
        open={previewModalOpen}
        onCancel={() => setPreviewModalOpen(false)}
        content={previewContent}
      />
      <FilePreviewModal
        open={filePreviewModalOpen}
        onCancel={() => { setFilePreviewModalOpen(false); setPreviewUrl(''); }}
        previewUrl={previewUrl}
      />
    </Flex>
  );
};

export default MainPage;