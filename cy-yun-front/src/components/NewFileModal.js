import { useState, useContext, useEffect } from 'react';
import { Modal, Input, Button, Flex } from 'antd';
import { GlobalContext } from '../App';
import axiosInstance from '../utils/axiosInstance';

const NewFileModal = ({ parentFolder, modalOpen, updateModalOpen, refreshParent }) => {
  const { messageApi } = useContext(GlobalContext);
  const [fileName, setFileName] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);

  const handleSubmit = async () => {
    if (!fileName) {
      messageApi.open({
        type: 'error',
        content: '请输入文件名',
      });
      return;
    }
    setConfirmLoading(true);
    try {
      const response = await axiosInstance.post('/file-management/insert-online-edit-file/', {
        fileName,
        folderId: parentFolder?.id,
        content: '',
        fileSize: 0,
      });
      if (response.status === 200 && response.data.code === '1') {
        messageApi.open({ type: 'success', content: '新建文件成功' });
        updateModalOpen();
        setFileName('');
        if (typeof refreshParent === 'function') {
          refreshParent();
        }
      } else {
        messageApi.open({ type: 'error', content: response.data?.msg || '新建文件失败' });
      }
    } catch (e) {
      messageApi.open({ type: 'error', content: '新建文件失败' });
    } finally {
      setConfirmLoading(false);
    }
  };

  useEffect(() => {
    if (modalOpen) {
      setFileName('');
    }
  }, [modalOpen]);

  return (
    <Modal
      title={<h3>新建文件</h3>}
      footer={
        <div>
          <Button onClick={() => updateModalOpen(false)} size='large' style={{ marginRight: 10 }}>
            取消
          </Button>
          <Button type="primary" onClick={handleSubmit} size='large' loading={confirmLoading}>
            确认
          </Button>
        </div>
      }
      width={500}
      open={modalOpen}
      onCancel={() => updateModalOpen(false)}
      confirmLoading={confirmLoading}
    >
      <Flex justify='center' align='flex-start' vertical>
        <Flex justify='center' align='flex-start'>
          <div style={{ paddingTop: '4px', paddingRight: '10px' }}>
            文件名:
          </div>
          <Input
            placeholder="请输入文件名"
            value={fileName}
            onChange={e => setFileName(e.target.value)}
            style={{ marginBottom: '1rem', width: '20rem' }}
            autoFocus
          />
        </Flex>
      </Flex>
    </Modal>
  );
};

export default NewFileModal;
