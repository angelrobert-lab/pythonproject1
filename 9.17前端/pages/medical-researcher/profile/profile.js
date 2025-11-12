Page({
  data: {
    profile: {
      nickname: "",
      email: "",
      name: "",
      gender: "",
      age: "",
      position: "",
      specialty: "",
      avatar: ""
    },
    feedback: ""
  },
  
  onLoad() {
    wx.setNavigationBarTitle({
      title: '个人中心'
    });

    // 获取当前登录用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        complete: () => {
          wx.reLaunch({
            url: '/pages/login-index/login-index'
          });
        }
      });
      return;
    }

    // 从缓存中加载用户数据（基于用户ID）
    const cacheKey = `researcherProfile_${userInfo.id}`;
    const savedProfile = wx.getStorageSync(cacheKey);
    
    // 构建包含用户信息的基础数据
    const baseProfile = {
      nickname: userInfo.nickname || "",
      email: userInfo.email || "",
      name: "",
      gender: "",
      age: "",
      position: "",
      specialty: "",
      avatar: ""
    };
    
    if (savedProfile) {
      // 合并已保存的个人信息和用户信息
      this.setData({
        profile: {
          ...baseProfile,
          ...savedProfile,
          nickname: userInfo.nickname || savedProfile.nickname || "",
          email: userInfo.email || savedProfile.email || ""
        },
        nicknameError: '',
        emailError: ''
      });
    } else {
      this.setData({
        profile: baseProfile,
        nicknameError: '',
        emailError: ''
      });
    }
  },
  
  // 昵称输入
  onNicknameInput(e) {
    const nickname = e.detail.value;
    let nicknameError = '';
    
    if (nickname && nickname.length > 0) {
      if (!/^[一-龥a-zA-Z0-9]{2,16}$/.test(nickname)) {
        nicknameError = '昵称格式错误（2-16位汉字/英文/数字）';
      }
    }
    
    this.setData({
      'profile.nickname': nickname,
      nicknameError: nicknameError
    });
  },

  // 邮箱输入
  onEmailInput(e) {
    const email = e.detail.value;
    let emailError = '';
    
    if (email && email.length > 0) {
      if (!email.endsWith('.com')) {
        emailError = '邮箱必须以.com结尾';
      } else if (!/^[a-zA-Z0-9]+@[a-zA-Z0-9]+\.com$/.test(email)) {
        emailError = '邮箱格式不正确';
      }
    }
    
    this.setData({
      'profile.email': email,
      emailError: emailError
    });
  },

  // 验证表单
  validateForm() {
    const { nickname, email } = this.data.profile;
    let isValid = true;
    let nicknameError = '';
    let emailError = '';

    // 昵称验证
    if (!nickname || !/^[一-龥a-zA-Z0-9]{2,16}$/.test(nickname)) {
      nicknameError = '昵称格式错误（2-16位汉字/英文/数字）';
      isValid = false;
    }

    // 邮箱验证
    if (!email || !email.endsWith('.com') || !/^[a-zA-Z0-9]+@[a-zA-Z0-9]+\.com$/.test(email)) {
      emailError = '邮箱格式不正确（必须以.com结尾）';
      isValid = false;
    }

    this.setData({
      nicknameError: nicknameError,
      emailError: emailError
    });

    return isValid;
  },

  // 同步更新注册信息
  syncUserInfo(nickname, email) {
    try {
      // 获取当前用户信息
      const userInfo = wx.getStorageSync('userInfo') || {};
      if (!userInfo.id) return;

      // 更新用户信息
      const updatedUserInfo = {
        ...userInfo,
        nickname: nickname,
        email: email
      };
      wx.setStorageSync('userInfo', updatedUserInfo);

      // 更新对应角色的用户数据
      const storageKey = `mockUsers_${userInfo.role}`;
      const mockUsers = wx.getStorageSync(storageKey) || [];
      const userIndex = mockUsers.findIndex(u => u.id === userInfo.id);
      
      if (userIndex !== -1) {
        mockUsers[userIndex].nickname = nickname;
        mockUsers[userIndex].email = email;
        wx.setStorageSync(storageKey, mockUsers);
      }
    } catch (error) {
      console.error('同步用户信息失败:', error);
    }
  },
  
  // 姓名输入
  onNameInput(e) {
    this.setData({
      'profile.name': e.detail.value
    });
  },
  
  // 性别选择
  onGenderChange(e) {
    this.setData({
      'profile.gender': e.detail.value
    });
  },
  
  // 年龄输入
  onAgeInput(e) {
    this.setData({
      'profile.age': parseInt(e.detail.value) || 0
    });
  },
  
  // 职位输入
  onPositionInput(e) {
    this.setData({
      'profile.position': e.detail.value
    });
  },
  
  // 专业输入
  onSpecialtyInput(e) {
    this.setData({
      'profile.specialty': e.detail.value
    });
  },
  
  // 反馈输入
  onFeedbackInput(e) {
    this.setData({
      feedback: e.detail.value
    });
  },
  
  // 保存个人信息
  saveProfile() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    // 验证表单
    if (!this.validateForm()) {
      return;
    }

    const cacheKey = `researcherProfile_${userInfo.id}`;
    wx.setStorageSync(cacheKey, this.data.profile);
    
    // 同步更新注册信息
    this.syncUserInfo(this.data.profile.nickname, this.data.profile.email);
    
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },
  
  // 提交反馈
  submitFeedback() {
    if (!this.data.feedback.trim()) {
      wx.showToast({
        title: '请输入反馈内容',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '提交中...',
    });
    
    // 模拟提交到服务器
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '反馈提交成功',
        icon: 'success',
        duration: 1500
      });
      
      // 清空反馈框
      this.setData({
        feedback: ""
      });
    }, 1500);
  },
  
  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 更换头像
  changeAvatar() {
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFilePath = res.tempFilePaths[0];
        // 模拟上传图片到服务器
        wx.showLoading({
          title: '上传中...',
        });

        // 这里只是模拟上传，实际项目中需要调用wx.uploadFile上传到服务器
        setTimeout(() => {
          wx.hideLoading();
          // 保存头像路径到profile
          that.setData({
            'profile.avatar': tempFilePath
          });
          // 保存到缓存（基于用户ID）
          const userInfo = wx.getStorageSync('userInfo');
          if (userInfo && userInfo.id) {
            const cacheKey = `researcherProfile_${userInfo.id}`;
            wx.setStorageSync(cacheKey, that.data.profile);
          }
          wx.showToast({
            title: '头像上传成功',
            icon: 'success'
          });
        }, 1000);
      }
    });
  }
});