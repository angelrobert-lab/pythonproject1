// pages/admin/questionnaire/module-questions/module-questions.js
Page({
  data: {
    moduleIndex: -1,
    moduleName: '',
    moduleQuestions: [],
    allQuestions: [],
    questionnaireTitle: '',
    questionnaireId: null
  },

  onLoad(options) {
    // 获取从上个页面传递过来的模块索引和问卷ID
    const { moduleIndex, questionnaireId } = options;
    this.setData({
      moduleIndex: parseInt(moduleIndex),
      questionnaireId: parseInt(questionnaireId) || null
    });

    // 加载问卷数据
    this.loadQuestionnaireData();
  },

  // 加载问卷数据
  loadQuestionnaireData() {
    let questionnaire = null;
    
    // 尝试从questionnaires获取问卷数据
    let questionnaires = wx.getStorageSync('questionnaires') || [];
    if (this.data.questionnaireId) {
      questionnaire = questionnaires.find(q => q.id === this.data.questionnaireId);
    }
    
    // 如果没有找到，尝试从previewQuestionnaire获取
    if (!questionnaire) {
      const previewQuestionnaire = wx.getStorageSync('previewQuestionnaire');
      if (previewQuestionnaire) {
        questionnaire = previewQuestionnaire;
      }
    }

    if (questionnaire) {
      const module = questionnaire.modules[this.data.moduleIndex];
      // 筛选出该模块下的所有问题
      const moduleQuestions = questionnaire.questions.filter(question => 
        question.moduleIndex === this.data.moduleIndex
      );

      this.setData({
        moduleName: module.name,
        moduleQuestions: moduleQuestions,
        allQuestions: questionnaire.questions,
        questionnaireTitle: questionnaire.name
      });
    }
  },

  // 编辑问题
  editQuestion(e) {
    const index = e.currentTarget.dataset.index;
    const question = this.data.moduleQuestions[index];
    // 找到这个问题在总问题列表中的索引
    const allIndex = this.data.allQuestions.findIndex(q => q === question);
    
    if (question.type === 'draw' && question.subType === 'pattern') {
      wx.navigateTo({
        url: `/pages/admin/questionnaire/draw-question/draw-question?index=${allIndex}&mode=edit`
      });
    } else if (question.type === 'draw' && question.subType === '3d') {
      wx.navigateTo({
        url: `/pages/admin/questionnaire/3d-draw-question/3d-draw-question?index=${allIndex}&mode=edit`
      });
    } else if (question.type === 'draw' && question.subType === 'clock') {
      wx.navigateTo({
        url: `/pages/admin/questionnaire/clock-draw-question/clock-draw-question?index=${allIndex}&mode=edit`
      });
    } else if (question.type === 'draw' && question.subType === 'connect') {
      wx.navigateTo({
        url: `/pages/admin/questionnaire/connect-question/connect-question?index=${allIndex}&mode=edit`
      });
    } else {
      wx.navigateTo({
        url: `/pages/admin/questionnaire/edit-question/edit-question?index=${allIndex}`
      });
    }
  },

  // 删除问题
  deleteQuestion(e) {
    const index = e.currentTarget.dataset.index;
    const question = this.data.moduleQuestions[index];
    const that = this;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个问题吗？',
      success(res) {
        if (res.confirm) {
          // 获取当前问卷
          let questionnaire = null;
          let questionnaires = wx.getStorageSync('questionnaires') || [];
          if (that.data.questionnaireId) {
            questionnaire = questionnaires.find(q => q.id === that.data.questionnaireId);
          }
          
          if (!questionnaire) {
            const previewQuestionnaire = wx.getStorageSync('previewQuestionnaire');
            if (previewQuestionnaire) {
              questionnaire = previewQuestionnaire;
            }
          }

          if (questionnaire) {
            // 找到问题在总列表中的索引并删除
            const allIndex = questionnaire.questions.findIndex(q => q === question);
            if (allIndex !== -1) {
              questionnaire.questions.splice(allIndex, 1);
              
              // 更新模块的问题计数
              if (questionnaire.modules && questionnaire.modules[that.data.moduleIndex]) {
                questionnaire.modules[that.data.moduleIndex].questionCount--;
              }

              // 重新保存问卷
              if (that.data.questionnaireId) {
                // 更新questionnaires中的问卷
                const qIndex = questionnaires.findIndex(q => q.id === that.data.questionnaireId);
                if (qIndex !== -1) {
                  questionnaires[qIndex] = questionnaire;
                  wx.setStorageSync('questionnaires', questionnaires);
                }
              } else {
                // 更新previewQuestionnaire
                wx.setStorageSync('previewQuestionnaire', questionnaire);
              }

              // 重新加载数据
              that.loadQuestionnaireData();
              
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
            }
          }
        }
      }
    });
  },

  // 添加新问题到当前模块
  addQuestionToModule(e) {
    const type = e.currentTarget.dataset.type;
    
    if (type === 'draw') {
      // 跳转到画图题型选择页面，带上模块索引信息
      wx.navigateTo({
        url: `/pages/admin/questionnaire/draw-type-select/draw-type-select?moduleIndex=${this.data.moduleIndex}`
      });
    } else {
      // 跳转到普通问题编辑页面，带上模块索引信息
      wx.navigateTo({
        url: `/pages/admin/questionnaire/edit-question/edit-question?type=${type}&moduleIndex=${this.data.moduleIndex}`
      });
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});