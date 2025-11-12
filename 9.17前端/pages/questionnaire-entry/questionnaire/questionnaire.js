// pagesquestionnaire-entry/questionnaire/questionnaire.js
Page({
  data: {
    questionnaires: [], // 问卷列表
    originalQuestionnaires: [], // 原始问卷列表，用于重置
    searchValue: '',   // 搜索值
    showEmpty: false   // 是否显示空状态
  },

  onLoad() {
    // 模拟加载问卷数据
    this.loadQuestionnaires();
  },

  // 加载问卷数据
  loadQuestionnaires() {
    // 从本地存储加载问卷数据
    const questionnaires = wx.getStorageSync('questionnaires') || [];
    
    this.setData({
      questionnaires: questionnaires,
      originalQuestionnaires: questionnaires,
      showEmpty: questionnaires.length === 0
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
      return item.name.includes(searchValue);
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
      url: `/pages/questionnaire-entry/questionnaire/preview/preview?id=${id}`
    });
  },

  // 编辑问卷
  editQuestionnaire(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/questionnaire-entry/questionnaire/create/create?id=${id}`
    });
  },

  // 批阅问卷
  reviewQuestionnaire() {
    wx.navigateTo({
      url: '/pages/common/judge/judge'
    });
  },

  // 导出问卷
  exportQuestionnaire(e) {
    const id = e.currentTarget.dataset.id;
    // 获取要导出的问卷数据
    const questionnaires = wx.getStorageSync('questionnaires') || [];
    const questionnaire = questionnaires.find(item => item.id === id);
    
    if (!questionnaire) {
      wx.showToast({
        title: '未找到问卷数据',
        icon: 'none'
      });
      return;
    }
    
    // 转换为格式化的文本
    let content = `问卷名称: ${questionnaire.name}\n`;
    content += `创建时间: ${questionnaire.createdAt}\n`;
    content += `状态: ${questionnaire.status}\n`;
    content += `描述: ${questionnaire.description}\n\n`;
    
    // 添加问题
    if (questionnaire.questions && questionnaire.questions.length > 0) {
      content += `问题列表 (${questionnaire.questions.length}个问题):\n\n`;
      questionnaire.questions.forEach((question, index) => {
        content += `${index + 1}. ${question.title}\n`;
        content += `类型: ${question.type === 'single' ? '单选题' : 
                   question.type === 'multiple' ? '多选题' : 
                   question.type === 'text' ? '问答题' : 
                   question.type === 'blank' ? '填空题' : 
                   question.type === 'draw' ? '画图题(' + question.subTypeName + ')' : 
                   question.type === 'matrix' ? '勾选题' : '其他题型'}\n`;
        
        // 添加选项（如果有）
        if (question.options && question.options.length > 0) {
          content += '选项:\n';
          question.options.forEach((option, optIndex) => {
            content += `  ${String.fromCharCode(65 + optIndex)}. ${option}\n`;
          });
        }
        
        content += '\n';
      });
    }
    
    // 小程序本地文件系统API
    const fs = wx.getFileSystemManager();
    const fileName = `${questionnaire.name}_${Date.now()}.txt`;
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    
    try {
      // 写入文件
      fs.writeFileSync(filePath, content, 'utf-8');
      
      // 检查是否在PC环境
      if (wx.getSystemInfoSync().platform === 'windows' || wx.getSystemInfoSync().platform === 'macos') {
        // PC端使用saveFileToDisk让用户选择保存位置
        wx.saveFileToDisk({
          filePath: filePath,
          success: () => {
            wx.showToast({
              title: '导出成功',
              icon: 'success'
            });
          },
          fail: (err) => {
            console.error('保存到磁盘失败:', err);
            wx.showModal({
              title: '导出成功',
              content: '文件已保存至临时目录，您可以通过文件管理器查找: ' + filePath,
              showCancel: false
            });
          }
        });
      } else {
        // 移动端打开文件 - 优化文件类型处理
    // 为确保兼容性，将文件类型显式设置为'txt'
    wx.openDocument({
      filePath: filePath,
      fileType: 'txt',
      showMenu: true,
      success: () => {
        console.log('文件打开成功');
      },
      fail: (err) => {
        console.error('文件打开失败:', err);
        // 失败时尝试另一种方式: 先保存到本地再提示用户
        wx.saveFile({
          tempFilePath: filePath,
          success: function(res) {
            const savedFilePath = res.savedFilePath
            wx.showModal({
              title: '导出成功',
              content: '文件已保存至:\n' + savedFilePath + '\n\n请前往该目录查看',
              showCancel: false
            })
          },
          fail: function(saveErr) {
            console.error('保存文件失败', saveErr)
            wx.showModal({
              title: '提示',
              content: '文件操作失败，请稍后重试',
              showCancel: false
            })
          }
        })
      }
    });
      }
    } catch (err) {
      console.error('写入文件失败:', err);
      wx.showToast({
        title: '导出失败，请重试',
        icon: 'none'
      });
    }
  },

  // 切换问卷状态（仅允许从已发布切换到草稿）
  toggleQuestionnaireStatus(e) {
    const id = e.currentTarget.dataset.id;

    // 无论何种状态，都显示无权限提示
    wx.showToast({
      title: '无权限操作',
      icon: 'none'
    });
  }
});