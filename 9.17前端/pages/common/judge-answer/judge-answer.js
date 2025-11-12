// pages/common/judge-answer/judge-answer.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    questionnaires: [],
    originalQuestionnaires: [],
    showEmpty: false,
    searchValue: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUnjudgedQuestionnaires();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示页面时重新加载数据，确保能看到最新的问卷
    this.loadUnjudgedQuestionnaires();
  },

  /**
   * 加载未批阅的问卷
   */
  loadUnjudgedQuestionnaires() {
    // 从本地存储加载已填写但未批阅的问卷
    const finishedQuestionnaires = wx.getStorageSync('finishedQuestionnaires') || [];
    
    // 过滤出未批阅的问卷 - 包含没有状态、状态为'未提交'、'已提交'或'未批阅'的问卷
    const unjudgedQuestionnaires = finishedQuestionnaires.filter(q => {
      return !q.status || q.status === '未提交' || q.status === '已提交' || q.status === '未批阅';
    }).map(q => {
      // 对于没有状态的问卷，设置为'未批阅'
      if (!q.status || q.status === '已提交') {
        q.status = '未批阅';
      }
      
      // 确保每个问卷项都有正确的finishedId属性
      // 如果是复合ID格式（问卷ID_用户ID），则设置finishedId为完整ID，否则使用id作为finishedId
      if (!q.finishedId) {
        q.finishedId = q.id;
      }
      
      return q;
    });

    // 按完成时间倒序排列
    unjudgedQuestionnaires.sort((a, b) => {
      const timeA = new Date(a.finishedAt || 0).getTime();
      const timeB = new Date(b.finishedAt || 0).getTime();
      return timeB - timeA;
    });

    this.setData({
      questionnaires: unjudgedQuestionnaires,
      originalQuestionnaires: unjudgedQuestionnaires,
      showEmpty: unjudgedQuestionnaires.length === 0,
      searchValue: ''
    });
  },

  /**
   * 处理搜索输入
   */
  onSearch(e) {
    const searchValue = e.detail.value;
    this.setData({
      searchValue: searchValue
    });
    this.filterQuestionnaires(searchValue);
  },

  /**
   * 触发搜索
   */
  triggerSearch() {
    this.filterQuestionnaires(this.data.searchValue);
  },

  /**
   * 根据搜索关键词过滤问卷
   */
  filterQuestionnaires(keyword) {
    if (!keyword.trim()) {
      this.setData({
        questionnaires: this.data.originalQuestionnaires,
        showEmpty: this.data.originalQuestionnaires.length === 0
      });
      return;
    }

    const filtered = this.data.originalQuestionnaires.filter(q => {
      const nameMatch = q.name && q.name.includes(keyword);
      const userMatch = (q.userNickname && q.userNickname.includes(keyword)) ||
                      (q.userEmail && q.userEmail.includes(keyword));
      return nameMatch || userMatch;
    });

    this.setData({
      questionnaires: filtered,
      showEmpty: filtered.length === 0
    });
  },

  /**
   * 批阅问卷
   */
  judgeQuestionnaire(e) {
    const fid = e.currentTarget.dataset.fid;
    wx.navigateTo({
      url: `/pages/common/judge-answer/questionnaire-detail?fid=${fid}`
    });
  },

  /**
   * 删除问卷
   */
  deleteQuestionnaire(e) {
    const fid = e.currentTarget.dataset.fid;
    const that = this;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这份问卷吗？此操作不可恢复。',
      success(res) {
        if (res.confirm) {
          // 从本地存储中删除问卷
          let finishedQuestionnaires = wx.getStorageSync('finishedQuestionnaires') || [];
          finishedQuestionnaires = finishedQuestionnaires.filter(q => q.id !== fid && q.masterId !== fid);
          wx.setStorageSync('finishedQuestionnaires', finishedQuestionnaires);
          
          // 更新页面数据
          that.loadUnjudgedQuestionnaires();
          
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadUnjudgedQuestionnaires();
    wx.stopPullDownRefresh();
  }
})