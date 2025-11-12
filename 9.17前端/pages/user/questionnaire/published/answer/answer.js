Page({
  // === 每用户隔离的已填写存储 ===
  getFinishedKey(userId) {
    return userId ? `finishedQuestionnaires_${userId}` : 'finishedQuestionnaires';
  },
  loadMyFinishedList() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const key = this.getFinishedKey(userInfo.id);
    return wx.getStorageSync(key) || [];
  },
  saveMyFinishedList(list) {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const key = this.getFinishedKey(userInfo.id);
    try { wx.setStorageSync(key, list || []); } catch (e) {}
  },
  getOptionLetter(index) {
    return String.fromCharCode(65 + index);
  },

  data: {
    selectedOptionsMap: {},
    questionnaire: null,
    currentQuestionIndex: 0,
    loading: true,
    showQuestionSelector: false,
    isSubmitted: false,
    letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    selectedOption: null,
    selectedOptions: [],

    // 画板相关数据
    context: null,
    canvas: null,
    isDrawing: false,
    isDragging: false,
    draggingLabel: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    currentColor: '#000000',
    currentLineWidth: 5,
    paths: [],
    labels: [],
    history: [],
    currentPath: null,
    canvasScale: 1,
    labelScaleX: 1,
    labelScaleY: 1,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
    __navSaving: false
  },

  // 深拷贝
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  },

  // 合并问卷数据与答案
  mergeMasterWithAnswers(master, ans) {
    const clonedMaster = this.deepClone(master);
    if (!ans || !Array.isArray(ans.questions)) return clonedMaster;

    const findAnswer = (mQ, idx) => {
      if (mQ && (mQ.id !== undefined && mQ.id !== null)) {
        const q = ans.questions.find(aq => aq && (aq.id === mQ.id || aq.id == mQ.id));
        if (q) return q;
      }
      if (mQ && mQ.title) {
        const q = ans.questions.find(aq => aq && aq.title === mQ.title);
        if (q) return q;
      }
      return ans.questions[idx] || null;
    };

    clonedMaster.questions = (clonedMaster.questions || []).map((mQ, idx) => {
      const aQ = findAnswer(mQ, idx);
      const newQ = this.deepClone(mQ);
      if (aQ) {
        // 首先复制基本结构（题目、选项等）
        // 然后确保用户回答的数据被正确合并
        if (aQ.selectedOption !== undefined) newQ.selectedOption = aQ.selectedOption;
        if (aQ.selectedOptions !== undefined) {
          newQ.selectedOptions = Array.isArray(aQ.selectedOptions) ? aQ.selectedOptions.slice() : [];
        }
        // 特别确保问答题答案字段被正确处理
        if (aQ.answer !== undefined) newQ.answer = aQ.answer;
        // 确保填空题答案字段被正确处理
        if (aQ.blanks !== undefined) {
          newQ.blanks = Array.isArray(aQ.blanks) ? aQ.blanks.slice() : aQ.blanks;
        }
        // 确保画图题数据被正确处理
        if (aQ.drawingData !== undefined) newQ.drawingData = aQ.drawingData;
        if (aQ.labels !== undefined) {
          newQ.labels = Array.isArray(aQ.labels) ? aQ.labels.slice() : aQ.labels;
        }
        // 确保矩阵题数据被正确处理
        if (aQ.matrix && aQ.matrix.selectedCells) {
          newQ.matrix = newQ.matrix || {};
          newQ.matrix.selectedCells = aQ.matrix.selectedCells.map(row => row.slice());
        } else if (aQ.selectedCells) {
          newQ.matrix = newQ.matrix || {};
          newQ.matrix.selectedCells = aQ.selectedCells.map(row => row.slice());
        }
        // 复制其他可能的属性
        Object.keys(aQ).forEach(key => {
          if (!newQ.hasOwnProperty(key) && key !== 'id' && key !== 'title' && key !== 'type' && key !== 'options' && key !== 'matrix') {
            if (Array.isArray(aQ[key])) {
              newQ[key] = aQ[key].slice();
            } else if (typeof aQ[key] === 'object' && aQ[key] !== null) {
              newQ[key] = JSON.parse(JSON.stringify(aQ[key]));
            } else {
              newQ[key] = aQ[key];
            }
          }
        });
        
        // 确保画钟表题特有属性被复制
        if (newQ.type === 'draw' && newQ.subType === 'clock') {
          if (aQ.hour !== undefined) newQ.hour = aQ.hour;
          if (aQ.minute !== undefined) newQ.minute = aQ.minute;
          if (aQ.timeRelation !== undefined) newQ.timeRelation = aQ.timeRelation;
          if (aQ.showOutline !== undefined) newQ.showOutline = aQ.showOutline;
          if (aQ.showNumbers !== undefined) newQ.showNumbers = aQ.showNumbers;
          if (aQ.showHands !== undefined) newQ.showHands = aQ.showHands;
        }
      } else {
        if (newQ.type === 'multiple' && newQ.selectedOptions === undefined) newQ.selectedOptions = [];
        if (newQ.type === 'blank' && newQ.blanks === undefined) newQ.blanks = [];
        // 初始化问答题答案字段
        if (newQ.type === 'text' && newQ.answer === undefined) newQ.answer = '';
      }
      return newQ;
    });

    clonedMaster.status = ans.status || clonedMaster.status;
    clonedMaster.finishedAt = ans.finishedAt || clonedMaster.finishedAt;

    return clonedMaster;
  },

  /**
   * 选择单选题选项 - 增强版
   */
  selectOption(e) {
    try {
      // 检查是否已提交
      if (this.data.isSubmitted) {
        wx.showToast({
          title: '问卷已提交，无法修改',
          icon: 'none'
        });
        return;
      }
      
      console.log('开始处理单选题选项选择事件');
      
      // 确保事件对象和数据集有效
      if (!e || !e.currentTarget || typeof e.currentTarget.dataset.index === 'undefined') {
        console.error('无效的选项选择事件');
        wx.showToast({ title: '操作无效', icon: 'none' });
        return;
      }
      
      const index = e.currentTarget.dataset.index;
      console.log('选择的选项索引:', index);
      
      const { questionnaire, currentQuestionIndex } = this.data;
      
      // 增强的问卷数据有效性检查
      if (!questionnaire) {
        console.error('问卷数据不存在');
        wx.showToast({ title: '问卷数据加载失败', icon: 'none' });
        return;
      }
      
      if (!Array.isArray(questionnaire.questions)) {
        console.error('问卷问题不是数组');
        wx.showToast({ title: '问卷数据格式错误', icon: 'none' });
        return;
      }
      
      // 确保当前问题索引在有效范围内
      if (currentQuestionIndex < 0 || currentQuestionIndex >= questionnaire.questions.length) {
        console.error('当前问题索引超出范围:', currentQuestionIndex);
        this.setData({ currentQuestionIndex: 0 });
        wx.showToast({ title: '题目加载失败，请重试', icon: 'none' });
        return;
      }
      
      // 获取当前问题
      const currentQuestion = questionnaire.questions[currentQuestionIndex];
      
      // 确保当前问题和选项数据有效
      if (!currentQuestion) {
        console.error('当前问题不存在');
        wx.showToast({ title: '题目加载失败', icon: 'none' });
        return;
      }
      
      // 确保问题类型是单选题
      if (currentQuestion.type !== 'single') {
        console.error('问题类型不是单选题，无法进行单选操作');
        return;
      }
      
      // 确保选项数组存在
      if (!Array.isArray(currentQuestion.options)) {
        console.error('问题选项不是数组，初始化为空数组');
        // 创建问卷副本以避免直接修改原数据
        const updatedQuestionnaire = JSON.parse(JSON.stringify(questionnaire));
        updatedQuestionnaire.questions[currentQuestionIndex].options = [];
        this.setData({ questionnaire: updatedQuestionnaire });
        return;
      }
      
      // 确保选项索引有效
      if (index < 0 || index >= currentQuestion.options.length) {
        console.error('选项索引超出范围:', index);
        return;
      }
      
      // 处理单选逻辑
      let selectedOption = index;
      if (currentQuestion.selectedOption === index) {
        // 取消选中
        selectedOption = null;
        console.log('取消选中选项:', index);
      } else {
        // 选中
        console.log('选中选项:', index);
      }

      // 创建完整的问卷副本进行更新
      try {
        const newQuestionnaire = JSON.parse(JSON.stringify(questionnaire));
        newQuestionnaire.questions[currentQuestionIndex].selectedOption = selectedOption;
        
        console.log('选项选择后的选项值:', selectedOption);
        
        // 更新数据并刷新选项映射
      this.setData({ 
        questionnaire: newQuestionnaire, 
        selectedOption: selectedOption,
        selectedOptions: [selectedOption] // 同时设置数组格式，确保refreshSelectedOptionsMap能正确获取
      }, () => { 
        try {
          this.refreshSelectedOptionsMap();
          console.log('选项映射刷新成功');
          } catch (e) {
            console.error('刷新选项映射失败:', e);
            // 出错后仍然尝试手动更新UI
            this.setData({ selectedOptionsMap: {} });
          }
        });
      } catch (jsonError) {
        console.error('创建问卷副本失败:', jsonError);
        // 备选方案：直接更新页面数据
        this.setData({ 
          selectedOption: selectedOption,
          selectedOptionsMap: {} 
        });
      }
    } catch (e) {
      console.error('选择选项时发生错误:', e);
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  /**
   * 选择多选题选项
   */
  selectMultipleOption(e) {
    if (this.data.isSubmitted) {
      wx.showToast({
        title: '问卷已提交，无法修改',
        icon: 'none'
      });
      return;
    }
    
    try {
      console.log('开始处理多选题选项选择事件');
      
      // 确保事件对象和数据集有效
      if (!e || !e.currentTarget || typeof e.currentTarget.dataset.index === 'undefined') {
        console.error('无效的选项选择事件');
        wx.showToast({ title: '操作无效', icon: 'none' });
        return;
      }
      
      const index = e.currentTarget.dataset.index;
      console.log('选择的选项索引:', index);
      
      const { questionnaire, currentQuestionIndex } = this.data;
      
      // 增强的问卷数据有效性检查
      if (!questionnaire) {
        console.error('问卷数据不存在');
        wx.showToast({ title: '问卷数据加载失败', icon: 'none' });
        return;
      }
      
      if (!Array.isArray(questionnaire.questions)) {
        console.error('问卷问题不是数组');
        wx.showToast({ title: '问卷数据格式错误', icon: 'none' });
        return;
      }
      
      // 确保当前问题索引在有效范围内
      if (currentQuestionIndex < 0 || currentQuestionIndex >= questionnaire.questions.length) {
        console.error('当前问题索引超出范围:', currentQuestionIndex);
        this.setData({ currentQuestionIndex: 0 });
        wx.showToast({ title: '题目加载失败，请重试', icon: 'none' });
        return;
      }
      
      // 获取当前问题
      const currentQuestion = questionnaire.questions[currentQuestionIndex];
      
      // 确保当前问题和选项数据有效
      if (!currentQuestion) {
        console.error('当前问题不存在');
        wx.showToast({ title: '题目加载失败', icon: 'none' });
        return;
      }
      
      // 确保问题类型是多选题
      if (currentQuestion.type !== 'multiple') {
        console.error('问题类型不是多选题，无法进行多选操作');
        return;
      }
      
      // 确保选项数组存在
      if (!Array.isArray(currentQuestion.options)) {
        console.error('问题选项不是数组，初始化为空数组');
        // 创建问卷副本以避免直接修改原数据
        const updatedQuestionnaire = JSON.parse(JSON.stringify(questionnaire));
        updatedQuestionnaire.questions[currentQuestionIndex].options = [];
        this.setData({ questionnaire: updatedQuestionnaire });
        return;
      }
      
      // 确保选项索引有效
      if (index < 0 || index >= currentQuestion.options.length) {
        console.error('选项索引超出范围:', index);
        return;
      }
      
      // 安全地获取或初始化selectedOptions数组
      let selectedOptions = [];
      if (Array.isArray(currentQuestion.selectedOptions)) {
        // 深拷贝以避免直接修改原数据
        selectedOptions = [...currentQuestion.selectedOptions];
      }
      
      // 优化的选项选择逻辑
      const optionIndex = selectedOptions.indexOf(index);
      if (optionIndex > -1) {
        // 取消选中
        selectedOptions.splice(optionIndex, 1);
        console.log('取消选中选项:', index);
      } else {
        // 选中
        selectedOptions.push(index);
        console.log('选中选项:', index);
      }

      // 创建完整的问卷副本进行更新
      try {
        const newQuestionnaire = JSON.parse(JSON.stringify(questionnaire));
        newQuestionnaire.questions[currentQuestionIndex].selectedOptions = selectedOptions;
        
        console.log('选项选择后的选项列表:', selectedOptions);
        
        // 更新数据并刷新选项映射
        this.setData({ 
          questionnaire: newQuestionnaire, 
          selectedOptions: selectedOptions 
        }, () => { 
          try {
            this.refreshSelectedOptionsMap();
            console.log('选项映射刷新成功');
          } catch (e) {
            console.error('刷新选项映射失败:', e);
            // 出错后仍然尝试手动更新UI
            this.setData({ selectedOptionsMap: this.buildSelectedOptionsMap(selectedOptions) });
          }
        });
      } catch (jsonError) {
        console.error('创建问卷副本失败:', jsonError);
        // 备选方案：直接更新页面数据
        this.setData({ 
          selectedOptions: selectedOptions,
          selectedOptionsMap: this.buildSelectedOptionsMap(selectedOptions) 
        });
      }
    } catch (e) {
      console.error('选择选项时发生错误:', e);
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  onLoad(options) {
    const targetId = options.id;
    const userInfo = wx.getStorageSync('userInfo') || {};
    const norm = v => (v===undefined||v===null) ? '' : String(v).trim();
    const isFromFinish = options && options.mode === 'view';

    // 最新主问卷结构
    const questionnaires = wx.getStorageSync('questionnaires') || [];
    let master = questionnaires.find(q => q && (norm(q.id) === norm(targetId) || q.id == targetId));

    let questionnaire = null;

    if (master) {
      // 如果本地存储中有问卷数据，直接使用
      if (isFromFinish) {
        // 仅合并当前用户自己的作答
        const myList = this.loadMyFinishedList();
        const mine = myList.find(q => q && (norm(q.id) === norm(targetId) || q.id == targetId) && norm(q.userId) === norm(userInfo.id));
        if (mine) {
          questionnaire = this.mergeMasterWithAnswers(master, mine);
        } else {
          const preview = wx.getStorageSync('previewQuestionnaire');
          if (preview && (norm(preview.id) === norm(targetId) || preview.id == targetId) && norm(preview.userId) === norm(userInfo.id)) {
            questionnaire = JSON.parse(JSON.stringify(preview));
          }
        }
      } else {
        // 从发布页进入：始终空白
        questionnaire = this.deepClone(master);
      }

      if (!questionnaire) {
        questionnaire = this.deepClone(master);
      }

      this.processQuestionnaire(questionnaire, isFromFinish);
    } else {
      // 本地存储中没有找到问卷，从后端API获取
      wx.showLoading({ title: '加载问卷中...' });
      
      // 导入request模块
      const request = require('../../../../../utils/request.js');
      
      // 直接调用获取问卷详情的接口（优先使用）
      request.get(`/smart/api/public/questionnaires/${targetId}/`)
        .then(detailRes => {
          wx.hideLoading();
          
          if (detailRes && (detailRes.status === 'success' || detailRes.data)) {
            // 处理响应数据，增强版：适配更多可能的返回格式
            console.log('获取问卷详情API响应:', detailRes);
            
            let questionnaireData = null;
            
            // 增强版：尝试从多种可能的数据结构中提取问卷数据
            if (detailRes && detailRes.data) {
              if (detailRes.data.id || detailRes.data.title) {
                // 情况1: data直接是问卷对象
                questionnaireData = detailRes.data;
                console.log('增强版：直接从data提取问卷对象');
              } else if (detailRes.data.questionnaire) {
                // 情况2: 问卷对象嵌套在data.questionnaire中
                questionnaireData = detailRes.data.questionnaire;
                console.log('增强版：从data.questionnaire提取问卷对象');
              } else if (detailRes.data.result) {
                // 情况3: 问卷对象嵌套在data.result中
                questionnaireData = detailRes.data.result;
                console.log('增强版：从data.result提取问卷对象');
              }
            }
            
            // 备选方案：如果以上方法都失败，使用整个响应
            if (!questionnaireData && detailRes) {
              questionnaireData = detailRes;
              console.log('增强版：使用整个响应作为问卷数据');
            }
            
            if (!questionnaireData) {
              console.error('增强版：无法提取有效的问卷数据');
              this.setData({ loading: false });
              wx.showToast({ title: '获取问卷数据失败', icon: 'none' });
              return;
            }
            
            // 创建问卷副本
            questionnaire = this.deepClone(questionnaireData);
            
            // 增强的问题数据处理
            this.enhanceQuestionnaireQuestions(questionnaire);
            
            console.log('获取问卷详情后的问题数量:', questionnaire.questions?.length || 0);
            
            // 再次检查问题数量，如果还是0，尝试直接从响应中提取问题
            if (!Array.isArray(questionnaire.questions) || questionnaire.questions.length === 0) {
              console.warn('增强版：问卷问题数量为0，尝试直接从响应中提取问题');
              
              // 尝试直接从原始响应中提取问题
              const rawQuestions = detailRes?.questions || 
                                  detailRes?.data?.questions || 
                                  detailRes?.data?.questionnaire?.questions || 
                                  [];
              
              if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
                questionnaire.questions = rawQuestions;
                console.log('增强版：直接从原始响应中提取到问题数量:', rawQuestions.length);
              }
            }
            
            // 保存到本地存储，便于后续访问
            this.updateLocalQuestionnaireStorage(questionnaire);
            
            // 处理并显示问卷
            this.processQuestionnaire(questionnaire, isFromFinish);
            
            console.log('处理后的问卷问题数量:', questionnaire.questions?.length || 0);
          } else {
            console.warn('问卷详情API返回格式不符合预期，尝试备用方案');
            // 备用方案：尝试获取所有问卷并筛选
            request.get('/smart/get-published-questionnaires/')
              .then(res => {
                if (res && res.success && Array.isArray(res.questionnaires)) {
                  wx.setStorageSync('questionnaires', res.questionnaires);
                  master = res.questionnaires.find(q => q && (norm(q.id) === norm(targetId) || q.id == targetId));
                  
                  if (master) {
                    questionnaire = this.deepClone(master);
                    this.enhanceQuestionnaireQuestions(questionnaire);
                    console.log('备用方案获取的问卷问题数量:', questionnaire.questions?.length || 0);
                    this.processQuestionnaire(questionnaire, isFromFinish);
                  } else {
                    this.setData({ loading: false });
                    wx.showToast({ title: '未找到问卷', icon: 'none' });
                  }
                } else {
                  this.setData({ loading: false });
                  wx.showToast({ title: '未找到问卷', icon: 'none' });
                }
              })
                .catch(err => {
                  console.error('备用方案获取问卷失败:', err);
                  this.setData({ loading: false });
                  wx.showToast({ title: '获取问卷失败', icon: 'none' });
                });
          }
        })
        .catch(err => {
          wx.hideLoading();
          console.error('获取问卷详情失败:', err);
          // 出错后继续尝试原来的逻辑
          this.setData({ loading: false });
          wx.showToast({ title: '未找到问卷', icon: 'none' });
        });
    }
  },
  
  // 增强问卷问题数据的辅助方法 - 超级增强版
  enhanceQuestionnaireQuestions(questionnaire) {
    // 确保问卷对象存在
    if (!questionnaire) {
      console.error('问卷数据为空，无法增强');
      return;
    }
    
    console.log('增强问卷数据开始，原始问卷结构:', {
      hasQuestions: !!questionnaire.questions,
      questionsType: typeof questionnaire.questions,
      isQuestionsArray: Array.isArray(questionnaire.questions),
      hasData: !!questionnaire.data,
      dataType: typeof questionnaire.data
    });
    
    // 第一步：检查并获取问题数据 - 增强版的嵌套数据处理
    if (!Array.isArray(questionnaire.questions)) {
      console.warn('问卷问题不是数组，尝试从其他字段获取');
      
      // 增强版：尝试从多层嵌套结构中获取问题数据
      let foundQuestions = null;
      
      // 策略1: 检查常见的问题字段
      const possibleQuestionFields = [
        questionnaire.question, 
        questionnaire.questions_list, 
        questionnaire.items, 
        questionnaire.data,
        questionnaire.content,
        questionnaire.body
      ];
      
      // 尝试直接字段
      for (const field of possibleQuestionFields) {
        if (Array.isArray(field)) {
          foundQuestions = field;
          console.log('策略1：从直接字段找到问题数据');
          break;
        }
      }
      
      // 策略2: 检查嵌套的data结构
      if (!foundQuestions && questionnaire.data) {
        if (Array.isArray(questionnaire.data)) {
          foundQuestions = questionnaire.data;
          console.log('策略2：从data数组找到问题数据');
        } else if (typeof questionnaire.data === 'object') {
          // 检查data对象中的常见问题字段
          const nestedDataFields = [
            questionnaire.data.questions,
            questionnaire.data.items,
            questionnaire.data.content,
            questionnaire.data.body
          ];
          for (const field of nestedDataFields) {
            if (Array.isArray(field)) {
              foundQuestions = field;
              console.log('策略2：从data对象的嵌套字段找到问题数据');
              break;
            }
          }
        }
      }
      
      // 策略3: 检查其他可能的嵌套结构
      if (!foundQuestions) {
        // 检查更多可能的嵌套路径
        const nestedPaths = [
          questionnaire.questionnaire?.questions,
          questionnaire.form?.questions,
          questionnaire.survey?.questions,
          questionnaire.result?.data?.questions,
          questionnaire.response?.data?.questions,
          questionnaire.data?.survey?.questions,
          questionnaire.data?.form?.questions
        ];
        
        for (const path of nestedPaths) {
          if (Array.isArray(path)) {
            foundQuestions = path;
            console.log('策略3：从嵌套路径找到问题数据');
            break;
          }
        }
      }
      
      // 策略4: 尝试从字符串解析（极端情况）
      if (!foundQuestions && typeof questionnaire.questions === 'string') {
        try {
          const parsed = JSON.parse(questionnaire.questions);
          if (Array.isArray(parsed)) {
            foundQuestions = parsed;
            console.log('策略4：从字符串解析得到问题数据');
          }
        } catch (e) {
          console.warn('无法从字符串解析问题数据:', e.message);
        }
      }
      
      if (foundQuestions) {
        questionnaire.questions = foundQuestions;
        console.log('增强问卷数据：从其他字段获取到问题数量:', foundQuestions.length);
        
        // 验证获取到的问题数据是否有效
        const validQuestions = foundQuestions.filter(q => q && (q.title || q.content || q.text));
        console.log('增强问卷数据：有效问题数量:', validQuestions.length);
        
        // 如果原始问题数量和有效问题数量差异太大，可能需要进一步处理
        if (validQuestions.length < foundQuestions.length * 0.5) {
          console.warn('增强问卷数据：有效问题比例较低，可能数据格式不匹配');
        }
      } else {
        // 所有尝试都失败，初始化为空数组
        questionnaire.questions = [];
        console.warn('增强问卷数据：无法获取有效的问题数据，初始化为空数组');
        
        // 最后的努力：直接尝试创建一个测试问题，确保问卷不是完全空白
        if (questionnaire.title) {
          questionnaire.questions = [{ id: 'test_question', title: '问卷已加载，但无法解析问题数据', type: 'text' }];
          console.warn('增强问卷数据：添加了测试问题，以便页面可以正常显示');
        }
      }
    } else {
      console.log('增强问卷数据：问题已存在且为数组，数量:', questionnaire.questions.length);
    }
    
    // 确保每个问题的选项数据完整
    questionnaire.questions.forEach((q, index) => {
      if ((q.type === 'single' || q.type === 'multiple')) {
        // 确保选项是数组
        if (!Array.isArray(q.options)) {
          q.options = [];
        }
        
        // 记录API返回的选项数量，便于调试
        const originalOptionsCount = q.options.length;
        
        // 确保每个选项都有必要的属性
        q.options.forEach((opt, optIndex) => {
          if (!opt.id) {
            opt.id = `option_${index}_${optIndex}`;
          }
          if (!opt.content && opt.text) {
            opt.content = opt.text; // 适配不同的字段名
          }
          // 确保选项有可见内容
          if (!opt.content) {
            opt.content = `选项${optIndex + 1}`;
          }
        });
        
        // 如果选项数组为空，添加默认选项
        if (q.options.length === 0) {
          console.log('问题选项为空，添加默认选项:', q.title || `问题${index + 1}`);
          q.options = [
            { id: `option_${index}_0`, content: '选项A' },
            { id: `option_${index}_1`, content: '选项B' },
            { id: `option_${index}_2`, content: '选项C' },
            { id: `option_${index}_3`, content: '选项D' }
          ];
        } else {
          // 记录API返回的实际选项数量
          console.log(`问题${index + 1}有${originalOptionsCount}个实际选项，已保留`);
        }
      }
    });
  },
  
  // 更新本地问卷存储的辅助方法 - 增强版
  updateLocalQuestionnaireStorage(questionnaire) {
    try {
      // 验证问卷数据的完整性，确保只有有效的问卷数据才会被保存
      if (!questionnaire || !questionnaire.id || !Array.isArray(questionnaire.questions)) {
        console.warn('问卷数据不完整，不更新本地存储', { hasId: !!questionnaire?.id, hasQuestions: Array.isArray(questionnaire?.questions) });
        return;
      }
      
      // 确保每个问题都有有效的选项
      const validQuestionnaire = this.deepClone(questionnaire);
      validQuestionnaire.questions.forEach((q) => {
        if ((q.type === 'single' || q.type === 'multiple') && (!Array.isArray(q.options) || q.options.length === 0)) {
          console.log('补充问题的默认选项', q.title);
          q.options = [{ id: 'option_0', content: '选项1' }, { id: 'option_1', content: '选项2' }];
        }
      });
      
      const questionnaires = wx.getStorageSync('questionnaires') || [];
      const norm = v => (v===undefined||v===null) ? '' : String(v).trim();
      const existingIndex = questionnaires.findIndex(q => 
        q && (norm(q.id) === norm(validQuestionnaire.id) || q.id == validQuestionnaire.id)
      );
      
      if (existingIndex >= 0) {
        questionnaires[existingIndex] = validQuestionnaire;
      } else {
        questionnaires.push(validQuestionnaire);
      }
      
      wx.setStorageSync('questionnaires', questionnaires);
      console.log('更新本地存储的问卷数据成功，保存了有效的问卷数据');
    } catch (e) {
      console.error('更新本地存储失败:', e);
    }
  },
  
  // 获取所有问卷并处理的备用方法 - 增强版
  fetchAllQuestionnairesAndProcess(targetId) {
    const request = require('../../../../../utils/request.js');
    
    console.log('备用方案：开始获取所有问卷数据，目标ID:', targetId);
    
    request.get('/smart/get-published-questionnaires/')
      .then(res => {
        console.log('备用方案：获取所有问卷响应:', res);
        
        // 增强版：更灵活的数据结构处理
        let questionnaires = [];
        
        // 处理不同可能的响应格式
        if (res && res.data && Array.isArray(res.data)) {
          questionnaires = res.data;
          console.log('备用方案：处理嵌套data数组格式');
        } else if (res && res.data && res.data.questionnaires && Array.isArray(res.data.questionnaires)) {
          questionnaires = res.data.questionnaires;
          console.log('备用方案：处理嵌套data.questionnaires格式');
        } else if (res && res.success && Array.isArray(res.questionnaires)) {
          questionnaires = res.questionnaires;
          console.log('备用方案：处理标准格式');
        } else if (Array.isArray(res)) {
          questionnaires = res;
          console.log('备用方案：处理直接数组格式');
        }
        
        console.log('备用方案：找到问卷数量:', questionnaires.length);
        
        if (questionnaires.length > 0) {
          wx.setStorageSync('questionnaires', questionnaires);
          
          // 增强版：更宽松的ID匹配逻辑
          const norm = v => (v===undefined||v===null) ? '' : String(v).trim();
          const targetIdStr = norm(targetId);
          
          console.log('备用方案：查找目标ID:', targetIdStr);
          
          let master = null;
          // 策略1: 精确匹配ID
          master = questionnaires.find(q => 
            q && (norm(q.id) === targetIdStr || q.id == targetId)
          );
          
          // 策略2: 如果没找到，尝试数字匹配
          if (!master && !isNaN(parseInt(targetId))) {
            const targetIdNum = parseInt(targetId);
            console.log('备用方案：尝试数字ID匹配:', targetIdNum);
            master = questionnaires.find(q => 
              q && !isNaN(q.id) && parseInt(q.id) === targetIdNum
            );
          }
          
          if (master) {
            console.log('备用方案：找到目标问卷，问卷标题:', master.title);
            console.log('备用方案：目标问卷问题数量:', master.questions?.length || 0);
            
            // 创建问卷副本
            const questionnaire = this.deepClone(master);
            
            // 增强问卷问题数据
            this.enhanceQuestionnaireQuestions(questionnaire);
            
            // 检查处理后的问题数量
            console.log('备用方案：增强后问卷问题数量:', questionnaire.questions?.length || 0);
            
            // 处理问卷数据
            this.processQuestionnaire(questionnaire, this.data.isFromFinish);
          } else {
            console.error('备用方案：未找到目标问卷，所有问卷ID:', questionnaires.map(q => q?.id).join(', '));
            this.setData({ loading: false });
            wx.showToast({ title: '未找到问卷数据', icon: 'none' });
          }
        } else {
          console.error('备用方案：返回数据格式不正确或问卷列表为空');
          this.setData({ loading: false });
          wx.showToast({ title: '获取问卷数据失败', icon: 'none' });
        }
      })
      .catch(err => {
        console.error('备用方案：获取所有问卷失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' });
      });
  },
  
  // 处理问卷数据的通用方法 - 增强版
  processQuestionnaire(questionnaire, isFromFinish) {
    try {
      // 确保问卷和questions属性存在
      if (!questionnaire) {
        console.error('问卷数据为空');
        this.setData({ loading: false });
        return;
      }
      
      // 深拷贝问卷数据，避免直接修改原数据
      const processedQuestionnaire = this.deepClone(questionnaire);
      
      // 确保questions属性是数组，如果不是则初始化为空数组
      if (!Array.isArray(processedQuestionnaire.questions)) {
        console.warn('问卷问题不是数组，初始化为空数组');
        processedQuestionnaire.questions = [];
      }
      
      console.log('处理问卷前的问题数量:', processedQuestionnaire.questions?.length || 0);
      
      // 确保每个问题的数据完整性
      processedQuestionnaire.questions.forEach((q, index) => {
        // 确保问题有唯一标识
        if (!q.id) {
          q.id = `question_${index}_${Date.now()}`;
        }
        
        // 确保问题标题存在
        if (!q.title) {
          q.title = '无标题问题';
        }
        
        // 确保问题类型存在
        if (!q.type) {
          q.type = 'text'; // 默认设置为文本类型
        }
        
        // 确保选项数组存在并有效 - 增强版
        if ((q.type === 'single' || q.type === 'multiple')) {
          // 增强版：确保options是数组，增加更多可能的字段名支持
          const originalOptionsCount = q.options ? (Array.isArray(q.options) ? q.options.length : 1) : 0;
          
          // 尝试从其他可能的字段获取选项数据
          if (!Array.isArray(q.options) || q.options.length === 0) {
            console.warn('选项不是有效数组或为空，尝试从其他字段获取或初始化', q.type, q.title);
            
            // 尝试从其他可能的选项字段获取
            const possibleOptionFields = [
              q.choices,   // 常见的选项字段名
              q.optionsList,
              q.items,
              q.data,
              q.content,
              q.options    // 原字段（最后的选择）
            ];
            
            let foundOptions = null;
            for (const field of possibleOptionFields) {
              if (Array.isArray(field) && field.length > 0) {
                foundOptions = field;
                console.log('增强版：从其他字段获取到选项数据，数量:', foundOptions.length);
                break;
              }
            }
            
            if (foundOptions) {
              q.options = foundOptions;
            } else {
              // 如果没有找到有效的选项数组，创建默认选项
              console.log('增强版：没有找到有效的选项数组，创建默认选项');
              q.options = [
                { id: `option_${index}_0`, content: '选项A' },
                { id: `option_${index}_1`, content: '选项B' },
                { id: `option_${index}_2`, content: '选项C' },
                { id: `option_${index}_3`, content: '选项D' }
              ];
            }
          } else {
            // 记录API返回的实际选项数量
            console.log(`问题${index + 1}有${originalOptionsCount}个实际选项，已保留`);
          }
          
          // 确保选项格式正确 - 增强版：处理更多可能的选项数据格式
          q.options.forEach((opt, optIndex) => {
            // 处理字符串类型的选项
            if (typeof opt === 'string') {
              q.options[optIndex] = { id: `option_${index}_${optIndex}`, content: opt };
              console.log('增强版：将字符串选项转换为对象格式:', opt);
              return;
            }
            
            // 处理数字类型的选项
            if (typeof opt === 'number') {
              q.options[optIndex] = { id: `option_${index}_${optIndex}`, content: `选项${opt}` };
              console.log('增强版：将数字选项转换为对象格式:', opt);
              return;
            }
            
            // 确保选项是对象
            if (typeof opt !== 'object') {
              q.options[optIndex] = { id: `option_${index}_${optIndex}`, content: String(opt) };
              console.log('增强版：将非对象选项转换为对象格式:', typeof opt);
              return;
            }
            
            // 确保选项有ID
            if (!opt.id) {
              opt.id = `option_${index}_${optIndex}`;
            }
            
            // 增强版：适配更多可能的选项内容字段名
            const possibleContentFields = [
              'content', 'text', 'value', 'label', 'name', 'option', 'answer'
            ];
            
            let contentFound = false;
            for (const field of possibleContentFields) {
              if (opt[field]) {
                opt.content = opt[field];
                contentFound = true;
                console.log('增强版：从字段', field, '获取选项内容:', opt.content);
                break;
              }
            }
            
            // 确保选项有可见内容
            if (!contentFound || !opt.content) {
              const defaultContent = q.options.length <= 26 
                ? `选项${String.fromCharCode(65 + optIndex)}` // A, B, C...
                : `选项${optIndex + 1}`;
              opt.content = defaultContent;
              console.log('增强版：选项内容为空，设置默认值:', defaultContent);
            }
          });
        }
        
        // 确保答案初始化
        if (q.type === 'multiple' && !Array.isArray(q.selectedOptions)) q.selectedOptions = [];
        if (q.type === 'single' && q.selectedOption === undefined) q.selectedOption = null;
        if (q.type === 'blank' && !Array.isArray(q.blanks)) q.blanks = q.blanks || [];
        if (q.type === 'matrix') {
          q.matrix = q.matrix || {}; 
          if (!Array.isArray(q.matrix.selectedCells)) q.matrix.selectedCells = [];
        }
        if (q.type === 'draw') {
          if (q.subType === 'connect') {
            q.labels = Array.isArray(q.labels) ? q.labels.slice() : (q.labels || []);
            q.paths = [];
          }
          if (q.drawingData === undefined) q.drawingData = '';
        }
        
        // 确保问题序号正确显示
        q.index = index + 1;
      });
      
      // 安全获取第一个问题的数据
      const firstQuestion = processedQuestionnaire.questions.length > 0 ? processedQuestionnaire.questions[0] : null;
      const initialSelectedOption = firstQuestion && firstQuestion.type === 'single' ? firstQuestion.selectedOption : null;
      const initialSelectedOptions = firstQuestion && firstQuestion.type === 'multiple' ? (Array.isArray(firstQuestion.selectedOptions) ? firstQuestion.selectedOptions : []) : [];
      
      // 预构建选项映射，确保首次渲染时有正确的选项显示
      let initialSelectedOptionsMap = {};
      if (firstQuestion && firstQuestion.type === 'multiple' && Array.isArray(initialSelectedOptions)) {
        initialSelectedOptions.forEach(idx => {
          if (typeof idx === 'number') {
            initialSelectedOptionsMap[idx] = true;
          }
        });
      } else if (firstQuestion && firstQuestion.type === 'single' && typeof initialSelectedOption === 'number') {
        initialSelectedOptionsMap[initialSelectedOption] = true;
      }
      
      // 安全处理问题索引，避免问题数量为0时的索引错误
      const questionCount = processedQuestionnaire.questions.length;
      const safeCurrentQuestionIndex = questionCount > 0 ? 0 : -1;
      
      // 设置数据并确保刷新选项映射
      this.setData({
        questionnaire: processedQuestionnaire,
        loading: false,
        currentQuestionIndex: safeCurrentQuestionIndex,
        selectedOption: initialSelectedOption,
        selectedOptions: initialSelectedOptions,
        selectedOptionsMap: initialSelectedOptionsMap,
        isSubmitted: processedQuestionnaire.status === '已提交',
        isFromFinish: !!isFromFinish
      }, () => {
        console.log('设置数据后，准备刷新选项映射', { questionCount, safeCurrentQuestionIndex });
        // 只有当有问题时才调用refreshSelectedOptionsMap
        if (questionCount > 0) {
          try {
            this.refreshSelectedOptionsMap();
          } catch (e) {
          console.error('刷新选项映射失败:', e);
          // 即使出错，也确保有默认值
          this.setData({ selectedOptionsMap: {} });
          }
        }
        
        // 额外的安全检查，确保首次渲染时有正确的选项显示
        if (processedQuestionnaire.questions.length > 0) {
          const firstQ = processedQuestionnaire.questions[0];
          if ((firstQ.type === 'single' || firstQ.type === 'multiple') && firstQ.options.length > 0) {
            console.log('验证第一个问题的选项数量:', firstQ.options.length);
          }
        }
      });
    } catch (error) {
      console.error('处理问卷数据时发生错误:', error);
      // 即使出错，也要确保页面有合理的状态
      this.setData({
        loading: false,
        questionnaire: {
          id: 'temp_' + Date.now(),
          title: '问卷',
          questions: [{
            id: 'temp_q_0',
            title: '加载失败，请重试',
            type: 'text',
            index: 1
          }]
        },
        currentQuestionIndex: 0,
        selectedOption: null,
        selectedOptions: [],
        selectedOptionsMap: {}
      });
      wx.showToast({ title: '处理问卷数据失败', icon: 'none' });
    }
  },

  onReady() {
    if (this.isDrawingQuestion()) {
      this.initCanvas();
    }
  },

  onShow() {
    // 当页面重新显示时，确保问卷数据正确加载
    const userInfo = wx.getStorageSync('userInfo') || {};
    const norm = v => (v===undefined||v===null) ? '' : String(v).trim();
    
    // 确保能获取到正确的targetId - 增强版
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const options = currentPage.options || {};
    // 优先使用options中的id，其次使用当前问卷数据中的id
    const targetId = options.id || this.data.questionnaire?.id;
    
    // 重置加载状态，确保每次显示都能正确加载数据
    if (!targetId) {
      console.error('无法获取问卷ID，无法加载问卷数据');
      wx.showToast({ title: '无法加载问卷数据', icon: 'none' });
      return;
    }
    
    console.log('页面显示，准备从API加载问卷数据:', targetId);
    
    // 强制从API重新获取问卷数据，不依赖本地存储
    if (!this.data.loading) {
      // 先清空当前问卷数据，避免显示旧数据
      this.setData({
        loading: true,
        questionnaire: null
      });
      // 从API加载最新的问卷数据
      this.loadQuestionnaireFromAPI(targetId);
    } else {
      console.log('已有加载操作正在进行，等待完成');
    }
  },
  
  // 从API加载问卷数据的辅助方法 - 增强版
  loadQuestionnaireFromAPI(targetId) {
    if (!targetId) return;
    
    // 设置加载标志
    this.setData({ loading: true });
    wx.showLoading({ title: '加载问卷中...' });
    
    // 导入request模块
    const request = require('../../../../../utils/request.js');
    
    console.log('开始从API获取问卷数据，ID:', targetId);
    
    // 直接调用获取问卷详情的API，不再通过列表查找
    request.get(`/smart/api/public/questionnaires/${targetId}/`)
      .then(detailRes => {
        wx.hideLoading();
        this.setData({ loading: false });
        
        console.log('获取问卷详情API响应:', detailRes);
        
        // 检查响应数据 - 增强版数据验证
        if (!detailRes || (detailRes.status !== 'success' && !detailRes.data)) {
          console.warn('问卷详情API返回格式不符合预期，尝试备用方案');
          // 备用方案：尝试直接获取所有问卷并筛选
          this.fetchAllQuestionnairesAndProcess(targetId);
          return;
        }
        
        // 处理响应数据，适配不同的返回格式
        let questionnaireData = detailRes.data || detailRes;
        
        // 增强版：处理嵌套的data结构
        if (questionnaireData && questionnaireData.data) {
          questionnaireData = questionnaireData.data;
          console.log('处理嵌套数据结构后:', questionnaireData);
        }
        
        // 创建问卷副本
        const questionnaire = this.deepClone(questionnaireData);
        
        // 增强的问题数据处理
        this.enhanceQuestionnaireQuestions(questionnaire);
        
        console.log('处理后的问卷问题数量:', questionnaire.questions?.length || 0);
        
        // 保存到本地存储，作为备份方案
        this.updateLocalQuestionnaireStorage(questionnaire);
        
        // 处理问卷数据
        this.processQuestionnaire(questionnaire, this.data.isFromFinish);
      })
      .catch(err => {
        console.error('获取问卷详情失败:', err);
        wx.hideLoading();
        this.setData({ loading: false });
        
        // 错误处理：尝试备用方案
        console.log('尝试备用方案获取问卷数据');
        this.fetchAllQuestionnairesAndProcess(targetId);
      });
  },

  // 判断当前是否是画图题
  isDrawingQuestion() {
    const { questionnaire, currentQuestionIndex } = this.data;
    const currentQuestion = questionnaire?.questions?.[currentQuestionIndex];
    return (currentQuestion?.type === 'draw' &&
           (currentQuestion?.subType === 'pattern' || currentQuestion?.subType === '3d' || currentQuestion?.subType === 'clock' || currentQuestion?.subType === 'connect'));
  },

  // 初始化画布
  initCanvas() {
    wx.createSelectorQuery()
      .select('#drawCanvas')
      .fields({
        node: true,
        size: true
      })
      .exec((res) => {
        if (!res[0]) return;

        const canvas = res[0].node;
        const context = canvas.getContext('2d'); // 统一使用context变量名
        const width = res[0].width;
        const height = res[0].height;
        let canvasScale = 1;
        try {
          const win = wx.getWindowInfo ? wx.getWindowInfo() : null;
          canvasScale = (win && win.pixelRatio) ? win.pixelRatio : (wx.getSystemInfoSync ? wx.getSystemInfoSync().pixelRatio : 1);
        } catch (e) {
          try { canvasScale = wx.getSystemInfoSync ? (wx.getSystemInfoSync().pixelRatio || 1) : 1; } catch (_) { canvasScale = 1; }
        }

        canvas.width = width * canvasScale;
        canvas.height = height * canvasScale;
        context.scale(canvasScale, canvasScale);

        
        // 锁定 CSS 尺寸，避免位图被非等比拉伸
        if (canvas && canvas.style) {
          canvas.style.width  = width + 'px';
          canvas.style.height = height + 'px';
        }

        const currentQuestion = this.data.questionnaire.questions[this.data.currentQuestionIndex];

        // 计算标签缩放比（创建端尺寸 -> 当前答题画布尺寸）
        const originalW = currentQuestion?.canvasWidth || width;
        const originalH = currentQuestion?.canvasHeight || height;
        const labelScaleX = width / (originalW || width);
        const labelScaleY = height / (originalH || height);

        // 根据题目 subtype 初始化 labels（仅 connect 类型保留 labels）
        let labels = [];
        if (currentQuestion?.subType === 'connect') {
          // 标准化标签对象，确保包含所有必要的样式属性
          labels = (Array.isArray(currentQuestion.labels) ? currentQuestion.labels.slice() : []).map(label => ({
            x: label.x,
            y: label.y,
            text: label.text,
            radius: label.radius || 20,
            fillStyle: label.fillStyle || '#fff',
            strokeStyle: label.strokeStyle || '#000',
            lineWidth: label.lineWidth ?? 2,
            fontSize: label.fontSize || 16,
            fontColor: label.fontColor || '#000'
          }));
        }

        // 初始化路径数据 - 连线题保留保存的路径，其他类型清空
        const paths = currentQuestion?.subType === 'connect' && Array.isArray(currentQuestion.paths) ? currentQuestion.paths.slice() : [];
        
        // 合并所有 setData 操作到一次调用，减少渲染次数
        this.setData({
          canvas: canvas,
          context: context, // 保存到data中的context属性
          canvasScale: canvasScale,
          labelScaleX: labelScaleX,
          labelScaleY: labelScaleY,
          labels: labels,
          paths: paths,
          history: [],
          currentPath: null
        }, () => {
          if (currentQuestion && currentQuestion.drawingData) {
            this.loadDrawingData(currentQuestion.drawingData);
          } else {
            // 没有 drawingData 时确保画布是空白的
            if (context) {
              context.clearRect(0, 0, canvas.width / canvasScale, canvas.height / canvasScale);
            }
            // 首帧统一重绘，确保标签和路径都被正确绘制
            this.redrawCanvas();
          }
        });
      });
  },

  // 矩阵题滚动同步
  onHeaderScroll(e) {
    const scrollLeft = e.detail.scrollLeft;
    this.setData({
      scrollLeft: scrollLeft
    });
  },

  onCellsScroll(e) {
    const scrollLeft = e.detail.scrollLeft;
    this.setData({
      scrollLeft: scrollLeft
    });
  },

  onBodyScroll(e) {
    const scrollTop = e.detail.scrollTop;
    this.setData({
      scrollTop: scrollTop
    });
  },

  initMatrixScrollSync() {
    this.setData({
      scrollLeft: 0,
      scrollTop: 0
    });
  },

  // 加载绘图数据 - 正确恢复连线题的路径和标签数据
  loadDrawingData(dataUrl) {
    const { canvas, context, currentQuestionIndex, questionnaire, canvasScale } = this.data;
    const currentQuestion = questionnaire?.questions?.[currentQuestionIndex];
    const isConnect = currentQuestion?.subType === 'connect';
    
    // 标准化标签对象，确保包含所有必要的样式属性
    const getStandardizedLabels = (labelsArr) => {
      return (Array.isArray(labelsArr) ? labelsArr.slice() : []).map(label => ({
        x: label.x,
        y: label.y,
        text: label.text,
        radius: label.radius || 20,
        fillStyle: label.fillStyle || '#fff',
        strokeStyle: label.strokeStyle || '#000',
        lineWidth: label.lineWidth ?? 2,
        fontSize: label.fontSize || 16,
        fontColor: label.fontColor || '#000'
      }));
    };
    
    if (!canvas || !context || !canvas.createImage) {
      // 兼容性：若无法创建 image，则直接设置数据
      const standardizedLabels = isConnect ? getStandardizedLabels(currentQuestion?.labels) : [];
      this.setData({
        labels: standardizedLabels,
        paths: Array.isArray(currentQuestion?.paths) ? currentQuestion.paths.slice() : [],
        history: Array.isArray(currentQuestion?.history) ? currentQuestion.history.slice() : [],
        currentPath: null
      });
      return;
    }

    // 清理临时绘制数据，正确恢复保存的路径、标签和撤销历史
    this.setData({
      paths: Array.isArray(currentQuestion?.paths) ? currentQuestion.paths.slice() : [],
      history: Array.isArray(currentQuestion?.history) ? currentQuestion.history.slice() : [],
      currentPath: null,
      labels: isConnect ? getStandardizedLabels(currentQuestion?.labels) : []
    }, () => {
      if (dataUrl) {
        const img = canvas.createImage();
        img.onload = () => {
          // 清空并绘制图片
          context.clearRect(0, 0, canvas.width / canvasScale, canvas.height / canvasScale);
          context.drawImage(img, 0, 0, canvas.width / canvasScale, canvas.height / canvasScale);
          this.redrawCanvas();
        };
        img.src = dataUrl;
      } else {
        // 如果没有图片数据，直接重绘画布上的路径和标签
        context.clearRect(0, 0, canvas.width / canvasScale, canvas.height / canvasScale);
        this.redrawCanvas();
      }
    });
  },

  // 绘制标签
  drawLabels() {
    const { context, labels } = this.data;
    if (!context || !labels || !labels.length) return;
    // 保证绘制时处于等比坐标系
    const scale = this.data.canvasScale || 1;
    if (typeof context.resetTransform === 'function') {
      context.resetTransform();
      context.scale(scale, scale);
    } else if (typeof context.setTransform === 'function') {
      context.setTransform(scale, 0, 0, scale, 0, 0);
    }
    labels.forEach(label => {
      context.save();
      context.beginPath();
      // 使用标签对象中自带的样式属性，没有则使用默认值
      const radius = label.radius !== undefined ? label.radius : 20;
      const fillStyle = label.fillStyle || '#FFFFFF';
      const strokeStyle = label.strokeStyle || '#000000';
      const lineWidth = label.lineWidth !== undefined ? label.lineWidth : 1;
      const fontSize = label.fontSize || 14;
      const fontColor = label.fontColor || '#000000';
      
      context.arc(label.x, label.y, radius, 0, Math.PI * 2);
      context.fillStyle = fillStyle;
      context.fill();
      context.strokeStyle = strokeStyle;
      context.lineWidth = lineWidth;
      context.stroke();
      context.fillStyle = fontColor;
      context.font = `${fontSize}px sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle'; 
      context.fillText(label.text, label.x, label.y);
      context.restore();
    });
  },

  // 触摸开始事件
  touchStart(e) {
    if (!this.data.context || !this.data.canvas) {
      if (this.isDrawingQuestion()) { this.initCanvas(); }
      return;
    }
    if (this.data.isSubmitted) {
      return;
    }
    
    if (!this.isDrawingQuestion()) return;

    const currentQuestion = this.data.questionnaire.questions[this.data.currentQuestionIndex];
    const touch = e.touches[0];

    // 移除标签拖拽相关逻辑，确保连线题标签保持固定
    
    const currentPath = {
      points: [{x: touch.x, y: touch.y}],
      color: this.data.currentColor,
      lineWidth: this.data.currentLineWidth
    };

    this.setData({
      isDrawing: true,
      lastX: touch.x,
      lastY: touch.y,
      currentPath: currentPath
    });
  },

  // 触摸移动事件
  touchMove(e) {
    if (this.data.isSubmitted) {
      return;
    }
    
    if (!this.isDrawingQuestion()) return;

    // 移除标签拖拽相关逻辑，确保连线题标签保持固定

    if (!this.data.isDrawing) return;

    const touch = e.touches[0];
    const context = this.data.context; // 统一使用context变量名
    const canvas = this.data.canvas;
    if (!context || !canvas) {
      if (this.isDrawingQuestion()) { this.initCanvas(); }
      return;
    }
    const currentPath = this.data.currentPath;

    context.beginPath();
    context.moveTo(this.data.lastX, this.data.lastY);
    context.lineTo(touch.x, touch.y);
    context.strokeStyle = currentPath.color;
    context.lineWidth = currentPath.lineWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();

    currentPath.points.push({x: touch.x, y: touch.y});

    this.setData({
      lastX: touch.x,
      lastY: touch.y,
      currentPath: currentPath
    });
  },

  // 触摸结束事件
  touchEnd() {
    if (this.data.isDragging) {
      this.setData({
        isDragging: false,
        draggingLabel: null
      });
      // 拖拽结束后保存（仅 connect 有意义）
      this.saveDrawingData();
      return;
    }

    if (!this.isDrawingQuestion() || !this.data.isDrawing) return;

    const currentPath = this.data.currentPath;
    const history = [...this.data.history, {
      type: 'addPath',
      data: currentPath
    }];

    this.setData({
      isDrawing: false,
      paths: [...this.data.paths, currentPath],
      history: history,
      currentPath: null
    });

    this.saveDrawingData();
  },

  // 保存绘图数据 — 正确保存连线题的标签和路径数据
  saveDrawingData(options = {}) {
    return new Promise((resolve) => {
      const { questionnaire, currentQuestionIndex, canvas, paths, labels } = this.data;
      if (!questionnaire || !questionnaire.questions) {
        resolve();
        return;
      }
      const currentQuestion = questionnaire.questions[currentQuestionIndex];

      // 保存当前画布上的标签和路径数据
      const labelsToSave = currentQuestion.subType === 'connect' ? (Array.isArray(labels) ? labels.map(label => ({...label})) : []) : [];

      // 统一构建要写回的问题对象：始终保存 paths（关键）、需要的 labels 和 history（撤销历史）
      const baseUpdated = {
        ...questionnaire.questions[currentQuestionIndex],
        paths: Array.isArray(paths) ? paths.slice() : [],
        labels: labelsToSave,
        history: Array.isArray(this.data.history) ? this.data.history.slice() : []
      };

      // 快速路径：对于导航模式，只保存矢量数据，跳过耗时的图像转换
      if (options.mode === 'nav') {
        try {
          const questions = [...questionnaire.questions];
          questions[currentQuestionIndex] = baseUpdated;
          this.setData({ questionnaire: { ...this.data.questionnaire, questions } }, () => resolve());
        } catch (e) {
          resolve();
        }
        return;
      }

      // 非导航模式下才进行完整的图像保存
      // 优先使用小程序 2D Canvas 的 toTempFilePath（最兼容）
      if (canvas && typeof canvas.toTempFilePath === 'function') {
        try {
          canvas.toTempFilePath({
            fileType: 'png',
            success: (res) => {
              const updatedQuestion = { ...baseUpdated, drawingData: res.tempFilePath };
              const questions = [...questionnaire.questions];
              questions[currentQuestionIndex] = updatedQuestion;
              this.setData({ questionnaire: { ...this.data.questionnaire, questions } }, () => resolve());
            },
            fail: () => {
              const questions = [...questionnaire.questions];
              questions[currentQuestionIndex] = baseUpdated;
              this.setData({ questionnaire: { ...this.data.questionnaire, questions } }, () => resolve());
            }
          });
          return;
        } catch (err) {
          // fallthrough to other strategies
        }
      }

      // 其次尝试 toDataURL（某些环境支持）
      if (canvas && typeof canvas.toDataURL === 'function') {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const updatedQuestion = { ...baseUpdated, drawingData: dataUrl };
          const questions = [...questionnaire.questions];
          questions[currentQuestionIndex] = updatedQuestion;
          this.setData({ questionnaire: { ...this.data.questionnaire, questions } }, () => resolve());
          return;
        } catch (err) {
          // ignore
        }
      }

      // 最后：存矢量 paths（无图片也能复原绘制）
      try {
        const questions = [...questionnaire.questions];
        questions[currentQuestionIndex] = baseUpdated;
        this.setData({ questionnaire: { ...this.data.questionnaire, questions } }, () => resolve());
      } catch (e) {
        resolve();
      }
    });
  }
,

  // 选择颜色
  selectColor(e) {
    this.setData({
      currentColor: e.currentTarget.dataset.color
    });
  },

  // 选择线宽
  selectLineWidth(e) {
    this.setData({
      currentLineWidth: parseInt(e.currentTarget.dataset.width)
    });
  },

  // 清空画布
  clearCanvas() {
    if (this.data.isSubmitted) {
      wx.showToast({
        title: '问卷已提交，无法修改',
        icon: 'none'
      });
      return;
    }
    
    const { context, canvas, canvasScale } = this.data;
    if (!context || !canvas) return;
    
    const currentQuestion = this.data.questionnaire.questions[this.data.currentQuestionIndex];
    const isConnectionQuestion = currentQuestion?.subType === 'connect';
    
    context.clearRect(0, 0, canvas.width / canvasScale, canvas.height / canvasScale);
  
    const history = [...this.data.history, {
      type: 'clear',
      data: {
        paths: [...this.data.paths],
        labels: isConnectionQuestion ? (Array.isArray(this.data.labels) ? this.data.labels.map(l => ({...l})) : []) : []
      }
    }];
  
    const newData = {
      paths: [],
      history: history
    };
    
    if (!isConnectionQuestion) { newData.labels = []; } else { newData.labels = Array.isArray(this.data.labels) ? this.data.labels.map(l => ({...l})) : []; }
  
    this.setData(newData, () => {
      // 调用redrawCanvas统一处理绘制逻辑，确保标签和背景都被正确绘制
      this.redrawCanvas();
      // 保证清空后保存状态
      this.saveDrawingData();
    });
  },

  // 处理点击事件
  handleTap(e) {
    const currentQuestion = this.data.questionnaire.questions[this.data.currentQuestionIndex];
    if (currentQuestion.subType !== 'connect') return;

    const { x, y } = e.detail;
    const currentTime = Date.now();
    const lastTapTime = this.data.lastTapTime || 0;
    const lastTapX = this.data.lastTapX || 0;
    const lastTapY = this.data.lastTapY || 0;

    if (currentTime - lastTapTime < 300 &&
        Math.abs(x - lastTapX) < 20 &&
        Math.abs(y - lastTapY) < 20) {
      this.handleDoubleTap(x, y);
      this.setData({
        lastTapTime: 0
      });
    } else {
      this.setData({
        lastTapTime: currentTime,
        lastTapX: x,
        lastTapY: y
      });
    }
  },

  // 处理双击事件
  // 禁用双击创建标签功能，确保连线题标签保持固定
  handleDoubleTap(x, y) {
    return;
  },

  // 撤销操作
  undo() {
    if (this.data.isSubmitted) {
      wx.showToast({
        title: '问卷已提交，无法修改',
        icon: 'none'
      });
      return;
    }
    
    const history = this.data.history;
    if (history.length === 0) return;
  
    const newHistory = [...history];
    const lastAction = newHistory.pop();
  
    switch (lastAction.type) {
      case 'addPath':
        this.setData({
          paths: this.data.paths.slice(0, -1),
          history: newHistory
        }, () => {
          this.redrawCanvas();
          this.saveDrawingData();
        });
        break;
      case 'clear':
        this.setData({
          paths: lastAction.data.paths,
          labels: lastAction.data.labels || [],
          history: newHistory
        }, () => {
          this.redrawCanvas();
          this.saveDrawingData();
        });
        break;
    }
  },

  // 重绘画布
  redrawCanvas() {
    const { context, canvas, paths, labels, canvasScale, questionnaire, currentQuestionIndex } = this.data;
    if (!context || !canvas) return;
    // 归一化变换（仅按 DPR 等比缩放），避免圆被拉伸
    const __scale = this.data.canvasScale || 1;
    if (typeof context.resetTransform === 'function') {
      context.resetTransform();
      context.scale(__scale, __scale);
    } else if (typeof context.setTransform === 'function') {
      context.setTransform(__scale, 0, 0, __scale, 0, 0);
    }
    context.clearRect(0, 0, canvas.width / canvasScale, canvas.height / canvasScale);
    context.beginPath();

    paths.forEach(path => {
      context.beginPath();
      context.moveTo(path.points[0].x, path.points[0].y);

      for (let i = 1; i < path.points.length; i++) {
        context.lineTo(path.points[i].x, path.points[i].y);
      }

      context.strokeStyle = path.color;
      context.lineWidth = path.lineWidth;
      context.lineCap='round';
      context.lineJoin= 'round';
      context.stroke();
    });

    const currentQuestion = questionnaire?.questions?.[currentQuestionIndex];
    if (currentQuestion?.subType === 'connect') {
      this.drawLabels();
    }
  },

  // 上一题 - 增强健壮性版
  prevQuestion() {
    try {
      // 安全检查：确保导航保存状态有效
      const isNavSaving = typeof this.data.__navSaving === 'boolean' ? this.data.__navSaving : false;
      
      // 先保存当前题（若是画图题），再跳转，避免丢失画布
      if (!isNavSaving && typeof this.isDrawingQuestion === 'function' && this.isDrawingQuestion()) {
        console.log('检测到画图题，开始保存画布数据...');
        this.setData({ __navSaving: true });
        
        // 安全调用saveDrawingData并添加错误处理
        if (typeof this.saveDrawingData === 'function') {
          this.saveDrawingData({ mode: 'nav' })
            .then(() => {
              // 不通过递归，而是直接执行切换逻辑
              this.setData({ __navSaving: false }, () => {
                console.log('画布数据保存成功，开始切换到上一题');
                if (typeof this._doPrevQuestion === 'function') {
                  this._doPrevQuestion();
                }
              });
            })
            .catch(error => {
              console.error('保存画布数据失败:', error);
              this.setData({ __navSaving: false });
              wx.showToast({ title: '保存失败，请重试', icon: 'none' });
            });
        } else {
          console.error('saveDrawingData方法不存在');
          this.setData({ __navSaving: false });
          wx.showToast({ title: '保存功能异常', icon: 'none' });
        }
        return;
      }

      console.log('非画图题或导航保存中，直接切换到上一题');
      if (typeof this._doPrevQuestion === 'function') {
        this._doPrevQuestion();
      }
    } catch (error) {
      console.error('上一题操作发生错误:', error);
      // 确保出错时重置导航保存状态
      try {
        this.setData({ __navSaving: false });
      } catch (e) {}
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  // 实际执行上一题的逻辑，抽取出来避免递归 - 增强健壮性版
  _doPrevQuestion() {
    try {
      const { questionnaire, currentQuestionIndex } = this.data;
      
      // 安全检查：确保问卷数据和问题数组存在
      if (!questionnaire || !Array.isArray(questionnaire.questions)) {
        console.error('问卷数据不完整，无法切换题目');
        wx.showToast({ title: '问卷数据异常', icon: 'none' });
        return;
      }
      
      // 确保当前问题索引有效
      const safeCurrentIndex = Math.max(0, Math.min(currentQuestionIndex || 0, questionnaire.questions.length - 1));
      
      if (safeCurrentIndex > 0) {
        const newIndex = safeCurrentIndex - 1;
        
        // 安全获取上一题数据
        const prevQuestion = questionnaire.questions[newIndex] || {};
        const selectedOption = prevQuestion.selectedOption || null;
        let selectedOptions = prevQuestion.selectedOptions || [];
        
        // 确保selectedOptions是数组
        if (prevQuestion.type === 'multiple' && !Array.isArray(selectedOptions)) {
          selectedOptions = [];
        }

        this.setData({ currentQuestionIndex: newIndex, selectedOption: selectedOption, selectedOptions: selectedOptions }, () => {
          console.log('切换到上一题成功，新索引:', newIndex);
          if (typeof this.refreshSelectedOptionsMap === 'function') {
            try {
              this.refreshSelectedOptionsMap();
            } catch (e) {
              console.error('刷新选项映射失败:', e);
            }
          }
          if (this.isDrawingQuestion()) {
            try {
              this.initCanvas();
            } catch (e) {
              console.error('初始化画布失败:', e);
            }
          }
          const currentQ = this.data.questionnaire?.questions?.[this.data.currentQuestionIndex];
          if (currentQ && currentQ.type === 'matrix') {
            try {
              this.initMatrixScrollSync();
            } catch (e) {
              console.error('初始化矩阵题滚动同步失败:', e);
            }
          }
        });
      } else {
        wx.showToast({
          title: '已经是第一题',
          icon: 'none',
          duration: 800
        });
      }
    } catch (error) {
      console.error('切换到上一题时发生错误:', error);
      wx.showToast({ title: '切换题目失败', icon: 'none' });
    }
  },

  // 下一题
  
  // 构建选项映射的辅助方法 - 增强版
  buildSelectedOptionsMap(arr) {
    const map = {};
    if (Array.isArray(arr)) {
      for (let i = 0; i < arr.length; i++) {
        const idx = arr[i];
        if (typeof idx === 'number') map[idx] = true;
      }
    }
    return map;
  },
  
  // 刷新选项映射 - 增强健壮性版
  refreshSelectedOptionsMap() {
    try {
      // 增强的问卷数据完整性检查
      const questionnaire = this.data.questionnaire;
      let selectedOptionsMap = {};
      let arr = [];
      
      console.log('开始刷新选项映射，当前问卷数据状态:', {
        hasQuestionnaire: !!questionnaire,
        hasQuestions: questionnaire && Array.isArray(questionnaire.questions),
        questionCount: questionnaire && Array.isArray(questionnaire.questions) ? questionnaire.questions.length : 0
      });
      
      // 即使问卷数据不完整，也尝试构建默认的选项映射
      if (!questionnaire || !Array.isArray(questionnaire.questions)) {
        console.warn('问卷数据不完整，使用空选项映射');
        // 仍然尝试从页面数据中获取选项信息
        if (Array.isArray(this.data.selectedOptions)) {
          arr = this.data.selectedOptions;
          selectedOptionsMap = this.buildSelectedOptionsMap(arr);
        }
        this.setData({ selectedOptionsMap: selectedOptionsMap, selectedOptions: arr });
        return;
      }
      
      // 首先检查问卷问题数量
      const questionCount = questionnaire.questions?.length || 0;
      
      // 如果没有问题，直接设置默认值并返回
      if (questionCount === 0) {
        console.log('问卷没有问题，使用空选项映射');
        this.setData({ 
          selectedOptionsMap: {}, 
          selectedOptions: [],
          currentQuestionIndex: -1 
        });
        return;
      }
      
      // 获取当前问题索引，确保有效
      let currentQuestionIndex = this.data.currentQuestionIndex || 0;
      
      // 如果当前索引为-1（表示没有问题），设置为0
      if (currentQuestionIndex === -1) {
        currentQuestionIndex = 0;
        this.setData({ currentQuestionIndex: 0 }, () => {
          // 递归调用以使用正确的索引
          this.refreshSelectedOptionsMap();
        });
        return;
      }
      
      // 确保当前问题索引在有效范围内
      currentQuestionIndex = Math.max(0, Math.min(currentQuestionIndex, questionCount - 1));
      
      // 获取当前问题
      let q = questionnaire.questions[currentQuestionIndex];
      
      // 即使问题不存在，也要设置默认值
      if (!q) {
        console.warn('当前问题不存在，使用空选项映射');
        this.setData({ selectedOptionsMap: {}, selectedOptions: [] });
        return;
      }
      
      // 确保问题有选项数组（如果需要）
      if ((q.type === 'single' || q.type === 'multiple') && (!Array.isArray(q.options) || q.options.length === 0)) {
        // 增强版：先检查是否正在从API加载数据
        if (this.data.loading) {
          console.log('正在从API加载数据，暂时不添加默认选项', q.type, q.title || '未知标题');
        } else {
          console.warn('问题选项为空或不是数组，添加默认选项', q.type, q.title || '未知标题');
          // 创建问卷副本以避免直接修改原数据
          const updatedQuestionnaire = JSON.parse(JSON.stringify(questionnaire));
          if (!Array.isArray(updatedQuestionnaire.questions[currentQuestionIndex].options)) {
            updatedQuestionnaire.questions[currentQuestionIndex].options = [];
          }
          // 如果选项数组为空，添加默认选项
          if (updatedQuestionnaire.questions[currentQuestionIndex].options.length === 0) {
            updatedQuestionnaire.questions[currentQuestionIndex].options = [
              { id: `option_${currentQuestionIndex}_0`, content: '选项A' },
              { id: `option_${currentQuestionIndex}_1`, content: '选项B' },
              { id: `option_${currentQuestionIndex}_2`, content: '选项C' },
              { id: `option_${currentQuestionIndex}_3`, content: '选项D' }
            ];
          }
          this.setData({ questionnaire: updatedQuestionnaire });
          // 重新获取更新后的问题数据
          q = this.data.questionnaire.questions[currentQuestionIndex];
        }
      }
      
      // 多源数据获取策略，确保选项数据可靠
      // 增强版：优先使用API返回的实际选项数据
      // 策略1: 从问题数据中获取已选中的选项
      if (q.type === 'single' && q.selectedOption !== undefined && q.selectedOption !== null) {
        arr = [q.selectedOption];
        console.log('使用问题中的selectedOption数据');
      } else if (q.type === 'multiple' && Array.isArray(q.selectedOptions)) {
        arr = q.selectedOptions;
        console.log('使用问题中的selectedOptions数据');
      }
      // 策略2: 从页面数据中获取
      else if (Array.isArray(this.data.selectedOptions)) {
        arr = this.data.selectedOptions;
      }
      // 策略3: 当单选/多选题没有选中选项时，创建默认选中状态
      else if ((q.type === 'single' || q.type === 'multiple') && q.options && q.options.length > 0) {
        arr = [];
      }
      // 策略4: 设置为空数组
      else {
        arr = [];
      }
      
      // 安全检查：确保arr是数组
      if (!Array.isArray(arr)) {
        console.warn('选项数据类型错误，重置为空数组');
        arr = [];
      }
      
      console.log('构建选项映射:', {
        currentQuestionIndex,
        questionType: q.type,
        questionTitle: q.title || '无标题',
        optionsCount: arr.length,
        options: arr,
        totalOptionsAvailable: q.options ? q.options.length : 0
      });
      
      // 构建选项映射
      selectedOptionsMap = this.buildSelectedOptionsMap(arr);
      
      // 确保同时更新selectedOptions和selectedOptionsMap
      this.setData({
        selectedOptions: arr,
        selectedOptionsMap: selectedOptionsMap,
        // 同时确保当前问题索引正确
        currentQuestionIndex: currentQuestionIndex
      });
    } catch (e) {
      console.error('刷新选项映射失败:', e);
      // 确保出错时也有默认值，防止页面崩溃
      this.setData({
        selectedOptions: [],
        selectedOptionsMap: {}
      });
    }
  },
  // 下一题 - 增强健壮性版
  nextQuestion() {
    try {
      // 安全检查：确保导航保存状态有效
      const isNavSaving = typeof this.data.__navSaving === 'boolean' ? this.data.__navSaving : false;
      
      // 先保存当前题（若是画图题），再跳转，避免丢失画布
      if (!isNavSaving && typeof this.isDrawingQuestion === 'function' && this.isDrawingQuestion()) {
        console.log('检测到画图题，开始保存画布数据...');
        this.setData({ __navSaving: true });
        
        // 安全调用saveDrawingData并添加错误处理
        if (typeof this.saveDrawingData === 'function') {
          this.saveDrawingData({ mode: 'nav' })
            .then(() => {
              // 不通过递归，而是直接执行切换逻辑
              this.setData({ __navSaving: false }, () => {
                console.log('画布数据保存成功，开始切换到下一题');
                if (typeof this._doNextQuestion === 'function') {
                  this._doNextQuestion();
                }
              });
            })
            .catch(error => {
              console.error('保存画布数据失败:', error);
              this.setData({ __navSaving: false });
              wx.showToast({ title: '保存失败，请重试', icon: 'none' });
            });
        } else {
          console.error('saveDrawingData方法不存在');
          this.setData({ __navSaving: false });
          wx.showToast({ title: '保存功能异常', icon: 'none' });
        }
        return;
      }

      console.log('非画图题或导航保存中，直接切换到下一题');
      if (typeof this._doNextQuestion === 'function') {
        this._doNextQuestion();
      }
    } catch (error) {
      console.error('下一题操作发生错误:', error);
      // 确保出错时重置导航保存状态
      try {
        this.setData({ __navSaving: false });
      } catch (e) {}
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  // 实际执行下一题的逻辑，抽取出来避免递归 - 增强健壮性版
  _doNextQuestion() {
    try {
      const { questionnaire, currentQuestionIndex } = this.data;
      
      // 安全检查：确保问卷数据和问题数组存在
      if (!questionnaire || !Array.isArray(questionnaire.questions)) {
        console.error('问卷数据不完整，无法切换题目');
        wx.showToast({ title: '问卷数据异常', icon: 'none' });
        return;
      }
      
      // 确保当前问题索引有效
      const safeCurrentIndex = Math.max(0, Math.min(currentQuestionIndex || 0, questionnaire.questions.length - 1));
      
      if (safeCurrentIndex < questionnaire.questions.length - 1) {
        const newIndex = safeCurrentIndex + 1;
        
        // 安全获取下一题数据
        const nextQuestion = questionnaire.questions[newIndex] || {};
        const selectedOption = nextQuestion.selectedOption || null;
        let selectedOptions = nextQuestion.selectedOptions || [];
        
        // 确保selectedOptions是数组
        if (nextQuestion.type === 'multiple' && !Array.isArray(selectedOptions)) {
          selectedOptions = [];
        }

        this.setData({ currentQuestionIndex: newIndex, selectedOption: selectedOption, selectedOptions: selectedOptions }, () => {
          console.log('切换到下一题成功，新索引:', newIndex);
          if (typeof this.refreshSelectedOptionsMap === 'function') {
            try {
              this.refreshSelectedOptionsMap();
            } catch (e) {
              console.error('刷新选项映射失败:', e);
            }
          }
          if (this.isDrawingQuestion()) {
            try {
              this.initCanvas();
            } catch (e) {
              console.error('初始化画布失败:', e);
            }
          }
          const currentQ = this.data.questionnaire?.questions?.[this.data.currentQuestionIndex];
          if (currentQ && currentQ.type === 'matrix') {
            try {
              this.initMatrixScrollSync();
            } catch (e) {
              console.error('初始化矩阵题滚动同步失败:', e);
            }
          }
        });
      } else {
        wx.showToast({
          title: '已经是最后一题',
          icon: 'none',
          duration: 800
        });
      }
    } catch (error) {
      console.error('切换到下一题时发生错误:', error);
      wx.showToast({ title: '切换题目失败', icon: 'none' });
    }
  },

  finishPreview() {
    wx.navigateBack();
  },

  // 显示题目选择器
  showQuestionSelector() {
    try {
      this.setData({
        showQuestionSelector: true
      });
    } catch (error) {
      console.error('显示题目选择器失败:', error);
    }
  },

  // 隐藏题目选择器
  hideQuestionSelector() {
    try {
      this.setData({
        showQuestionSelector: false
      });
    } catch (error) {
      console.error('隐藏题目选择器失败:', error);
    }
  },

  // 选择题目 - 增强健壮性版
  selectQuestion(e) {
    try {
      // 安全获取索引
      const index = e?.currentTarget?.dataset?.index;
      if (typeof index !== 'number' || index < 0) {
        console.error('无效的题目索引:', index);
        wx.showToast({ title: '选择题目失败', icon: 'none' });
        return;
      }
      
      const { questionnaire } = this.data;
      
      // 安全检查：确保问卷数据和问题数组存在
      if (!questionnaire || !Array.isArray(questionnaire.questions)) {
        console.error('问卷数据不完整，无法选择题目');
        wx.showToast({ title: '问卷数据异常', icon: 'none' });
        return;
      }
      
      // 确保索引在有效范围内
      const safeIndex = Math.max(0, Math.min(index, questionnaire.questions.length - 1));
      
      // 安全获取题目数据
      const currentQuestion = questionnaire.questions[safeIndex] || {};
      const selectedOption = currentQuestion.selectedOption || null;
      let selectedOptions = currentQuestion.selectedOptions || [];
      
      // 确保selectedOptions是数组
      if (currentQuestion.type === 'multiple' && !Array.isArray(selectedOptions)) {
        selectedOptions = [];
      }

      this.setData({
        currentQuestionIndex: safeIndex,
        showQuestionSelector: false,
        selectedOption: selectedOption,
        selectedOptions: selectedOptions
      }, () => {
        console.log('选择题目成功，索引:', safeIndex);
        if (typeof this.refreshSelectedOptionsMap === 'function') {
          try {
            this.refreshSelectedOptionsMap();
          } catch (e) {
            console.error('刷新选项映射失败:', e);
          }
        }
        if (this.isDrawingQuestion()) {
          try {
            this.initCanvas();
          } catch (e) {
            console.error('初始化画布失败:', e);
          }
        }
      });
    } catch (error) {
      console.error('选择题目时发生错误:', error);
      wx.showToast({ title: '选择题目失败', icon: 'none' });
    }
  },

  // 编辑当前题目
  editCurrentQuestion() {
    const { questionnaire, currentQuestionIndex } = this.data;
    wx.navigateTo({
      url: `/pages/admin/questionnaire/create/create?id=${questionnaire.id}&questionIndex=${currentQuestionIndex}`
    });
  },

  // 保存答案
  saveAnswer() {
    if (this.data.isSubmitted) {
      wx.showToast({
        title: '问卷已提交，无法保存',
        icon: 'none'
      });
      return;
    }
    
    // 在保存问卷之前，确保所有类型题目的答案已同步
    this.syncAllAnswers();
    
    // 在保存问卷之前，先把当前画布内容写回 questionnaire（若当前是画图题）
    const doSave = () => {
       const { questionnaire } = this.data;
       if (!questionnaire || !questionnaire.id) {
         wx.showToast({
           title: '问卷数据缺失，无法保存',
           icon: 'none'
         });
         return;
       }

       const answered = this.deepClone(questionnaire);
       answered.status = '未提交';
       answered.finishedAt = new Date().toLocaleString();

       // 直接保存回答的数据，不需要合并master
       const userInfo = wx.getStorageSync('userInfo') || {};
             answered.userId = userInfo.id;
             answered.userNickname = userInfo.nickname;
             answered.userEmail = userInfo.email;
            // 每用户桶：以问卷ID为键（覆盖/保存本用户自己的未提交草稿）
            const myList = this.loadMyFinishedList();
            const myIdx = myList.findIndex(q => q && (q.id === answered.id || q.id == answered.id));
            if (myIdx > -1) { myList[myIdx] = answered; } else { myList.push(answered); }
            this.saveMyFinishedList(myList);
            // 全局桶：使用复合ID避免覆盖他人作答
            const finishedQuestionnaires = wx.getStorageSync('finishedQuestionnaires') || [];
            const globalEntry = JSON.parse(JSON.stringify(answered));
            globalEntry.masterId = answered.id;
            globalEntry.id = `${answered.id}_${userInfo.id}`;
            const gIdx = finishedQuestionnaires.findIndex(q => q && q.id === globalEntry.id);
            if (gIdx > -1) { finishedQuestionnaires[gIdx] = globalEntry; } else { finishedQuestionnaires.push(globalEntry); }
wx.setStorageSync('finishedQuestionnaires', finishedQuestionnaires);
             this.saveMyFinishedList(myList);

       try {
         const toPreview = Object.assign({}, answered, { _previewFromFinish: true });
         wx.setStorageSync('previewQuestionnaire', toPreview);
       } catch (e) {
         console.warn('previewQuestionnaire set fail', e);
       }

       wx.showToast({
         title: '答案已保存',
         icon: 'success',
         duration: 1500
       });
     };

    if (this.isDrawingQuestion()) {
      // 确保画布数据先保存到 state，再持久化到 storage
      this.saveDrawingData({ mode: 'nav' }).then(() => {
        doSave();
      });
    } else {
      doSave();
    }
  },

  // 同步所有类型题目的答案
  syncAllAnswers() {
    if (this.data.isSubmitted) {
      return;
    }
    
    // 同步当前问答题的答案
    this.syncTextAnswer();
    
    // 确保单选题和多选题的答案被正确同步
    const { questionnaire, currentQuestionIndex } = this.data;
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    
    if (currentQuestion.type === 'single' && this.data.selectedOption !== undefined) {
      // 确保单选题答案同步
      this.setData({
        [`questionnaire.questions[${currentQuestionIndex}].selectedOption`]: this.data.selectedOption
      });
    } else if (currentQuestion.type === 'multiple' && Array.isArray(this.data.selectedOptions)) {
      // 确保多选题答案同步
      this.setData({
        [`questionnaire.questions[${currentQuestionIndex}].selectedOptions`]: this.data.selectedOptions
      });
    }
    
    // 对于其他类型的题目，确保数据已更新
    // 矩阵题（勾选题）的答案已通过toggleMatrixCell更新到问卷数据中，这里确保数据被正确保留
    this.setData({
      questionnaire: { ...this.data.questionnaire }
    });
  },

  // 提交问卷
  submitQuestionnaire() {
    if (this.data.isSubmitted) {
      wx.showToast({
        title: '问卷已提交，无需重复提交',
        icon: 'none'
      });
      return;
    }
    
    // 在提交问卷之前，确保所有类型题目的答案已同步
    this.syncAllAnswers();
    
    const { currentQuestionIndex, questionnaire } = this.data;
    if (currentQuestionIndex < questionnaire.questions.length - 1) {
      wx.showToast({
        title: '请继续答题',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    wx.showModal({
      title: '提交确认',
      content: '确定要提交问卷吗？提交后将无法修改。',
      success: (res) => {
        if (res.confirm) {
          const proceedSubmit = () => {
            const answered = this.deepClone(this.data.questionnaire);
            answered.status = '已提交';
            answered.finishedAt = new Date().toLocaleString();

            // 直接保存回答的数据，不需要合并master
            const userInfo = wx.getStorageSync('userInfo') || {};
            answered.userId = userInfo.id;
            answered.userNickname = userInfo.nickname;
            answered.userEmail = userInfo.email;
            // 每用户桶：以问卷ID为键（覆盖/保存本用户一次最终提交）
            const myList = this.loadMyFinishedList();
            const myIdx = myList.findIndex(q => q && (q.id === answered.id || q.id == answered.id));
            if (myIdx > -1) { myList[myIdx] = answered; } else { myList.push(answered); }
            this.saveMyFinishedList(myList);
            // 全局桶：使用复合ID避免覆盖他人作答
            const finishedQuestionnaires = wx.getStorageSync('finishedQuestionnaires') || [];
            const globalEntry = JSON.parse(JSON.stringify(answered));
            globalEntry.masterId = answered.id;
            globalEntry.id = `${answered.id}_${userInfo.id}`;
            const gIdx = finishedQuestionnaires.findIndex(q => q && q.id === globalEntry.id);
            if (gIdx > -1) { finishedQuestionnaires[gIdx] = globalEntry; } else { finishedQuestionnaires.push(globalEntry); }
wx.setStorageSync('finishedQuestionnaires', finishedQuestionnaires);
            this.saveMyFinishedList(myList);

            try {
              const toPreview = Object.assign({}, answered, { _previewFromFinish: true });
              wx.setStorageSync('previewQuestionnaire', toPreview);
            } catch (e) {
              console.warn('previewQuestionnaire set fail', e);
            }

            wx.showToast({
              title: '提交成功',
              icon: 'success',
              duration: 2000
            });
            setTimeout(() => {
              wx.navigateBack();
            }, 2000);
          };

          if (this.isDrawingQuestion()) {
            // 先把画布数据写回 state，再提交
            this.saveDrawingData({ mode: 'nav' }).then(() => {
              proceedSubmit();
            });
          } else {
            proceedSubmit();
          }
        }
      }
    });
  },

  // 同步问答题答案
  syncTextAnswer() {
    const { currentQuestionIndex, questionnaire } = this.data;
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    
    if (currentQuestion.type === 'text') {
      // 创建一个选择器获取textarea的值
      wx.createSelectorQuery()
        .select('.text-input')
        .fields({
          properties: ['value']
        })
        .exec((res) => {
          if (res && res[0] && res[0].value !== undefined) {
            const value = res[0].value;
            // 更新数据
            this.setData({
              [`questionnaire.questions[${currentQuestionIndex}].answer`]: value
            });
          }
        });
    }
  },

  // 切换矩阵题单元格
  toggleMatrixCell(e) {
    if (this.data.isSubmitted) {
      wx.showToast({
        title: '问卷已提交，无法修改',
        icon: 'none'
      });
      return;
    }
    
    const { rowIndex, colIndex } = e.currentTarget.dataset;
    const questionnaire = JSON.parse(JSON.stringify(this.data.questionnaire));
    questionnaire.questions[this.data.currentQuestionIndex].matrix.selectedCells[rowIndex][colIndex] = !questionnaire.questions[this.data.currentQuestionIndex].matrix.selectedCells[rowIndex][colIndex];
    this.setData({
      questionnaire: questionnaire
    });
  },

  // 问答题输入处理
  onTextAnswerInput(e) {
    if (this.data.isSubmitted) {
      return;
    }
    
    const value = e.detail.value;
    const currentQuestionIndex = this.data.currentQuestionIndex;
    this.setData({
      [`questionnaire.questions[${currentQuestionIndex}].answer`]: value
    });
  },

  // 填空题输入处理
  onBlankInput(e) {
    if (this.data.isSubmitted) {
      return;
    }
    
    const blankIndex = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const currentQuestionIndex = this.data.currentQuestionIndex;
    this.setData({
      [`questionnaire.questions[${currentQuestionIndex}].blanks[${blankIndex}]`]: value
    });
  },

  
});