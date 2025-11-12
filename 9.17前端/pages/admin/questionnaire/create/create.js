// pages/admin/questionnaire/create/create.js
// 引入请求工具类
const request = require('../../../../utils/request.js');

Page({
  // 生成选项字母 (A, B, C, ...)
  getOptionLetter(index) {
    console.log('getOptionLetter called with index:', index);
    return String.fromCharCode(65 + index);
  },

  data: {
    questionnaireTitle: '', // 问卷标题
    questionnaireDescription: '', // 问卷描述
    questions: [], // 问题列表
    modules: [], // 模块列表
    currentModuleIndex: -1, // 当前模块索引
    showModuleDialog: false, // 显示模块对话框
    newModuleName: '', // 新模块名称
    letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    questionnaireId: null, // 问卷ID，用于编辑现有问卷
    selectedDrawType: null, // 选择的画图类型
    selectedDrawTypeName: null // 选择的画图类型名称
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
      
      // 显示加载提示
      wx.showLoading({
        title: '加载中...',
      });
      
      // 从API获取问卷数据
      request.get(`/api/questionnaires/${id}/`)
        .then(res => {
          console.log('API返回数据:', res);
          
          // 确保questionnaire是一个非null的对象
          const questionnaire = res.data && typeof res.data === 'object' && res.data !== null ? res.data : {};
          
          console.log('完整问卷数据:', questionnaire);
          
          // 如果API返回的数据有问题，尝试从整个response中提取数据
          let finalQuestionnaire = questionnaire;
          if (Object.keys(questionnaire).length === 0 && res && typeof res === 'object') {
            console.log('尝试从整个response中提取数据');
            finalQuestionnaire = res;
          }
          
          // 安全地获取问卷数据，为所有属性提供默认值
          // 注意：根据API返回数据，问卷标题字段是'title'而不是'name'
          const questionnaireTitle = finalQuestionnaire.title || finalQuestionnaire.name || '';
          const questionnaireDescription = finalQuestionnaire.description || '';
          
          // 尝试获取问题列表，API可能返回的字段名称可能有不同
          let questions = [];
          if (Array.isArray(finalQuestionnaire.questions)) {
            questions = finalQuestionnaire.questions;
          } else if (Array.isArray(finalQuestionnaire.items)) {
            questions = finalQuestionnaire.items; // 备用字段名
          } else if (Array.isArray(finalQuestionnaire.data)) {
            questions = finalQuestionnaire.data; // 备用字段名
          }
          // 额外检查API可能返回的其他字段名
          else if (Array.isArray(finalQuestionnaire.question_list)) {
            questions = finalQuestionnaire.question_list; // 备选字段名
          } else if (Array.isArray(finalQuestionnaire.content)) {
            questions = finalQuestionnaire.content; // 备选字段名
          }
          
          // 尝试获取模块列表
          let modules = [];
          if (Array.isArray(finalQuestionnaire.modules)) {
            modules = finalQuestionnaire.modules;
          }
          
          const currentModuleIndex = modules.length > 0 ? modules.length - 1 : -1;
          
          console.log('解析后的数据 - 标题:', questionnaireTitle, '问题数量:', questions.length, '模块数量:', modules.length);
          
          // 额外记录详细信息以便调试
          console.log('finalQuestionnaire对象结构:', JSON.stringify(Object.keys(finalQuestionnaire)));
          console.log('finalQuestionnaire中的问题数据:', finalQuestionnaire.questions, finalQuestionnaire.items, finalQuestionnaire.data);
          
          this.setData({
            questionnaireTitle,
            questionnaireDescription,
            questions,
            modules,
            currentModuleIndex
          });
        })
        .catch(err => {
          console.error('加载问卷数据失败:', err);
          console.error('错误详情:', JSON.stringify(err));
          
          // 尝试从本地存储获取数据作为备选方案
          const localQuestionnaires = wx.getStorageSync('questionnaires') || [];
          const localQuestionnaire = localQuestionnaires.find(q => q.id === id);
          
          if (localQuestionnaire) {
            console.log('使用本地存储数据:', localQuestionnaire);
            
            // 确保localQuestionnaire是一个非null的对象
            const validLocalQuestionnaire = localQuestionnaire && typeof localQuestionnaire === 'object' && localQuestionnaire !== null ? localQuestionnaire : {};
            
            // 同样处理本地存储数据的字段名称差异
            const localTitle = validLocalQuestionnaire.title || validLocalQuestionnaire.name || '';
            const localDescription = validLocalQuestionnaire.description || '';
            
            // 尝试获取问题列表
            let localQuestions = [];
            if (Array.isArray(validLocalQuestionnaire.questions)) {
              localQuestions = validLocalQuestionnaire.questions;
            } else if (Array.isArray(validLocalQuestionnaire.items)) {
              localQuestions = validLocalQuestionnaire.items;
            } else if (Array.isArray(validLocalQuestionnaire.data)) {
              localQuestions = validLocalQuestionnaire.data;
            }
            // 额外检查可能的字段名
            else if (Array.isArray(validLocalQuestionnaire.question_list)) {
              localQuestions = validLocalQuestionnaire.question_list;
            } else if (Array.isArray(validLocalQuestionnaire.content)) {
              localQuestions = validLocalQuestionnaire.content;
            }
            
            // 尝试获取模块列表
            let localModules = [];
            if (Array.isArray(validLocalQuestionnaire.modules)) {
              localModules = validLocalQuestionnaire.modules;
            }
            
            const localModuleIndex = localModules.length > 0 ? localModules.length - 1 : -1;
            
            console.log('本地存储数据解析 - 标题:', localTitle, '问题数量:', localQuestions.length);
            console.log('本地存储对象结构:', JSON.stringify(Object.keys(validLocalQuestionnaire)));
            
            this.setData({
              questionnaireTitle: localTitle,
              questionnaireDescription: localDescription,
              questions: localQuestions,
              modules: localModules,
              currentModuleIndex: localModuleIndex
            });
          } else {
            wx.showToast({
              title: '加载失败，请重试',
              icon: 'none'
            });
          }
        })
        .finally(() => {
          wx.hideLoading();
        });
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
    console.log('当前模块:', this.data.modules);
    
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
        moduleIndex: this.data.currentModuleIndex, // 关联到当前模块
        moduleName: this.data.currentModuleIndex >= 0 ? this.data.modules[this.data.currentModuleIndex].name : '',
        prompt: '', // 初始化提示句为空
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
      
      // 更新模块的问题计数
      const modules = [...this.data.modules];
      if (this.data.currentModuleIndex >= 0) {
        modules[this.data.currentModuleIndex].questionCount++;
      }
      
      this.setData({
        questions: questions,
        modules: modules,
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

  // 添加模块
  addModule() {
    this.setData({
      showModuleDialog: true,
      newModuleName: ''
    });
  },

  // 关闭模块对话框
  closeModuleDialog() {
    this.setData({
      showModuleDialog: false,
      newModuleName: ''
    });
  },

  // 输入模块名称
  onModuleNameInput(e) {
    this.setData({
      newModuleName: e.detail.value
    });
  },

  // 确认添加模块
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
  },

  // 阻止事件冒泡
  preventClose() {
    // 空函数，用于阻止事件冒泡
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
    const previewData = {
      name: this.data.questionnaireTitle,
      description: this.data.questionnaireDescription,
      questions: this.data.questions,
      modules: this.data.modules
    };

    // 将预览数据转换为URL参数
    const previewParams = encodeURIComponent(JSON.stringify(previewData));

    // 跳转到预览页面
    wx.navigateTo({
      url: `/pages/admin/questionnaire/preview/preview?previewData=${previewParams}`
    });
  },

  // 保存问卷 - 调用Django后端API
  saveQuestionnaire() {
    if (!this.validateForm()) return;

    wx.showLoading({
      title: '保存中...',
    });

    // 构建问卷数据 - 修改字段名以匹配后端要求
    const questionnaireData = {
      title: this.data.questionnaireTitle,  // 改为title，与后端模型字段匹配
      description: this.data.questionnaireDescription,
      questions: this.data.questions,
      status: 'draft'
      // 移除了modules（后端不需要）和updatedAt（后端会自动设置）
    };

    // 判断是新建还是编辑
    if (this.data.questionnaireId) {
      // 编辑现有问卷
      request.put(`/api/questionnaires/${this.data.questionnaireId}/`, questionnaireData)
        .then(() => {
          wx.hideLoading();
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          // 返回问卷管理页面
          setTimeout(() => {
            const pages = getCurrentPages();
            const questionnairePageIndex = pages.findIndex(page => page.route === 'pages/admin/questionnaire/questionnaire');
            if (questionnairePageIndex !== -1) {
              wx.navigateBack({ delta: pages.length - 1 - questionnairePageIndex });
            } else {
              wx.navigateTo({
                url: '/pages/admin/questionnaire/questionnaire'
              });
            }
          }, 1500);
        })
        .catch(err => {
          console.error('保存问卷失败:', err);
          wx.hideLoading();
          wx.showToast({
            title: '保存失败，请重试',
            icon: 'none'
          });
        });
    } else {
      // 新建问卷
      questionnaireData.createdAt = new Date().toISOString().split('T')[0];
      request.post('/api/questionnaires/', questionnaireData)
        .then(() => {
          wx.hideLoading();
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          // 返回问卷管理页面
          setTimeout(() => {
            const pages = getCurrentPages();
            const questionnairePageIndex = pages.findIndex(page => page.route === 'pages/admin/questionnaire/questionnaire');
            if (questionnairePageIndex !== -1) {
              wx.navigateBack({ delta: pages.length - 1 - questionnairePageIndex });
            } else {
              wx.navigateTo({
                url: '/pages/admin/questionnaire/questionnaire'
              });
            }
          }, 1500);
        })
        .catch(err => {
          console.error('创建问卷失败:', err);
          wx.hideLoading();
          wx.showToast({
            title: '保存失败，请重试',
            icon: 'none'
          });
        });
    }
  },

  // 发布问卷 - 调用Django后端API
  publishQuestionnaire() {
    if (!this.validateForm()) return;

    wx.showLoading({
      title: '发布中...',
    });

    // 首先保存问卷，确保所有内容已更新
    this.saveQuestionnaireInternal()
      .then(() => {
        // 只发送status字段进行更新，避免数据转换问题
        const publishData = {
          status: 'published'
        };
        
        console.log('更新问卷状态为已发布:', publishData);
        console.log('问卷ID:', this.data.questionnaireId);
        
        // 将PATCH请求改为PUT请求，因为后端只支持PUT方法更新问卷
        return request.put(`/api/questionnaires/${this.data.questionnaireId}/`, publishData);
      })
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: '发布成功',
          icon: 'success'
        });
        // 返回问卷管理页面
        setTimeout(() => {
          const pages = getCurrentPages();
          const questionnairePageIndex = pages.findIndex(page => page.route === 'pages/admin/questionnaire/questionnaire');
          if (questionnairePageIndex !== -1) {
            wx.navigateBack({ delta: pages.length - 1 - questionnairePageIndex });
          } else {
            wx.navigateTo({
              url: '/pages/admin/questionnaire/questionnaire'
            });
          }
        }, 1500);
      })
      .catch(err => {
        console.error('发布问卷失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '发布失败，请重试',
          icon: 'none'
        });
      });
  },
  
  // 内部保存问卷方法（返回Promise）
  saveQuestionnaireInternal() {
    // 构建问卷数据 - 修改字段名以匹配后端要求
    const questionnaireData = {
      title: this.data.questionnaireTitle,  // 改为title，与后端模型字段匹配
      description: this.data.questionnaireDescription,
      questions: this.data.questions,
      status: 'draft'  // 保持草稿状态，后续单独更新为已发布
    };
    
    console.log('保存问卷数据:', JSON.stringify(questionnaireData));
    
    // 返回Promise
    if (this.data.questionnaireId) {
      // 编辑现有问卷
      return request.put(`/api/questionnaires/${this.data.questionnaireId}/`, questionnaireData);
    } else {
      // 新建问卷（这种情况在发布流程中应该不会出现）
      questionnaireData.createdAt = new Date().toISOString().split('T')[0];
      return request.post('/api/questionnaires/', questionnaireData)
        .then(res => {
          // 设置新创建的问卷ID
          this.setData({
            questionnaireId: res.id
          });
          return res;
        });
    }
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

    // 确保questions是数组并且不为空
    if (!Array.isArray(this.data.questions) || this.data.questions.length === 0) {
      wx.showToast({
        title: '请添加至少一个问题',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

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

  // 处理问答题回答输入
  onAnswerInput(e) {
    const index = e.currentTarget.dataset.index;
    const answer = e.detail.value;
    const questions = [...this.data.questions];
    questions[index].answer = answer;
    this.setData({
      questions: questions
    });
  }
});