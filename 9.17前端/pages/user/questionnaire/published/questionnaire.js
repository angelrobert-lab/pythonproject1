// pages/user/questionnaire/published/questionnaire.js
import request from '../../../../utils/request.js';

Page({
  data: {
    questionnaires: [], // 问卷列表
    originalQuestionnaires: [], // 原始问卷列表，用于重置
    searchValue: '',   // 搜索值
    showEmpty: false   // 是否显示空状态
  },

  onLoad() {
    // 加载发布的问卷数据
    this.loadPublishedQuestionnaires();
  },

  // 加载发布的问卷数据
  loadPublishedQuestionnaires() {
    // 显示加载状态
    wx.showLoading({ title: '加载中...' });
    
    // 使用request工具类调用后端获取已发布问卷列表API
    request.get('/smart/get-published-questionnaires/')
      .then(res => {
        wx.hideLoading();
        
        if (res && res.success && Array.isArray(res.questionnaires)) {
          const publishedQuestionnaires = res.questionnaires;
          
          this.setData({
            questionnaires: publishedQuestionnaires,
            originalQuestionnaires: publishedQuestionnaires,
            showEmpty: publishedQuestionnaires.length === 0
          });
        } else {
          this.setData({
            questionnaires: [],
            originalQuestionnaires: [],
            showEmpty: true
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取已发布问卷失败:', err);
        this.setData({
          questionnaires: [],
          originalQuestionnaires: [],
          showEmpty: true
        });
      });
  },


  // 搜索问卷
  onSearch(e) {
    this.setData({
      searchValue: e.detail.value
    });
    this.filterQuestionnaires();
  },

  // 点击搜索图标触发搜索
  triggerSearch() {
    this.filterQuestionnaires();
  },

  // 筛选问卷
  filterQuestionnaires() {
    const { searchValue, originalQuestionnaires } = this.data;
    if (!searchValue.trim()) {
      // 如果搜索值为空，显示所有问卷
      this.setData({
        questionnaires: originalQuestionnaires,
        showEmpty: originalQuestionnaires.length === 0
      });
      return;
    }

    // 筛选出名称中包含搜索值的问卷
    const filtered = originalQuestionnaires.filter(item => {
      return item.title.includes(searchValue);
    });

    this.setData({
      questionnaires: filtered,
      showEmpty: filtered.length === 0
    });
  },

  // 查看问卷
  viewQuestionnaire(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/user/questionnaire/published/answer/answer?id=${id}`
    });
  },

  // 导出问卷
  exportQuestionnaire(e) {
    const id = e.currentTarget.dataset.id;
    
    // 显示加载状态
    wx.showLoading({ title: '导出中...' });
    
    // 使用request工具类调用后端导出问卷API
    request.post('/smart/export-questionnaire/', { questionnaire_id: id })
      .then(res => {
        wx.hideLoading();
        
        if (res && res.success && res.file_url) {
          // 调用小程序打开文档API
          wx.openDocument({
            filePath: res.file_url,
            fileType: 'txt',
            showMenu: true,
            success: () => {
              console.log('文件打开成功');
              wx.showToast({
                title: '导出成功',
                icon: 'success'
              });
            },
            fail: (err) => {
              console.error('打开文件失败:', err);
              wx.showToast({
                title: '导出失败',
                icon: 'none'
              });
            }
          });
        } else {
          const errorMsg = res && res.message 
            ? res.message 
            : '导出失败，请稍后重试';
          
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2000
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('导出问卷失败:', err);
        wx.showToast({
          title: '导出失败',
          icon: 'none'
        });
      });
  }
});