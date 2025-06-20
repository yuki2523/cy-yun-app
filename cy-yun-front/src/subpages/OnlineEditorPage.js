import { useState, useContext, useEffect } from 'react';
import { Button, Radio } from 'antd';
import { EditOutlined, EyeOutlined, SplitCellsOutlined } from '@ant-design/icons';
import Components from '../components';
import { formatDate } from '../utils/utils';
import axiosInstance from '../utils/axiosInstance';
import { GlobalContext } from '../App';
const {
  Editor,
  Previewer,
  PathFinder
} = Components;

// 获取字符串的 UTF-8 字节长度
function getUtf8BytesLength(str) {
  return new TextEncoder().encode(str).length;
}

const OnlineEditorPage = () => {
  const { messageApi, editableFileInfo, setAppLoading } = useContext(GlobalContext);
  const [fileId, setFileId] = useState(''); // 文件ID，用于API传值，有则为既存文件，无则为新建文件
  const [originalContent, setOriginalContent] = useState(''); // 保存原始内容
  const [content, setContent] = useState(``); // UI展示文件内容，兼API传值
  const [fileType, setFileType] = useState(''); // UI展示文件内容，兼API传值
  const [filePath, setFilePath] = useState(''); // UI展示路径
  const [fileName, setFileName] = useState(''); // UI展示文件名，兼API传值
  const [folderId, setFolderId] = useState(''); // API传值，文件夹ID
  const [updatedAt, setUpdatedAt] = useState(null); // 文件更新时间
  const [pathFinderModalOpen, setPathFinderModalOpen] = useState(false); // 路径查找器弹窗
  const [fileFinderParams, setFileFinderParams] = useState({}); // 文件查找参数
  const [pathFinderInputActive, setPathFinderInputActive] = useState(true); // 路径查找对话框输入框激活状态
  const [editMode, setEditMode] = useState('3'); // 编辑模式，1:编辑 2:预览 3:编辑+预览

  const clearCurrentFileState = () => {
    setFileId('');
    setOriginalContent('');
    setContent('');
    setFileType('');
    setFilePath('');
    setFileName('');
    setFolderId('');
    setUpdatedAt('');
  };

  useEffect(() => {
    const fetchFileContent = async () => {
      setAppLoading(true);
      try {
        const response = await axiosInstance.post(`/file-management/get-online-edit-file/`, {
          fileId
        });
        if (response.status === 200) {
          let code = response.data.code;
          let data = response.data.data;
          if (code === '1') {
            let fileContent = data.fileContent;
            setOriginalContent(fileContent.content);
            setContent(fileContent.content);
            setFileType(fileContent.file_suffix);
            setUpdatedAt(fileContent.updated_at);
          }
        }
      } catch (error) {
        console.error('加载文件内容失败：', error);
      } finally {
        setAppLoading(false);
      }
    };

    if (fileId) {
      fetchFileContent();
    }
  }, [fileId]);

  useEffect(() => {
    if (fileName && fileName.includes('.')) {
      const lastDot = fileName.lastIndexOf('.');
      setFileType(lastDot !== -1 ? fileName.slice(lastDot + 1) : '');
    } else {
      setFileType('');
    }
  }, [fileName]);

  useEffect(() => {
    if (editableFileInfo) {
      setFileId(editableFileInfo.fileId);
      setFilePath(editableFileInfo.filePath);
      setFileName(editableFileInfo.fileName);
      setFolderId(editableFileInfo.folderId);
      setEditMode(editableFileInfo.editMode);
    }
  }, [editableFileInfo]);

  const saveFile = async () => {
    if (!filePath && !fileName) {
      messageApi.open({
        type: 'error',
        content: '文件路径和文件名不能为空，请打开文件或新建文件后再保存。'
      });
      return;
    }

    console.log('saveFile', filePath);
    setAppLoading(true);
    const requestData = {
      fileName,
      content: content,
      fileSize: getUtf8BytesLength(content), // 计算内容的字节长度
    };
    const apiEndpoint = fileId
    ? '/file-management/update-online-edit-file/'
    : '/file-management/insert-online-edit-file/';

    if (!fileId) {
      requestData.folderId = folderId; // 新建文件需要 folderId
    } else {
      requestData.fileId = fileId; // 更新文件需要 fileId
    }
    try {
      const response = await axiosInstance.post(apiEndpoint, requestData);
      if (response.status === 200) {
        const { code, message, data } = response.data;
        if (code === '1') { // 成功处理
          if (!fileId && data?.file_info?.id) {
            setFileId(data.file_info.id); // 新建文件时更新 fileId
          }
          setUpdatedAt(data?.file_info?.updated_at);
          setOriginalContent(content); // 更新原始内容
          messageApi.open({
            type: 'success',
            content: `文件保存成功 ${filePath} / ${fileName}`,
          });
        } else {
          messageApi.open({
            type: 'error',
            content: `文件保存失败 ${message}`,
          });
        }
      }
    } catch (error) {
      console.error('Save Error:', error);
      messageApi.open({
        type: 'error',
        content: '文件保存过程中发生错误，请稍后重试。',
      });
    } finally {
      setAppLoading(false);
    }
  }

  const updatePathInfo = (pathList, currentFileInfo) => {
    console.log('updatePathInfo', pathList, currentFileInfo);
    setFilePath(pathList && pathList.length > 0 ? `/ ${pathList.map(item => item.title).join(' / ')}` : '');
    setFileId(currentFileInfo?.fileId);
    setFileName(currentFileInfo?.fileName);
    setFolderId(currentFileInfo?.parentId);
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          minHeight: 48,
          padding: '0.5rem 0',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ flex: '1 1 200px', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {filePath} {fileName && `/ ${fileName}`}
        </div>
        <div style={{ flex: '0 0 auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button size="small" onClick={() => {setFileFinderParams({ editable_id: '1', parent_id: null });setPathFinderInputActive(true);setPathFinderModalOpen(true)}}>Open Recent</Button>
          <Button size="small" type="primary" onClick={() => {clearCurrentFileState();setFileFinderParams({ type_id: '2', parent_id: null });setPathFinderInputActive(false);setPathFinderModalOpen(true)}}>New File</Button>
          <Button size="small" type="dashed" onClick={() => saveFile()}>Save</Button>
        </div>
        <div style={{ flex: '0 0 auto', minWidth: 120, color: '#888', fontSize: 12 }}>
          {updatedAt && `Last Modified: ${formatDate(updatedAt)}`}
          {originalContent !== content && <span style={{ color: 'red', marginLeft: 8 }}>未保存</span>}
        </div>
        <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
          <Radio.Group value={editMode} onChange={(e) => setEditMode(e.target.value)} style={{ fontSize: 12 }}>
            <Radio.Button value="1" style={{ textAlign: 'center' }}>
              <EditOutlined /> {/* 编辑 */}
            </Radio.Button>
            <Radio.Button value="2" style={{ textAlign: 'center' }}>
              <EyeOutlined /> {/* 预览 */}
            </Radio.Button>
            <Radio.Button value="3" style={{ textAlign: 'center' }}>
              <SplitCellsOutlined /> {/* 编辑+预览 */}
            </Radio.Button>
          </Radio.Group>
        </div>
      </div>
      <div style={{ height: 'calc(100vh - 64px - 56px)', minHeight: 300, width: '100%', overflow: 'hidden', display: 'flex' }}>
        {editMode === '1' && (
          <div style={{ flex: 1, height: '100%' }}>
            <Editor value={content} onChange={setContent} language={fileType} />
          </div>
        )}
        {editMode === '2' && (
          <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
            <Previewer content={content} />
          </div>
        )}
        {editMode === '3' && (
          <>
            <div style={{ flex: 1, borderRight: '1px solid #e0e0e0', height: '100%' }}>
              <Editor value={content} onChange={setContent} language={fileType} />
            </div>
            <div style={{ flex: 1, borderLeft: '1px solid #e0e0e0', height: '100%', overflow: 'hidden' }}>
              <Previewer content={content} />
            </div>
          </>
        )}
      </div>
      <PathFinder
        modalOpen={pathFinderModalOpen}
        updateModalOpen={() => {setPathFinderModalOpen(false)}}
        updatePathInfo={updatePathInfo}
        fileFinderParams={fileFinderParams}
        inputEnabled={pathFinderInputActive} />
    </>
  );
};

export default OnlineEditorPage;