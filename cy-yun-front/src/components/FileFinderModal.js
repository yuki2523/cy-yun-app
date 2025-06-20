import { useEffect, useState, useContext } from 'react';
import { Modal, Input, Button, Table, Flex } from 'antd';
import { formatDate } from '../utils/utils';
import axiosInstance from '../utils/axiosInstance';
import { GlobalContext } from '../App';

const FileFinderModal = ({ open, onCancel, onExpandFolder, onEdit, onPreview }) => {
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const { messageApi } = useContext(GlobalContext);

  useEffect(() => {
    if (open) {
      setSearchValue('');
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/file-management/find-file/', {
        params: {
          fileName: searchValue || undefined,
        },
      });
      if (res.status === 200 && res.data.code === '1') {
        // 兼容API返回格式，提取path.filePath
        const data = (res.data.data || []).map(item => ({
          ...item,
          // 路径渲染为 / a / b / c /
          full_path: Array.isArray(item.path) && item.path.length
            ? `/ ${item.path.map(p => p.name).join(' / ')} /`
            : '/',
        }));
        setResults(data);
      } else if (res.status === 200 && res.data.code === '2') {
        // fileName 为空的特殊处理
        setResults([]);
        messageApi.open({ type: 'warning', content: res.data?.message || 'fileName is required and cannot be empty' });
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const columns = [
    { title: '文件名', dataIndex: 'name', key: 'name' },
    { title: '路径', dataIndex: 'full_path', key: 'full_path', render: (val) => val || '/' },
    { title: '大小', dataIndex: 'size', key: 'size', render: (val) => val || '-' },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', render: (val) => formatDate(val) },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Flex gap="small">
          <Button size="small" onClick={() => onExpandFolder && onExpandFolder(record)}>展开文件夹</Button>
          <Button size="small" onClick={() => onPreview && onPreview(record)}>查看</Button>
          {record.online_editable && (
            <Button size="small" type="primary" onClick={() => onEdit && onEdit(record)}>编辑</Button>
          )}
        </Flex>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={<h2>File Finder</h2>}
      footer={null}
      width={900}
      centered
      maskClosable={false}
      destroyOnHidden
      bodyStyle={{ minHeight: 400, maxHeight: 400, overflow: 'auto', padding: 24 }}
    >
      <Flex gap="small" align="center" style={{ marginBottom: 16 }}>
        <Input
          placeholder="请输入文件名，支持模糊搜索"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 320 }}
        />
        <Button type="primary" onClick={handleSearch} loading={loading}>搜索</Button>
      </Flex>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={results}
        loading={loading}
        pagination={false}
        size="small"
      />
    </Modal>
  );
};

export default FileFinderModal;
