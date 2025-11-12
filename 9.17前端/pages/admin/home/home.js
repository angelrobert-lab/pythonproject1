// pages/admin/home/home.js
import request from '../../../utils/request'; // 【修改】导入我们优化后的请求工具

Page({
  data: {
    adminInfo: {
      name: "加载中...",       // 初始状态
      role: "系统管理员",     // 默认角色文本
      lastLogin: "正在获取...", // 初始状态
      avatar: ""             // 默认头像
    },
    currentTime: "00:00:00",
    currentDate: ""
  },
  
  onLoad() {
    // 启动实时时钟
    this.updateClock();
    this.timer = setInterval(() => {
      this.updateClock();
    }, 1000);
  },
  
  onShow() {
    // 【修改】每次进入页面时，都调用 API 刷新用户信息
    // 这样做可以确保用户在“个人中心”修改信息后，返回主页能立即看到更新
    this.loadAdminInfo();
  },
  
  onUnload() {
    // 清除定时器，避免内存泄漏
    if (this.timer) {
      clearInterval(this.timer);
    }
  },

  // 【核心修改】从后端 API 加载管理员信息
  loadAdminInfo() {
    // 检查本地是否有 token，没有则无需请求
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.reLaunch({ url: '/pages/login-index/login-index' });
      return;
    }

    // 调用 API 获取用户的详细个人资料
    request.get('/api/user/profile/')
      .then(res => {
        // 注意：DRF API 的返回数据通常在 res.data 中，但我们的 request 工具已经处理了这一层
        // 所以这里的 res 就是后端返回的 JSON 对象
        if (res.profile) {
          this.setData({
            'adminInfo.name': res.profile.nickname || '未设置昵称',
            'adminInfo.role': res.profile.position || '系统管理员',
            'adminInfo.avatar': res.profile.avatar || '' // 使用后端返回的头像URL
          });
        }
      })
      .catch(err => {
        console.error("获取管理员个人资料失败:", err);
        // 即使失败，也尝试从缓存中读取基本信息，避免界面显示空白
        const cachedUserInfo = wx.getStorageSync('userInfo');
        if (cachedUserInfo) {
          this.setData({ 'adminInfo.name': cachedUserInfo.nickname || '用户' });
        }
      });
      
    // 【新增】单独获取用户的基本信息，包含最后登录时间
    request.get('/api/user/info/')
      .then(res => {
          if (res.success && res.user.last_login) {
              this.setData({ 'adminInfo.lastLogin': res.user.last_login });
          }
      });
  },
  
  // 更新时钟 (此函数无需修改，保持原样即可)
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
  
  // 跳转到量表问卷管理 (此函数无需修改)
  goToQuestionnaire() {
    wx.navigateTo({ url: '/pages/admin/questionnaire/questionnaire' });
  },
  
  // 跳转到个人中心 (此函数无需修改)
  goToProfile() {
    wx.navigateTo({ url: '/pages/admin/profile/profile' });
  },
  
  // 退出登录 (此函数逻辑基本不变)
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地所有登录凭证
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          
          wx.reLaunch({
            url: '/pages/login-index/login-index'
          });
        }
      }
    });
  }
});