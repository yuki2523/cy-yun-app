import { Modal } from 'antd';
import Previewer from './Previewer';

const PreviewerModal = ({ open, onCancel, content }) => (
  <Modal
    open={open}
    onCancel={onCancel}
    footer={null}
    width="80vw"
    height="80vh"
    style={{
      top: '50%',
      transform: 'translateY(-50%)',
      padding: 0,
      background: 'transparent',
      boxShadow: 'none',
      border: 'none',
    }}
    destroyOnHidden
  >
    <div style={{ width: '76.5vw', height: '80vh', display: 'grid', placeItems: 'center' }}>
      <Previewer content={content || ''} />
    </div>
  </Modal>
);

export default PreviewerModal;
