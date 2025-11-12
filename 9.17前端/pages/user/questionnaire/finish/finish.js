// pages/user/questionnaire/finish/finish.js
// pages/user/questionnaire/finish/finish.js
import request from '../../../../utils/request.js';

Page({
  data: {
    questionnaires: [], // 用于显示
    originalQuestionnaires: [], // 原始问卷列表，用于重置搜索
    searchValue: '',
    showEmpty: false
  },

  onLoad() {
    this.loadFinishedQuestionnaires();
  },

  onShow() {
    // 每次显示页面都刷新，保证能跟随后台/其他用户的修改/删除而更新
    this.loadFinishedQuestionnaires();
  },

  // 加载已完成问卷
  loadFinishedQuestionnaires() {
    // 显示加载状态
    wx.showLoading({ title: '加载中...' });
    
    // 使用request工具类调用后端API获取已完成问卷列表
    request.get('/smart/get-finished-questionnaires/')
      .then(res => {
        wx.hideLoading();
        
        if (res && res.success && Array.isArray(res.questionnaires)) {
          this.setData({
            questionnaires: res.questionnaires,
            originalQuestionnaires: res.questionnaires,
            showEmpty: res.questionnaires.length === 0
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
        console.error('获取已完成问卷失败:', err);
        this.setData({
          questionnaires: [],
          originalQuestionnaires: [],
          showEmpty: true
        });
      });
  },

  // 搜索
  onSearch(e) {
    this.setData({
      searchValue: e.detail.value
    });
    this.filterQuestionnaires();
  },

  triggerSearch() {
    this.filterQuestionnaires();
  },

  filterQuestionnaires() {
    const { searchValue, originalQuestionnaires } = this.data;
    if (!searchValue || !searchValue.trim()) {
      this.setData({
        questionnaires: originalQuestionnaires,
        showEmpty: originalQuestionnaires.length === 0
      });
      return;
    }

    const filtered = originalQuestionnaires.filter(item => {
      return (item.name && item.name.includes(searchValue)) || (item.description && item.description.includes(searchValue));
    });

    this.setData({
      questionnaires: filtered,
      showEmpty: filtered.length === 0
    });
  },

  // 点击查看问卷
  viewQuestionnaire(e) {
    const id = e.currentTarget.dataset.id;
    
    // 显示加载状态
    wx.showLoading({ title: '加载中...' });
    
    // 使用request工具类调用后端API获取问卷详情
    request.get(`/smart/get-questionnaire-detail/${id}/`)
      .then(res => {
        wx.hideLoading();
        
        if (res && res.success && res.questionnaire) {
          wx.navigateTo({
            url: `/pages/user/questionnaire/published/answer/answer?id=${id}&mode=view`
          });
        } else {
          const errorMsg = res && res.message 
            ? res.message 
            : '未找到问卷数据';
          
          wx.showToast({
            title: errorMsg,
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取问卷详情失败:', err);
        wx.showToast({
          title: '获取问卷详情失败',
          icon: 'none'
        });
      });
  },

  // 删除已填写的问卷
  deleteQuestionnaire(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除确认',
      content: '确定要删除该已填写问卷记录吗？删除后将无法恢复。',
      success: (res) => {
        if (res.confirm) {
          // 显示加载状态
          wx.showLoading({ title: '删除中...' });
          
          // 使用request工具类调用后端API删除已完成问卷
          request.post('/smart/delete-finished-questionnaire/', { questionnaire_id: id })
            .then(res => {
              wx.hideLoading();
              
              if (res && res.success) {
                // 更新页面数据
                const remaining = this.data.questionnaires.filter(q => q && (q.id !== id && q.id != id));
                this.setData({
                  questionnaires: remaining,
                  originalQuestionnaires: remaining,
                  showEmpty: remaining.length === 0
                });
                
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
              } else {
                const errorMsg = res && res.message 
                  ? res.message 
                  : '删除失败，请稍后重试';
                
                wx.showToast({
                  title: errorMsg,
                  icon: 'none'
                });
              }
            })
            .catch(err => {
              wx.hideLoading();
              console.error('删除问卷失败:', err);
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              });
            });
        }
      }
    });
  },

  // 导出问卷
  exportQuestionnaire(e) {
    const id = e.currentTarget.dataset.id;
    
    // 显示加载状态
    wx.showLoading({ title: '导出中...' });
    
    // 使用request工具类调用后端API导出问卷
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
  },

  // 获取问题显示答案（复用）
  getQuestionAnswer(question) {
    if (!question) return '未作答';
    if (question.type === 'single') {
      return (question.selectedOption !== undefined && question.selectedOption !== null) ? (question.options && question.options[question.selectedOption] ? question.options[question.selectedOption] : '已选择') : '未作答';
    } else if (question.type === 'multiple') {
      if (!question.selectedOptions || question.selectedOptions.length === 0) return '未作答';
      return question.selectedOptions.map(i => question.options && question.options[i] ? question.options[i] : `选项${i}`).join('; ');
    } else if (question.type === 'text') {
      return question.answer || '未作答';
    } else if (question.type === 'blank') {
      if (Array.isArray(question.blanks)) {
        return question.blanks.map((b, i) => `空${i + 1}: ${b || '未作答'}`).join('; ');
      }
      return question.answer || '未作答';
    } else if (question.type === 'draw') {
      return question.drawingData ? '有画图答案' : '未作答';
    } else if (question.type === 'matrix') {
      const matrix = question.matrix || {};
      if (!matrix.selectedCells || !Array.isArray(matrix.selectedCells)) return '未作答';
      const rows = matrix.selectedCells.map((row, rIdx) => {
        const picked = row.map((cell, cIdx) => {
          if (cell) {
            const rowTitle = (matrix.rowTitles && matrix.rowTitles[rIdx]) || `Row${rIdx+1}`;
            const colTitle = (matrix.colTitles && matrix.colTitles[cIdx]) || `Col${cIdx+1}`;
            return `${rowTitle}-${colTitle}`;
          }
          return null;
        }).filter(Boolean);
        return picked.length ? picked.join('; ') : null;
      }).filter(Boolean);
      return rows.length ? rows.join('\n') : '未作答';
    } else {
      return '未作答';
    }
  }
});
