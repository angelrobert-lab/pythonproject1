// pages/user/home/home.js
import request from '../../../utils/request.js';

Page({
  data: {
    userInfo: {
      name: "",
      role: "用户",
      lastLogin: "2023-10-15 14:30"
    },
    currentTime: "00:00:00",
    currentDate: "2023年10月15日 星期日"
  },
  
  onLoad() {
    // 从后端API获取当前登录用户信息
    this.getUserInfoFromAPI();

    // 设置初始登录时间
    this.setLoginTime();

    // 启动实时时钟
    this.updateClock();
    this.timer = setInterval(() => {
      this.updateClock();
    }, 1000);
  },
  
  onUnload() {
    // 清除定时器
    clearInterval(this.timer);
  },

  onShow() {
    // 从后端API重新获取用户信息
    this.getUserInfoFromAPI();
  },
  
  // 从后端API获取用户信息
  getUserInfoFromAPI() {
    // 显示加载状态
    wx.showLoading({ title: '加载中...' });
    
    // 使用request工具类调用后端获取用户信息API
    request.get('/smart/user-info/')
      .then(res => {
        wx.hideLoading();
        
        if (res && res.success && res.user) {
          // 获取用户信息成功
          const userInfo = res.user;
          
          // 更新页面数据
          this.setData({
            userInfo: {
              name: userInfo.nickname || '用户',
              role: this.getUserRoleName(userInfo.user_type || 'user'),
              lastLogin: userInfo.last_login || this.data.userInfo.lastLogin,
              avatar: userInfo.avatar || ''
            }
          });
          
          // 保存用户信息到本地存储，以便在其他页面使用
          wx.setStorageSync('userInfo', userInfo);
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取用户信息失败:', err);
      });
  },
  
  // 获取用户角色中文名
  getUserRoleName(userType) {
    const roleMap = {
      'user': '普通用户',
      'admin': '管理员',
      'researcher': '研究员',
      'surveyor': '录入员'
    };
    
    return roleMap[userType] || '用户';
  },
  
  // 设置登录时间
  setLoginTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    this.setData({
      'userInfo.lastLogin': `${year}-${month}-${day} ${hours}:${minutes}`
    });
  },
  
  // 更新时钟
  updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekDay = weekDays[now.getDay()];
    
    this.setData({
      currentTime: `${hours}:${minutes}:${seconds}`,
      currentDate: `${year}年${month}月${day}日 ${weekDay}`
    });
  },
  
  // 跳转到问卷查看
  goToQuestionnaire() {
    wx.navigateTo({
      url: '/pages/user/questionnaire/questionnaire'
    });
  },
  

  
  // 跳转到个人中心
  goToProfile() {
    wx.navigateTo({
      url: '/pages/user/profile/profile'
    });
  },
  
  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 调用后端退出登录API
          request.post('/smart/logout/')
            .finally(() => {
              // 清除token和userInfo
              wx.removeStorageSync('token');
              wx.removeStorageSync('userInfo');
              // 跳转到登录页面
              wx.redirectTo({
                url: '/pages/login-index/login-index'
              });
            });
        }
      }
    });
  },


});