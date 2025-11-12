Page({
  // 生成选项字母 (A, B, C, ...)
  getOptionLetter: function(index) {
    console.log('getOptionLetter called with index:', index);
    return String.fromCharCode(65 + index);
  },

  // 验证并修复问卷数据结构
  validateAndFixQuestionnaire: function(q) {
    if (!q) return null;
    
    const fixed = JSON.parse(JSON.stringify(q));
    
    // 确保questions字段存在且为数组
    if (!fixed.questions || !Array.isArray(fixed.questions)) {
      fixed.questions = [];
    }
    
    // 确保每个题目都有必要的字段
    fixed.questions = fixed.questions.map(function(question) {
      if (!question) return { id: Date.now(), title: '未命名题目', type: 'single' };
      if (!question.type) question.type = 'single';
      if (!question.title) question.title = '未命名题目';
      if (!question.id) question.id = Date.now();
      return question;
    });
    
    return fixed;
  },

  data: {
    questionnaire: null,
    currentQuestionIndex: 0,
    loading: true,
    showQuestionSelector: false,
    letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    scrollLeft: 0,
    scrollTop: 0
  },
  // —— 仅用于预览连线题：把标签渲染成一张 SVG 图片，避免显示作答的连线 ——
  __makeConnectLabelOnly: function(question) {
    try {
      const width = question?.canvasWidth || 600;
      const height = question?.canvasHeight || 400;
      const labels = Array.isArray(question?.labels) ? question.labels : [];
      const esc = function(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
      const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`];
      for (const l of labels) {
        const cx = Number(l?.x ?? 0);
        const cy = Number(l?.y ?? 0);
        const text = esc(l?.text ?? '');
        const color = esc(l?.color ?? '#000');
        parts.push(`<circle cx="${cx}" cy="${cy}" r="6" fill="${color}" />`);
        parts.push(`<text x="${cx + 12}" y="${cy + 5}" font-size="14" fill="${color}">${text}</text>`);
      }
      parts.push('</svg>');
      return parts.join('');
    } catch (e) {
      console.error('生成SVG失败:', e);
      return '';
    }
  },

  __setQuestionnaireData: function(res) {
    try {
      const data = res.data || {};
      const questionnaire = data.questionnaire || {};
      
      console.log('问卷数据:', questionnaire);
      
      // 验证并修复问卷数据结构
      const fixedQuestionnaire = this.validateAndFixQuestionnaire(questionnaire);
      
      if (!fixedQuestionnaire) {
        this.__showErrorAndNavigateBack();
        return;
      }
      
      // 为连线题生成预览用的SVG
      fixedQuestionnaire.questions = fixedQuestionnaire.questions.map(function(question) {
        if (question.type === 'connect') {
          question.previewSvg = this.__makeConnectLabelOnly(question);
        }
        return question;
      }, this);
      
      this.setData({
        questionnaire: fixedQuestionnaire,
        loading: false
      });
      
    } catch (error) {
      console.error('设置问卷数据失败:', error);
      this.__showErrorAndNavigateBack();
    }
  },

  // 处理页面加载
  onLoad: function(options) {
    console.log('预览页面加载', options);
    this.__prepareConnectPreview(options);
  },

  // 处理页面加载
  onLoad: function(options) {
    console.log('预览页面加载', options);
    this.setData({ loading: true });
    
    try {
      // 1. 尝试从URL参数中获取问卷数据
      if (options.previewData) {
        console.log('尝试从URL参数获取问卷数据');
        const questionnaire = JSON.parse(decodeURIComponent(options.previewData));
        this.__handleQuestionnaireData(questionnaire, 'URL参数');
        return;
      }
      
      const id = options.id;
      if (!id) {
        console.error('缺少问卷ID');
        this.__showErrorAndNavigateBack();
        return;
      }
      
      // 2. 尝试从本地存储获取问卷数据
      try {
        const previewQuestionnaire = wx.getStorageSync('previewQuestionnaire');
        if (previewQuestionnaire && previewQuestionnaire.id === id) {
          console.log('从本地存储获取到问卷数据');
          this.__handleQuestionnaireData(previewQuestionnaire, '本地存储');
          return;
        }
      } catch (storageError) {
        console.error('读取本地存储失败:', storageError);
      }
      
      // 3. 从API获取问卷数据
      console.log('尝试从API获取问卷数据，问卷ID:', id);
      const request = require('../../../utils/request.js');
      
      // 先尝试获取完整问卷
      request.get(`/api/questionnaires/${id}/`)
        .then(res => {
          console.log('API响应:', res);
          if (res.data && typeof res.data === 'object') {
            this.__handleQuestionnaireData(res.data, 'API (完整问卷)');
          } else {
            // 如果完整问卷获取失败，尝试只获取题目数据
            this.__fetchQuestionsOnly(id);
          }
        })
        .catch(err => {
          console.error('获取完整问卷失败:', err);
          // 尝试只获取题目数据
          this.__fetchQuestionsOnly(id);
        });
    } catch (error) {
      console.error('页面加载时发生错误:', error);
      this.__showErrorAndNavigateBack();
    }
  },
  
  // 只获取题目数据
  __fetchQuestionsOnly: function(id) {
    const request = require('../../../utils/request.js');
    request.get(`/api/questionnaires/${id}/questions/`)
      .then(res => {
        console.log('获取题目数据响应:', res);
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const fallbackQuestionnaire = {
            id: id,
            title: '问卷 #' + id,
            questions: res.data
          };
          this.__handleQuestionnaireData(fallbackQuestionnaire, 'API (仅题目)');
        } else {
          // 如果所有方法都失败，使用模拟数据
          this.__useMockData(id);
        }
      })
      .catch(err => {
        console.error('获取题目数据失败:', err);
        // 使用模拟数据
        this.__useMockData(id);
      });
  },
  
  // 处理获取到的问卷数据
  __handleQuestionnaireData: function(questionnaire, source) {
    console.log(`从${source}获取到问卷数据:`, questionnaire);
    
    try {
      // 验证并修复问卷数据结构
      const fixedQuestionnaire = this.validateAndFixQuestionnaire(questionnaire);
      
      if (!fixedQuestionnaire) {
        this.__showErrorAndNavigateBack();
        return;
      }
      
      // 为连线题生成预览用的SVG
      fixedQuestionnaire.questions = fixedQuestionnaire.questions.map(function(question) {
        if (question.type === 'connect') {
          question.previewSvg = this.__makeConnectLabelOnly(question);
        }
        return question;
      }, this);
      
      this.setData({
        questionnaire: fixedQuestionnaire,
        loading: false
      });
      
    } catch (error) {
      console.error('处理问卷数据时发生错误:', error);
      this.__showErrorAndNavigateBack();
    }
  },
  
  // 使用模拟数据
  __useMockData: function(id) {
    console.log('使用模拟数据');
    this.setData({
      loading: false,
      questionnaire: {
        id: id,
        title: '问卷预览',
        questions: [
          {
            id: '1',
            type: 'single',
            title: '这是一个示例单选题',
            options: [
              { id: '1-1', text: '选项A' },
              { id: '1-2', text: '选项B' },
              { id: '1-3', text: '选项C' },
              { id: '1-4', text: '选项D' }
            ]
          },
          {
            id: '2',
            type: 'multiple',
            title: '这是一个示例多选题',
            options: [
              { id: '2-1', text: '选项A' },
              { id: '2-2', text: '选项B' },
              { id: '2-3', text: '选项C' },
              { id: '2-4', text: '选项D' }
            ]
          },
          {
            id: '3',
            type: 'text',
            title: '这是一个示例填空题',
            placeholder: '请输入您的答案...'
          }
        ]
      }
    });
  },

  // 表头滚动事件处理
  onHeaderScroll: function(e) {
    const scrollLeft = e.detail.scrollLeft;
    this.setData({
      scrollLeft: scrollLeft
    });
  },

  // 单元格区域滚动事件处理
  onCellsScroll: function(e) {
    const scrollLeft = e.detail.scrollLeft;
    this.setData({
      scrollLeft: scrollLeft
    });
  },

  // 表体内容滚动事件处理
  onBodyScroll: function(e) {
    const scrollTop = e.detail.scrollTop;
    this.setData({
      scrollTop: scrollTop
    });
  },

  // 切换题目选择器显示状态
  toggleQuestionSelector: function() {
    this.setData({
      showQuestionSelector: !this.data.showQuestionSelector
    });
  },

  // 选择题目
  selectQuestion: function(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentQuestionIndex: index,
      showQuestionSelector: false
    });
  },

  // 编辑当前题目
  editCurrentQuestion: function() {
    const { questionnaire, currentQuestionIndex } = this.data;
    wx.navigateTo({
      url: `/pages/admin/questionnaire/create/create?id=${questionnaire.id}&questionIndex=${currentQuestionIndex}`
    });
  },

  // 显示错误并导航回上一页
  __showErrorAndNavigateBack: function() {
    wx.showToast({
      title: '无法获取问卷数据',
      icon: 'none',
      duration: 1500
    });
    setTimeout(function() {
      wx.navigateBack();
    }, 1500);
  },

  // 上一题
  prevQuestion: function() {
    if (this.data.currentQuestionIndex > 0) {
      this.setData({
        currentQuestionIndex: this.data.currentQuestionIndex - 1
      });
      console.log('切换到上一题，当前索引:', this.data.currentQuestionIndex);
    } else {
      wx.showToast({
        title: '已经是第一题',
        icon: 'none',
        duration: 800
      });
    }
  },

  // 下一题
  nextQuestion: function() {
    if (this.data.questionnaire && this.data.questionnaire.questions && 
        this.data.currentQuestionIndex < this.data.questionnaire.questions.length - 1) {
      this.setData({
        currentQuestionIndex: this.data.currentQuestionIndex + 1
      });
      console.log('切换到下一题，当前索引:', this.data.currentQuestionIndex);
    } else {
      wx.showToast({
        title: '已经是最后一题',
        icon: 'none',
        duration: 800
      });
    }
  },

  // 显示选题弹窗
  showQuestionSelector: function() {
    if (this.data.questionnaire && this.data.questionnaire.questions && 
        this.data.questionnaire.questions.length > 0) {
      this.setData({
        showQuestionSelector: true
      });
      console.log('显示选题弹窗');
    } else {
      wx.showToast({
        title: '没有可选择的题目',
        icon: 'none',
        duration: 800
      });
    }
  },

  // 隐藏选题弹窗
  hideQuestionSelector: function() {
    this.setData({
      showQuestionSelector: false
    });
    console.log('隐藏选题弹窗');
  },

  // 结束预览
  finishPreview: function() {
    console.log('结束预览，返回上一页');
    // 先尝试使用导航回上一页
    wx.navigateBack({
      delta: 1,
      fail: function() {
        // 如果返回失败，跳转到首页
        wx.switchTab({
          url: '/pages/index/index',
          fail: function() {
            // 如果切换Tab失败，强制重定向到首页
            wx.redirectTo({
              url: '/pages/index/index'
            });
          }
        });
      }
    });
  }
});