// utils/request.js

// 【建议】将基础URL定义在这里，方便统一修改
const BASE_URL = 'http://127.0.0.1:8000'; 

const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');

    // 默认请求头
    const header = {
      'Content-Type': 'application/json',
      ...options.header, // 允许传入自定义的 header
    };

    // 如果 token 存在，就添加到请求头中
    if (token) {
      header['Authorization'] = `Token ${token}`;
    }

    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: header,
      success: (res) => {
        // 对后端返回的状态码进行处理
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 请求成功，返回响应数据
          resolve(res.data);
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          // 401 未授权 或 403 禁止访问，都跳转到登录页
          wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
          
          // 清除本地登录状态
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');

          // 使用 reLaunch 跳转到登录页，清空页面栈
          wx.reLaunch({ url: '/pages/login-index/login-index' });
          reject(res); // 拒绝Promise，中断后续操作
        } else {
          // 其他错误状态码，提示后端返回的错误信息
          const errorMsg = res.data.detail || res.data.message || '服务器发生错误';
          wx.showToast({ title: errorMsg, icon: 'none' });
          reject(res);
        }
      },
      fail: (err) => {
        // 网络层面的失败
        wx.showToast({ title: '网络请求失败，请检查网络', icon: 'none' });
        console.error('Request Failed:', err);
        reject(err);
      }
    });
  });
};

// 导出封装好的方法
module.exports = {
  // GET 请求
  get: (url, data) => {
    return request({ url, method: 'GET', data });
  },
  // POST 请求
  post: (url, data) => {
    return request({ url, method: 'POST', data });
  },
  // PUT 请求
  put: (url, data) => {
    return request({ url, method: 'PUT', data });
  },
  // DELETE 请求
  delete: (url) => {
    return request({ url, method: 'DELETE' });
  },
  // PATCH 请求
  patch: (url, data) => {
    return request({ url, method: 'PATCH', data });
  },
  // 【优化】上传文件也使用统一的请求封装
  uploadFile: (url, filePath, name = 'file', formData = {}) => {
    return new Promise((resolve, reject) => {
        const token = wx.getStorageSync('token');
        const header = {
            // uploadFile 不能设置 Content-Type，小程序会自动设置
        };
        if (token) {
            header['Authorization'] = `Token ${token}`;
        }

        wx.uploadFile({
            url: BASE_URL + url,
            filePath: filePath,
            name: name,
            formData: formData,
            header: header,
            success: (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        // 后端返回的通常是 JSON 字符串，需要解析
                        const data = JSON.parse(res.data);
                        resolve(data);
                    } catch (e) {
                        reject({ message: '服务器响应解析失败' });
                    }
                } else {
                   // ... 此处可以添加与 request 函数类似的错误处理 ...
                   reject(res);
                }
            },
            fail: (err) => {
                wx.showToast({ title: '文件上传失败', icon: 'none' });
                reject(err);
            }
        });
    });
  }
};