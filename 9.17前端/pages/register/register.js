// pages/register/register.js
import request from '../../utils/request.js';

Page({
  data: {
    nickname: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreed: false,
    canSubmit: false,
    nicknameError: '',
    emailError: '',
    passwordError: '',
    selectedRole: 'ordinary_user', // 默认值与后端模型保持一致
    roleName: '普通用户'
  },

  onLoad(options) {
    // 将前端角色标识映射到后端需要的 user_type 值
    const roleMap = {
      'user': { name: '普通用户', value: 'ordinary_user' },
      'admin': { name: '系统管理员', value: 'system_admin' },
      'researcher': { name: '医学研究员', value: 'medical_researcher' },
      'surveyor': { name: '问卷录入员', value: 'questionnaire_entrant' }
    };
    
    const roleKey = options.role || 'user';
    const roleInfo = roleMap[roleKey] || roleMap['user'];
    
    this.setData({
      selectedRole: roleInfo.value,
      roleName: roleInfo.name
    });
  },

  // 监听所有输入变化，更新按钮状态
  updateButtonState() {
    const { nickname, email, password, confirmPassword, agreed, nicknameError, emailError, passwordError } = this.data;
    const canSubmit = (
      nickname.length >= 2 && 
      !nicknameError &&
      email.includes('@') &&
      !emailError &&
      password.length >= 8 && 
      !passwordError &&
      password === confirmPassword && 
      agreed
    );
    this.setData({ canSubmit });
  },

  // 昵称输入
  onInputNickname(e) {
    const nickname = e.detail.value;
    let nicknameError = '';
    
    if (nickname && nickname.length > 0) {
      if (nickname.length < 2) {
        nicknameError = '昵称至少需要2个字符';
      } else if (nickname.length > 16) {
        nicknameError = '昵称不能超过16个字符';
      } else if (!/^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(nickname)) {
        nicknameError = '昵称只能包含汉字、英文、数字';
      }
    }
    
    this.setData({ 
      nickname: nickname,
      nicknameError: nicknameError
    });
    this.updateButtonState();
  },

  // 邮箱输入
  onInputEmail(e) {
    const email = e.detail.value;
    let emailError = '';
    
    if (email && email.length > 0) {
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        emailError = '邮箱格式不正确';
      }
    }
    
    this.setData({ 
      email: email,
      emailError: emailError
    });
    this.updateButtonState();
  },

  // 密码输入
  onInputPassword(e) {
    const password = e.detail.value;
    let passwordError = '';
    
    if (password && password.length > 0) {
      if (password.length < 8) {
        passwordError = '密码至少需要8个字符';
      } else if (password.length > 16) {
        passwordError = '密码不能超过16个字符';
      } else if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/.test(password)) {
        passwordError = '密码必须包含字母和数字';
      }
    }
    
    this.setData({ 
      password: password,
      passwordError: passwordError
    });
    this.updateButtonState();
  },

  // 确认密码输入
  onInputConfirmPassword(e) {
    this.setData({ confirmPassword: e.detail.value });
    this.updateButtonState();
  },

  // 协议勾选
  onAgreementChange(e) {
    this.setData({ agreed: e.detail.value.length > 0 });
    this.updateButtonState();
  },

  // 显示用户协议
  showAgreement() {
    wx.showModal({
      title: '用户服务协议',
      content: '【协议内容】此处应为详细的用户服务协议内容。我们承诺保护您的隐私，并仅将收集的数据用于本平台服务与相关医学研究。',
      showCancel: false,
      confirmText: '我已阅读并同意'
    });
  },

  // 表单提交
  onSubmit() {
    const { nickname, email, password, selectedRole, canSubmit } = this.data;

    if (!canSubmit) {
        wx.showToast({ title: '请检查输入项', icon: 'none' });
        return;
    }
    
    wx.showLoading({ title: '注册中...' });
    
    const registerData = {
      nickname: nickname.trim(),
      email: email.trim().toLowerCase(),
      password: password,
      user_type: selectedRole,
      // 为 AbstractUser 模型的 username 提供一个唯一的默认值
      // 后端 SmartUserSerializer 的 create 方法会使用 create_user，它需要 username
      username: `${nickname.trim()}_${Date.now()}` 
    };
    
    // 【核心修改】调用新的 API 路由
    request.post('/api/auth/register/', registerData)
      .then(res => {
        wx.hideLoading();
        
        if (res.status === 'success') {
          wx.showToast({
            title: '注册成功！',
            icon: 'success',
            duration: 1500,
            complete: () => {
              setTimeout(() => {
                // 注册成功后，跳转到身份选择页，让用户重新登录
                wx.reLaunch({
                  url: '/pages/login-index/login-index'
                });
              }, 1500);
            }
          });
        } else {
          // 显示后端返回的具体错误信息
          wx.showToast({
            title: res.message || '注册失败，请稍后重试',
            icon: 'none',
            duration: 2500
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('注册请求失败:', err);
        // 网络错误或后端返回了非2xx状态码
        const errorMsg = err.data ? (err.data.message || '注册失败') : '网络请求失败';
        wx.showToast({ title: errorMsg, icon: 'none', duration: 2500 });
      });
  },
});