// pages/user/profile/profile.js
import request from '../../../utils/request.js';

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

    // 从后端API获取用户个人资料
    this.getUserProfileFromAPI();
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

  // 从后端API获取用户个人资料
  getUserProfileFromAPI() {
    // 显示加载状态
    wx.showLoading({ title: '加载中...' });
    
    // 使用request工具类调用后端获取用户个人资料API
    request.get('/smart/user-profile/')
      .then(res => {
        wx.hideLoading();
        
        if (res && res.success && res.profile) {
          // 获取用户个人资料成功
          this.setData({
            profile: res.profile,
            nicknameError: '',
            emailError: ''
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取用户个人资料失败:', err);
      });
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
    const value = e.detail.value;
    this.setData({
      'profile.age': value ? parseInt(value) : ''
    });
  },
  
  // 民族输入
  onPositionInput(e) {
    this.setData({
      'profile.position': e.detail.value
    });
  },
  
  // 联系电话输入
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

    // 显示加载状态
    wx.showLoading({ title: '保存中...' });
    
    // 使用request工具类调用后端保存个人资料API
    request.post('/smart/update-profile/', this.data.profile)
      .then(res => {
        wx.hideLoading();
        
        if (res && res.success) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          
          // 更新本地存储的用户信息
          if (res.user_info) {
            wx.setStorageSync('userInfo', res.user_info);
          }
        } else {
          const errorMsg = res && res.message 
            ? res.message 
            : '保存失败，请稍后重试';
          
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2000
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('保存个人资料失败:', err);
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
    
    // 显示加载状态
    wx.showLoading({
      title: '提交中...',
    });
    
    // 使用request工具类调用后端提交反馈API
    request.post('/smart/submit-feedback/', {
      content: this.data.feedback.trim()
    })
      .then(res => {
        wx.hideLoading();
        
        if (res && res.success) {
          wx.showToast({
            title: '反馈提交成功',
            icon: 'success',
            duration: 1500,
            success: () => {
              // 清空反馈框
              setTimeout(() => {
                this.setData({
                  feedback: ""
                });
              }, 1500);
            }
          });
        } else {
          const errorMsg = res && res.message 
            ? res.message 
            : '反馈提交失败，请稍后重试';
          
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2000
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('提交反馈失败:', err);
      });
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
        // 显示上传状态
        wx.showLoading({
          title: '上传中...',
        });

        // 使用request工具类上传图片
        request.uploadFile('/smart/upload-avatar/', {
          filePath: tempFilePath,
          name: 'avatar'
        })
          .then(res => {
            wx.hideLoading();
            
            if (res && res.success && res.avatar_url) {
              // 保存头像路径到profile
              that.setData({
                'profile.avatar': res.avatar_url
              });
              
              wx.showToast({
                title: '头像上传成功',
                icon: 'success'
              });
            } else {
              const errorMsg = res && res.message 
                ? res.message 
                : '头像上传失败，请稍后重试';
              
              wx.showToast({
                title: errorMsg,
                icon: 'none',
                duration: 2000
              });
            }
          })
          .catch(err => {
            wx.hideLoading();
            console.error('上传头像失败:', err);
          });
      }
    });
  }
});