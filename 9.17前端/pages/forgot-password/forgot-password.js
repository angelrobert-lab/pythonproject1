// pages/forgot-password/forgot-password.js
import request from '../../utils/request.js';

Page({
  data: {
    email: '',             // 邮箱
    newPassword: '',       // 新密码
    confirmPassword: '',   // 确认密码
    emailError: '',        // 邮箱错误提示
    passwordError: '',     // 密码错误提示
    canSubmit: false       // 是否可以提交
  },

  // 邮箱输入处理
  onEmailInput: function(e) {
    const email = e.detail.value;
    let emailError = '';
    
    if (email && email.length > 0) {
      // 检查是否只包含英文、数字、@、.
      if (!/^[a-zA-Z0-9@.]+$/.test(email)) {
        emailError = '邮箱只能包含英文、数字、@、.';
      }
      // 检查是否以.com结尾
      else if (!email.endsWith('.com')) {
        emailError = '邮箱必须以.com结尾';
      }
      // 检查基本的邮箱格式
      else if (!/^[a-zA-Z0-9]+@[a-zA-Z0-9]+\.com$/.test(email)) {
        emailError = '邮箱格式不正确';
      }
    }
    
    this.setData({ 
      email: email,
      emailError: emailError
    });
    this.checkCanSubmit();
  },
  
  // 新密码输入处理
  onPasswordInput: function(e) {
    const newPassword = e.detail.value;
    let passwordError = '';
    
    if (newPassword && newPassword.length > 0) {
      if (newPassword.length < 8) {
        passwordError = '密码至少需要8个字符';
      } else if (newPassword.length > 16) {
        passwordError = '密码不能超过16个字符';
      } else if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/.test(newPassword)) {
        passwordError = '密码必须包含字母和数字';
      }
    }
    
    this.setData({ 
      newPassword: newPassword,
      passwordError: passwordError
    });
    this.checkCanSubmit();
  },
  
  // 确认密码输入处理
  onConfirmPasswordInput: function(e) {
    this.setData({ confirmPassword: e.detail.value });
    this.checkCanSubmit();
  },
  
  // 检查是否可以提交
  checkCanSubmit: function() {
    const { email, newPassword, confirmPassword, emailError, passwordError } = this.data;
    
    // 验证邮箱格式
    const isEmailValid = email && email.length > 0 && !emailError && email.endsWith('.com');
    
    // 验证密码格式和一致性
    const isPasswordValid = newPassword && newPassword.length >= 8 && newPassword.length <= 16 && 
                           !passwordError && newPassword === confirmPassword;
    
    this.setData({ 
      canSubmit: isEmailValid && isPasswordValid
    });
  },
  
  // 重置密码
  resetPassword: function() {
    const { email, newPassword, confirmPassword } = this.data;
    
    // 邮箱验证
    if (!email || !email.endsWith('.com')) {
      wx.showToast({
        title: '邮箱格式错误',
        icon: 'none'
      });
      return;
    }
    
    if (!/^[a-zA-Z0-9]+@[a-zA-Z0-9]+\.com$/.test(email)) {
      wx.showToast({
        title: '邮箱格式不正确',
        icon: 'none'
      });
      return;
    }
    
    // 密码验证
    if (!newPassword || newPassword.length < 8 || newPassword.length > 16) {
      wx.showToast({
        title: '密码需8-16位',
        icon: 'none'
      });
      return;
    }
    
    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/.test(newPassword)) {
      wx.showToast({
        title: '密码必须包含字母和数字',
        icon: 'none'
      });
      return;
    }
    
    // 密码一致性验证
    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: '两次输入的密码不一致',
        icon: 'none'
      });
      return;
    }
    
    // 显示加载状态
    wx.showLoading({ title: '重置中...' });
    
    // 构建重置密码请求数据
    const resetData = {
      email: email.trim().toLowerCase(),
      new_password: newPassword
    };
    
    // 使用request工具类调用后端重置密码API
    request.post('/smart/reset-password/', resetData)
      .then(res => {
        wx.hideLoading();
        
        if (res && res.success) {
          // 重置成功
          wx.showToast({
            title: '密码重置成功',
            icon: 'success',
            duration: 1500,
            success: () => {
              // 返回登录页面
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            }
          });
        } else {
          // 重置失败，显示错误信息
          const errorMsg = res && res.message 
            ? res.message 
            : '密码重置失败，请稍后重试';
          
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2000
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('重置密码请求失败:', err);
      });
  },
  
  // 返回登录页面
  backToLogin: function() {
    wx.navigateBack();
  }
});
