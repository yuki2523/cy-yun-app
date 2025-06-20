import React, { useState, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { message, notification, Spin } from 'antd';
import Pages from './pages'
const {
  Login,
  MainContent,
  Register,
  ForgotPassword,
  ResetPassword,
} = Pages;
export const GlobalContext = createContext();

const App = () => {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [editableFileInfo, setEditableFileInfo] = useState(null);
  const [appLoading, setAppLoading] = useState(false); // 全局 loading 状态
  const [fileTreeExpandedKeys, setFileTreeExpandedKeys] = useState([]); // 路径查找器展开的树节点
  const context = {
    messageApi,
    notificationApi,
    editableFileInfo,
    setEditableFileInfo,
    appLoading,
    setAppLoading,
    fileTreeExpandedKeys,
    setFileTreeExpandedKeys,
  };
  return (
    <GlobalContext.Provider value={context}>
      {messageContextHolder}
      {notificationContextHolder}
      {/* 全局加载动画 */}
      {appLoading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 9999,
          }}
        >
          <Spin size="large" />
        </div>
      )}
      <Router basename="/cy-yun-app">
        <Routes>
          {/* 登录页面 */}
          <Route path="/login" element={<Login />} />
          {/* 注册页面 */}
          <Route path="/register" element={<Register />} />
          {/* 忘记密码页面 */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          {/* 密码重置页面 */}
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* 主布局 */}
          <Route
            path="/*"
            element={<MainContent />}
          />
        </Routes>
      </Router>
    </GlobalContext.Provider>
  );
};
export default App;