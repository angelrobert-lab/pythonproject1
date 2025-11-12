// pages/questionnaire-entry/questionnaire/create/create.js
Page({
   // 回到顶部
   backToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
  },

  // 回到底部
  backToBottom() {
    wx.pageScrollTo({
      scrollTop: 100000,
      duration: 300
    });
  },
  // 生成选项字母 (A, B, C, ...)
  getOptionLetter(index) {
    console.log('getOptionLetter called with index:', index);
    return String.fromCharCode(65 + index);
  },

  data: {
    questionnaireTitle: '', // 问卷标题
    questionnaireDescription: '', // 问卷描述
    questions: [], // 问题列表
    letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    questionnaireId: null, // 问卷ID，用于编辑现有问卷
    selectedDrawType: null, // 选择的画图类型
    selectedDrawTypeName: null, // 选择的画图类型名称
    modules: [], // 模块列表
    currentModuleIndex: -1, // 当前模块索引
    showModuleDialog: false, // 显示模块对话框
    newModuleName: '' // 新模块名称
  },

  onLoad(options) {
    // 页面加载时的初始化逻辑
    if (options && options.id) {
      // 编辑现有问卷或预览问卷
      const id = parseInt(options.id);
      let questionIndex = null;
      if (options.questionIndex !== undefined) {
        questionIndex = parseInt(options.questionIndex);
      }
      this.setData({
        questionnaireId: id,
        targetQuestionIndex: questionIndex
      });
      
      // 首先尝试从questionnaires获取问卷数据
      let questionnaires = wx.getStorageSync('questionnaires') || [];
      let questionnaire = questionnaires.find(q => q.id === id);
      
      // 如果没有找到，尝试从previewQuestionnaire获取
      if (!questionnaire) {
        const previewQuestionnaire = wx.getStorageSync('previewQuestionnaire');
        if (previewQuestionnaire && previewQuestionnaire.id === id) {
          questionnaire = previewQuestionnaire;
        }
      }
      
      if (questionnaire) {
        this.setData({
          questionnaireTitle: questionnaire.name,
          questionnaireDescription: questionnaire.description,
          questions: questionnaire.questions || [],
          modules: questionnaire.modules || []
        });
        
        // 设置当前模块索引为最后一个模块
        const modules = questionnaire.modules || [];
        this.setData({
          currentModuleIndex: modules.length > 0 ? modules.length - 1 : -1
        });
      }
    }
  },

  onReady() {
    // 页面渲染完成后滚动到目标题目
    if (this.data.targetQuestionIndex !== null && this.data.targetQuestionIndex >= 0) {
      setTimeout(() => {
        const query = wx.createSelectorQuery();
        query.select(`#question-item-${this.data.targetQuestionIndex}`).boundingClientRect();
        query.exec(res => {
          if (res && res[0]) {
            wx.pageScrollTo({
              scrollTop: res[0].top - 100,
              duration: 500
            });
          }
        });
      }, 500);
    }
  },

  // 页面显示时执行
  onShow() {
    console.log('create页面显示，当前问题列表长度:', this.data.questions.length);
    console.log('当前问题列表:', this.data.questions);
    console.log('当前模块列表:', this.data.modules);
    console.log('当前模块索引:', this.data.currentModuleIndex);
    // 检查是否有选择的画图题型
    if (this.data.selectedDrawType) {
      const { selectedDrawType, selectedDrawTypeName } = this.data;
      
      // 创建新的画图题
      const newQuestion = {
        type: 'draw',
        subType: selectedDrawType,
        subTypeName: selectedDrawTypeName,
        title: this.newDrawQuestionTitle || `新的${selectedDrawTypeName}`,
        exampleImage: this.newDrawQuestionExampleImage || '',
        drawingData: '',
        prompt: '', // 初始化提示句为空
        moduleIndex: this.data.currentModuleIndex,
        moduleName: this.data.currentModuleIndex >= 0 ? this.data.modules[this.data.currentModuleIndex]?.name : '',
        // 根据不同画图类型设置默认提示句
        ...(selectedDrawType === 'normal' ? {
          prompt: '请根据题目要求完成画图'
        } : selectedDrawType === '3d' ? {
          prompt: '请根据题目要求完成立体图绘制'
        } : selectedDrawType === 'clock' ? {
          hour: '',
          minute: '',
          timeRelation: '过',
          showOutline: true,
          showNumbers: true,
          showHands: true,
          prompt: '请在钟表上画出指定时间'
        } : selectedDrawType === 'pattern' ? {
          prompt: '请根据题目要求完成图案绘制'
        } : {})
      };

      // 添加到问题列表
      const questions = [...this.data.questions, newQuestion];
      this.setData({
        questions: questions,
        selectedDrawType: null,
        selectedDrawTypeName: null
      });

      // 清除临时标题和示例图
      this.newDrawQuestionTitle = null;
      this.newDrawQuestionExampleImage = null;
    }
  },

  // 设置选择的画图题型
  setSelectedDrawType(type, name) {
    this.setData({
      selectedDrawType: type,
      selectedDrawTypeName: name
    });
  },

  // 模块管理相关方法
  addModule() {
    this.setData({
      showModuleDialog: true,
      newModuleName: ''
    });
  },

  closeModuleDialog() {
    this.setData({
      showModuleDialog: false,
      newModuleName: ''
    });
  },

  onModuleNameInput(e) {
    this.setData({
      newModuleName: e.detail.value
    });
  },

  confirmAddModule() {
    const moduleName = this.data.newModuleName.trim();
    if (!moduleName) {
      wx.showToast({
        title: '请输入模块名称',
        icon: 'none'
      });
      return;
    }

    const newModule = {
      id: Date.now(),
      name: moduleName,
      startIndex: this.data.questions.length,
      questionCount: 0
    };

    const modules = [...this.data.modules, newModule];
    this.setData({
      modules: modules,
      currentModuleIndex: modules.length - 1,
      showModuleDialog: false,
      newModuleName: ''
    });

    wx.showToast({
      title: '模块添加成功',
      icon: 'success'
    });
  },

  preventClose() {
    // 阻止事件冒泡
  },

  // 处理问卷标题输入
  onTitleInput(e) {
    this.setData({
      questionnaireTitle: e.detail.value
    });
  },

  // 处理问卷描述输入
  onDescriptionInput(e) {
    this.setData({
      questionnaireDescription: e.detail.value
    });
  },

  // 跳转到问题编辑页面或画图题型选择页面
  navigateToEditQuestion(e) {
    const type = e.currentTarget.dataset.type;
    
    // 检查是否有选中的模块
    if (this.data.currentModuleIndex < 0) {
      wx.showToast({
        title: '请先选择或添加模块',
        icon: 'none'
      });
      return;
    }
    
    if (type === 'draw') {
      // 跳转到画图题型选择页面，带上模块索引
      wx.navigateTo({
        url: `/pages/admin/questionnaire/draw-type-select/draw-type-select?moduleIndex=${this.data.currentModuleIndex}`
      });
    } else {
      // 跳转到普通问题编辑页面，带上模块索引
      wx.navigateTo({
        url: `/pages/admin/questionnaire/edit-question/edit-question?type=${type}&moduleIndex=${this.data.currentModuleIndex}`
      });
    }
  },
  
  // 继续添加模块
  continueAddModule(e) {
    const moduleIndex = e.currentTarget.dataset.index;
    this.setData({
      currentModuleIndex: moduleIndex
    });
    wx.showToast({
      title: `已切换到${this.data.modules[moduleIndex].name}`,
      icon: 'none'
    });
  },

  // 编辑问题
  editQuestion(e) {
    const index = e.currentTarget.dataset.index;
    const question = this.data.questions[index];
    
    if (question.type === 'draw' && question.subType === 'pattern') {
      wx.navigateTo({
        url: `/pages/admin/questionnaire/draw-question/draw-question?index=${index}&mode=edit`
      });
    } else if (question.type === 'draw' && question.subType === '3d') {
      wx.navigateTo({
        url: `/pages/admin/questionnaire/3d-draw-question/3d-draw-question?index=${index}&mode=edit`
      });
    } else if (question.type === 'draw' && question.subType === 'clock') {
      wx.navigateTo({
        url: `/pages/admin/questionnaire/clock-draw-question/clock-draw-question?index=${index}&mode=edit`
      });
    } else if (question.type === 'draw' && question.subType === 'connect') {
      wx.navigateTo({
        url: `/pages/admin/questionnaire/connect-question/connect-question?index=${index}&mode=edit`
      });
    } else {
      wx.navigateTo({
        url: `/pages/admin/questionnaire/edit-question/edit-question?index=${index}`
      });
    }
  },

  // 删除问题
  deleteQuestion(e) {
    const index = e.currentTarget.dataset.index;
    const that = this;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个问题吗？',
      success(res) {
        if (res.confirm) {
          const questions = that.data.questions.filter((_, i) => i !== index);
          that.setData({
            questions: questions
          });
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  // 预览问卷
  previewQuestionnaire() {
    if (!this.validateForm()) return;
    
    // 构建临时问卷数据用于预览
    const previewQuestionnaire = {
      id: Date.now(), // 使用时间戳作为临时ID
      name: this.data.questionnaireTitle,
      description: this.data.questionnaireDescription,
      questions: this.data.questions,
      modules: this.data.modules
    };

    // 存储到本地存储以便预览页面获取
    wx.setStorageSync('previewQuestionnaire', previewQuestionnaire);

    // 跳转到预览页面
    wx.navigateTo({
      url: '/pages/questionnaire-entry/questionnaire/preview/preview?id=' + previewQuestionnaire.id
    });
  },

  // 保存问卷
  saveQuestionnaire() {
    if (!this.validateForm()) return;

    wx.showLoading({
      title: '保存中...',
    });

    // 判断是新建还是编辑
    let isEdit = false;
    let questionnaires = wx.getStorageSync('questionnaires') || [];
    let questionnaireIndex = -1;
    
    // 检查问卷ID是否存在于questionnaires数组中
    if (this.data.questionnaireId) {
      questionnaireIndex = questionnaires.findIndex(q => q.id === this.data.questionnaireId);
      isEdit = questionnaireIndex !== -1;
    }
    
    // 特殊情况：如果从预览页面过来编辑，尝试通过问卷标题查找原始问卷
    if (!isEdit && this.data.questionnaireTitle) {
      questionnaireIndex = questionnaires.findIndex(q => q.name === this.data.questionnaireTitle);
      isEdit = questionnaireIndex !== -1;
    }

    if (isEdit) {
      // 编辑现有问卷
      questionnaires[questionnaireIndex] = {
        ...questionnaires[questionnaireIndex],
        name: this.data.questionnaireTitle,
        description: this.data.questionnaireDescription,
        questions: this.data.questions,
        modules: this.data.modules,
        updatedAt: new Date().toISOString().split('T')[0]
      };
    } else {
      // 构建新问卷数据
      const newQuestionnaire = {
        id: Date.now(), // 使用时间戳作为临时ID
        name: this.data.questionnaireTitle,
        description: this.data.questionnaireDescription,
        createdAt: new Date().toISOString().split('T')[0], // 格式：YYYY-MM-DD
        status: '草稿',
        questions: this.data.questions,
        modules: this.data.modules
      };
      questionnaires.push(newQuestionnaire);
    }

    // 保存到本地存储
    wx.setStorageSync('questionnaires', questionnaires);

    // 更新问卷列表页面数据
    const pages = getCurrentPages();
    const questionnairePage = pages.find(page => page.route === 'pages/questionnaire-entry/questionnaire/questionnaire');
    if (questionnairePage) {
      questionnairePage.loadQuestionnaires();
    }

    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
      // 返回问卷管理页面
      setTimeout(() => {
        // 获取当前页面栈
        const pages = getCurrentPages();
        // 查找问卷管理页面在栈中的位置
        const questionnairePageIndex = pages.findIndex(page => page.route === 'pages/questionnaire-entry/questionnaire/questionnaire');
        if (questionnairePageIndex !== -1) {
          // 如果问卷管理页面在栈中，返回到该页面
          wx.navigateBack({ delta: pages.length - 1 - questionnairePageIndex });
        } else {
          // 如果不在栈中，跳转到问卷管理页面
          wx.navigateTo({
            url: '/pages/questionnaire-entry/questionnaire/questionnaire'
          });
        }
      }, 1500);
    }, 500);
  },

  // 验证表单
  validateForm() {
    if (!this.data.questionnaireTitle.trim()) {
      wx.showToast({
        title: '请输入问卷标题',
        icon: 'none'
      });
      return false;
    }

    if (!this.data.questions.length) {
      wx.showToast({
        title: '请添加至少一个问题',
        icon: 'none'
      });
      return false;
    }

    // 验证每个问题
    for (let i = 0; i < this.data.questions.length; i++) {
      const question = this.data.questions[i];

      // 验证问题标题
      if (!question.title || !question.title.trim()) {
        wx.showToast({
          title: `问题${i + 1}标题不能为空`,
          icon: 'none'
        });
        return false;
      }

      // 根据问题类型进行不同验证
      if (question.type === 'single' || question.type === 'multiple') {
        // 验证选项
        if (!question.options || !question.options.length) {
          wx.showToast({
            title: `问题${i + 1}请添加选项`,
            icon: 'none'
          });
          return false;
        }

        // 验证选项内容
        for (let j = 0; j < question.options.length; j++) {
          if (!question.options[j] || !question.options[j].trim()) {
            wx.showToast({
              title: `问题${i + 1}选项${j + 1}不能为空`,
              icon: 'none'
            });
            return false;
          }
        }
      } else if (question.type === 'blank') {
        // 验证填空题
        if (!question.blanks || !question.blanks.length) {
          wx.showToast({
            title: `问题${i + 1}请添加空格`,
            icon: 'none'
          });
          return false;
        }
      } else if (question.type === 'matrix') {
        // 验证勾选题
        if (!question.matrix || !question.matrix.rowHeaders || !question.matrix.rowHeaders.length ||
            !question.matrix.colHeaders || !question.matrix.colHeaders.length) {
          wx.showToast({
            title: `问题${i + 1}请完善矩阵选项`,
            icon: 'none'
          });
          return false;
        }
      } else if (question.type === 'draw' && question.subType === 'clock') {
        // 验证钟表题
        if (!question.hour || !question.minute) {
          wx.showToast({
            title: `问题${i + 1}请设置时间`,
            icon: 'none'
          });
          return false;
        }
      }
    }

    return true;
  }
});