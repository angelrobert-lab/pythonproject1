const request = require('../../utils/request.js');

Page({
  data: {
    selectedRole: '',      // 从身份选择页面传递过来的身份
    roleName: '',          // 身份名称（用于显示）
    nickname: '',          // 昵称（与注册页面一致）
    password: '',          // 密码
    nicknameError: '',     // 昵称错误提示
    passwordError: '',     // 密码错误提示
    canSubmit: false       // 是否可以提交
  },

  onLoad(options) {
    const role = options.role;
    let roleName = '';
    
    // 根据角色标识设置角色名称
    switch(role) {
      case 'user':
        roleName = '普通用户';
        break;
      case 'admin':
        roleName = '系统管理员';
        break;
      case 'researcher':
        roleName = '医学研究员';
        break;
      case 'surveyor':
        roleName = '问卷录入员';
        break;
    }
    
    this.setData({
      selectedRole: role,
      roleName: roleName
    });
    
    // 设置页面标题
    wx.setNavigationBarTitle({
      title: `智慧诊断系统 - ${roleName}登录`
    });
  },

  // 监听所有输入变化，更新按钮状态
  updateButtonState() {
    const { nickname, password, nicknameError, passwordError } = this.data;
    
    // 检查是否可以提交
    const canSubmit = (
      nickname && 
      nickname.length >= 2 && 
      !nicknameError &&
      password && 
      password.length >= 8 && 
      !passwordError
    );
    
    this.setData({
      canSubmit
    });
  },

  // 昵称输入（与注册页面一致）
  onNicknameInput(e) {
    const nickname = e.detail.value;
    let nicknameError = '';
    
    if (nickname && nickname.length > 0) {
      if (nickname.length < 2) {
        nicknameError = '昵称至少需要2个字符';
      } else if (nickname.length > 16) {
        nicknameError = '昵称不能超过16个字符';
      } else if (!/^[一-龥a-zA-Z0-9]+$/.test(nickname)) {
        nicknameError = '昵称只能包含汉字、英文、数字';
      }
    }
    
    this.setData({
      nickname: nickname,
      nicknameError: nicknameError
    });
    this.updateButtonState();
  },

  // 密码输入（与注册页面保持一致）
  onPasswordInput(e) {
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

  // 跳转到注册页面
  goToRegister() {
    const role = this.data.selectedRole;
    wx.navigateTo({
      url: `/pages/register/register?role=${role}`
    });
  },

  // 跳转到忘记密码页面
  navigateToForgotPassword() {
    wx.navigateTo({
      url: '/pages/forgot-password/forgot-password'
    });
  },

  // 验证登录表单
  validateLoginForm(nickname, password) {
    // 验证昵称（与注册页面一致）
    if (!nickname || nickname.length < 2) {
      wx.showToast({
        title: '昵称至少需要2个字符',
        icon: 'none'
      });
      return false;
    }
    
    if (nickname.length > 16) {
      wx.showToast({
        title: '昵称不能超过16个字符',
        icon: 'none'
      });
      return false;
    }
    
    if (!/^[一-龥a-zA-Z0-9]+$/.test(nickname)) {
      wx.showToast({
        title: '昵称只能包含汉字、英文、数字',
        icon: 'none'
      });
      return false;
    }
    
    // 验证密码（与注册页面一致）
    if (!password || password.length < 8) {
      wx.showToast({
        title: '密码至少需要8个字符',
        icon: 'none'
      });
      return false;
    }
    
    if (password.length > 16) {
      wx.showToast({
        title: '密码不能超过16个字符',
        icon: 'none'
      });
      return false;
    }
    
    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/.test(password)) {
      wx.showToast({
        title: '密码必须包含字母和数字',
        icon: 'none'
      });
      return false;
    }
    
    return true;
  },

  // 处理登录
  handleLogin() {
    const { selectedRole, nickname, password } = this.data;
    
    console.log('handleLogin被调用');
    console.log('昵称:', nickname);
    console.log('密码:', password);
    console.log('selectedRole原始值:', selectedRole);
    
    // 验证表单数据
    if (!this.validateLoginForm(nickname, password)) {
      return;
    }
    
    // 显示加载中
    wx.showLoading({
      title: '登录中...',
    });
    
    // 构建登录请求数据
    const loginData = {
        username: nickname, // 这里使用username参数与后端对应
        password: password,
        role: selectedRole  // 后端期望接收的是role参数
      };
      
      // 【核心修改】将 URL 修改为新的、正确的 API 路由
      request.post('/api/auth/login/', loginData)
        .then(res => {
          wx.hideLoading();
          
          // 【优化】直接使用后端返回的数据，更可靠
          if (res.status === 'success' && res.data) {
            // 登录成功
            const { token, user_id, nickname, user_type, username } = res.data;
            
            // 保存登录状态
            wx.setStorageSync('token', token);
            wx.setStorageSync('userInfo', {
              id: user_id,
              nickname: nickname,
              username: username,
              userType: user_type, // 使用后端返回的真实角色
              role: selectedRole // 保留前端选择的角色用于跳转判断
            });
            
            // 根据角色跳转到不同页面
            let targetPage = '';
            // 【优化】同时判断后端返回的角色和前端选择的角色
            const role = user_type || selectedRole;
            
            switch(role) {
              case 'system_admin':
                targetPage = '/pages/admin/home/home';
                break;
              case 'medical_researcher':
                targetPage = '/pages/medical-researcher/home/home';
                break;
              case 'questionnaire_entrant':
                targetPage = '/pages/questionnaire-entry/home/home';
                break;
              case 'ordinary_user':
                targetPage = '/pages/user/home/home';
                break;
              default:
                wx.showToast({ title: '未知角色或功能未开放', icon: 'none' });
                return;
            }
            
            if (targetPage) {
              wx.showToast({
                title: '登录成功',
                icon: 'success',
                duration: 1500,
                // 【优化】使用 complete 回调确保 toast 显示完再跳转
                complete: () => {
                  setTimeout(() => {
                    wx.reLaunch({ url: targetPage });
                  }, 500); // 稍作延迟，体验更好
                }
              });
            }
          } else {
            // 登录失败，显示后端返回的错误信息
            wx.showToast({
              title: res.message || '登录失败，请检查用户名或密码',
              icon: 'none',
              duration: 2000
            });
          }
        })
        .catch(err => {
          wx.hideLoading();
          // 如果 err.data 存在，说明是后端API返回的错误，否则是网络错误
          const errorMsg = err.data ? (err.data.message || '登录失败') : '网络请求失败';
          wx.showToast({ title: errorMsg, icon: 'none' });
          console.error('登录请求失败:', err);
        });
    },
  });