// pages/medical-researcher/home/home.js
Page({
  data: {
    researcherInfo: {
      name: "",
      role: "医学研究员",
      lastLogin: "2023-10-15 14:30"
    },
    currentTime: "00:00:00",
    currentDate: "2023年10月15日 星期日"
  },
  
  onLoad() {
    // 获取当前登录用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.id) {
      // 从缓存中加载医学研究员信息（基于用户ID）
      const cacheKey = `researcherProfile_${userInfo.id}`;
      const savedProfile = wx.getStorageSync(cacheKey);
      if (savedProfile) {
        this.setData({
          researcherInfo: {
            name: savedProfile.name || this.data.researcherInfo.name,
            role: savedProfile.position || this.data.researcherInfo.role,
            lastLogin: this.data.researcherInfo.lastLogin,
            avatar: savedProfile.avatar || ''
          }
        });
      }
    }

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
    // 获取当前登录用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.id) {
      // 每次页面显示时，从缓存中重新加载医学研究员信息（基于用户ID）
      const cacheKey = `researcherProfile_${userInfo.id}`;
      const savedProfile = wx.getStorageSync(cacheKey);
      if (savedProfile) {
        this.setData({
          researcherInfo: {
            name: savedProfile.name || this.data.researcherInfo.name,
            role: savedProfile.position || this.data.researcherInfo.role,
            lastLogin: this.data.researcherInfo.lastLogin,
            avatar: savedProfile.avatar || ''
          }
        });
      }
    }
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
      'researcherInfo.lastLogin': `${year}-${month}-${day} ${hours}:${minutes}`
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
  
  // 跳转到量表问卷管理
  goToQuestionnaire() {
    wx.navigateTo({
      url: '/pages/medical-researcher/questionnaire/questionnaire'
    });
  },
  
  // 跳转到个人中心
  goToProfile() {
    wx.navigateTo({
      url: '/pages/medical-researcher/profile/profile'
    });
  },
  
  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出医学研究员账号吗？',
      success: (res) => {
        if (res.confirm) {
          // 获取当前登录用户信息
          const userInfo = wx.getStorageSync('userInfo');
          if (userInfo && userInfo.id) {
            // 清除基于用户ID的缓存
            // 保留个人信息：不清除 `researcherProfile_<id>`
          }
          // 清除token和userInfo
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