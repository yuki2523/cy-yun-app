import { Modal } from 'antd';

const FilePreviewModal = ({ open, onCancel, previewUrl }) => (
  <Modal
    open={open}
    onCancel={onCancel}
    footer={null}
    width="80vw"
    style={{
      top: '50%',
      transform: 'translateY(-50%)',
      padding: 0,
      background: 'transparent',
      boxShadow: 'none',
      border: 'none'
    }}
    styles={{
      body: { height: '80vh', padding: 0, background: 'transparent' },
      content: { background: 'transparent', boxShadow: 'none', border: 'none', padding: 0 }
    }}
    destroyOnHidden
  >
    <iframe
      src={previewUrl}
      title="文件预览"
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  </Modal>
);

export default FilePreviewModal;
