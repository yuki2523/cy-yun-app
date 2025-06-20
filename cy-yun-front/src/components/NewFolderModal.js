import { useState, useEffect, useContext } from 'react';
import { Button, Modal, Flex, Input } from 'antd';
import axiosInstance from '../utils/axiosInstance';
import { GlobalContext } from '../App';

const NewFolderModal = ({ parentFolder, modalOpen, updateModalOpen, refreshParent }) => {
  const { messageApi, setAppLoading } = useContext(GlobalContext);
  const [parentId, setParentId] = useState(null);
  const [filePath, setFilePath] = useState('/');
  const [folderName, setFolderName] = useState('');

  const handleSubmit = async () => {
    if (!folderName) {
      messageApi.open({
        type: 'error',
        content: '请输入文件夹名称',
      });
      return;
    }
    setAppLoading(true);
    try {
      const response = await axiosInstance.post('/file-management/create-folder/', {
        parentId,
        name: folderName,
      });
      if (response.status === 200 && response.data?.code === '1') {
        messageApi.open({
          type: 'success',
          content: '新建文件夹成功',
        });
        updateModalOpen(false);
        if (typeof refreshParent === 'function') {
          refreshParent();
        }
      } else {
        messageApi.open({
          type: 'error',
          content: response.data?.message || '新建文件夹失败',
        });
      }
    } catch (error) {
      messageApi.open({
        type: 'error',
        content: '新建文件夹请求失败',
      });
    }
  }

  useEffect(() => {
    if (modalOpen) {
      setFilePath(parentFolder?.name); // 设置上传路径为当前文件夹
      setParentId(parentFolder?.id); // 设置文件夹建在当前文件夹下
      setFolderName(''); // 清空文件名
    }
  }, [modalOpen])

  return (
    <Modal
      title={<h2>New Folder</h2>}
      footer={
        <div>
          <Button onClick={() => updateModalOpen(false)} size='large' style={{marginRight: 10}}>
            Cancel
          </Button>
          <Button type="primary" onClick={handleSubmit} size='large'>
            Submit
          </Button>
        </div>
      }
      width={740}
      open={modalOpen}
      onCancel={() => updateModalOpen(false)}
    >
      <Flex justify='center' align='flex-start' vertical>
        <Flex justify='center' align='flex-start'>
          <div style={{ paddingTop: '3px', paddingRight: '10px' }}>
            Folder Path: {filePath} 
          </div>
          <Input 
            placeholder="Please input Folder Name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            style={{ marginBottom: '1rem', width: '20rem' }} />
        </Flex>
      </Flex>
    </Modal>
  );
};

export default NewFolderModal