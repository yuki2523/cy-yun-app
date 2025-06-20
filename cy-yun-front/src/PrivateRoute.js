import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ element, ...rest }) => {
  const isLoggedIn = localStorage.getItem('isYunLogin'); // 从 localStorage 获取登录状态

  // 如果用户已登录，返回传入的 element；否则重定向到登录页面
  return isLoggedIn ? element : <Navigate to="/login" />;
};

export default PrivateRoute;