import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: '/cy-yun', // 使用相对路径
  timeout: 10000, // 请求超时时间（毫秒）
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    // TODO
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('Response Error:', error.response.data);
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      if ([401].includes(error.response.status)) { // 暂时只设置401为登陆认证失败状态码
        // 清空 localStorage 的登录信息
        localStorage.removeItem('isYunLogin');
        localStorage.removeItem('yunId');
        window.location.href = '/cy-yun-app/login';
      }
    } else if (error.request) {
      console.error('No Response:', error.request);
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;