Page({
  data: {
    selectedRole: null, // 当前选中的身份
  },

  // 选择身份
  selectRole(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({
      selectedRole: role
    });
  },

  // 跳转到登录信息页面
  goToLoginDetail() {
    if (!this.data.selectedRole) {
      wx.showToast({
        title: '请选择身份',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: `/pages/login-detail/login-detail?role=${this.data.selectedRole}`
    });
  }
});