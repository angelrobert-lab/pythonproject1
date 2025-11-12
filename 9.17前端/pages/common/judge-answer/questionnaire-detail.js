// pages/common/judge-answer/questionnaire-detail.js
Page({
  getOptionLetter(index) {
    return String.fromCharCode(65 + index);
  },

  data: {
    questionnaire: null,
    currentQuestionIndex: 0,
    loading: true,
    showQuestionSelector: false,
    letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    selectedOption: null,
    selectedOptions: [],
    judgeComplete: false,
    questionScore: '',
    lastValidScore: '', // 当前题目得分
    totalScore: 0, // 总得分
    // 计算得分弹窗相关状态
    showScoreCalculator: false,
    startQuestionIndex: 0,
    endQuestionIndex: 0,
    scoreSum: 0,
    submitted: false // 是否已提交问卷，用于控制得分是否可以修改
  },

  // 计算得分
  calculateScore() {
    if (!this.data.questionnaire || !this.data.questionnaire.questions) {
      return;
    }
    
    // 默认选择第一个题目到当前题目作为区间
    const defaultStart = 0;
    const defaultEnd = this.data.currentQuestionIndex;
    
    // 显示计算得分弹窗，但不计算得分
    this.setData({
      showScoreCalculator: true,
      startQuestionIndex: defaultStart,
      endQuestionIndex: defaultEnd,
      scoreSum: 0,
      hasCalculated: false  // 添加确定按钮状态标记
    });
  },
  
  // 点击确定按钮计算得分
  onCalculateConfirm() {
    const { startQuestionIndex, endQuestionIndex } = this.data;
    const scoreSum = this.calculateScoreSum(startQuestionIndex, endQuestionIndex);
    
    this.setData({
      scoreSum: scoreSum,
      hasCalculated: true  // 标记已点击确定
    });
  },
  
  // 阻止触摸移动事件冒泡，防止背景滚动
  preventTouchMove: function() {
    return;
  },
  
  // 计算指定区间内的得分总和
  calculateScoreSum(start, end) {
    if (!this.data.questionnaire || !this.data.questionnaire.questions) {
      return 0;
    }
    
    // 确保start <= end
    if (start > end) {
      [start, end] = [end, start];
    }
    
    let sum = 0;
    for (let i = start; i <= end; i++) {
      if (i >= 0 && i < this.data.questionnaire.questions.length) {
        const question = this.data.questionnaire.questions[i];
        // 获取题目得分，未填写则默认为0
        const score = question.score !== undefined && question.score !== null ? parseFloat(question.score) : 0;
        sum += isNaN(score) ? 0 : score;
      }
    }
    
    return sum;
  },
  
  // 更新起始题号（bindinput版本）
  onStartIndexInput(e) {
    const value = e.detail.value;
    // 确保输入是数字且不为空
    if (value === '') {
      return;
    }
    
    const start = parseInt(value);
    const { questionnaire } = this.data;
    const maxQuestions = questionnaire && questionnaire.questions ? questionnaire.questions.length : 0;
    
    // 限制输入范围：1 ~ maxQuestions
    if (start < 1 || start > maxQuestions) {
      wx.showToast({
        title: `请输入 1-${maxQuestions} 的题号`,
        icon: 'none'
      });
      // 自动清空当前输入
      this.setData({
        startQuestionIndex: 0,
        hasCalculated: false  // 重置确定状态
      });
      return;
    }
    
    // 转换为内部索引（减1）
    const startIndex = Math.max(0, start - 1);
    
    // 确保起始题号不大于结束题号
    const adjustedStart = Math.min(startIndex, this.data.endQuestionIndex);
    
    this.setData({
      startQuestionIndex: adjustedStart,
      hasCalculated: false  // 输入变化后需要重新确定
    });
  },
  
  // 更新结束题号（bindinput版本）
  onEndIndexInput(e) {
    const value = e.detail.value;
    // 确保输入是数字且不为空
    if (value === '') {
      return;
    }
    
    const end = parseInt(value);
    const { questionnaire, startQuestionIndex } = this.data;
    const maxQuestions = questionnaire && questionnaire.questions ? questionnaire.questions.length : 0;
    
    // 限制输入范围：不能大于当前问卷的题号
    if (end < 1 || end > maxQuestions) {
      wx.showToast({
        title: `请输入 1-${maxQuestions} 的题号`,
        icon: 'none'
      });
      // 自动清空当前输入
      this.setData({
        endQuestionIndex: 0,
        hasCalculated: false  // 重置确定状态
      });
      return;
    }
    
    // 转换为内部索引（减1）
    const endIndex = Math.max(0, end - 1);
    
    // 确保结束题号不小于起始题号
    const adjustedEnd = Math.max(endIndex, startQuestionIndex);
    
    this.setData({
      endQuestionIndex: adjustedEnd,
      hasCalculated: false  // 输入变化后需要重新确定
    });
  },
  
  // 以下是保留的旧方法，确保兼容性
  onStartIndexChange(e) {
    this.onStartIndexInput(e);
  },
  
  onEndIndexChange(e) {
    this.onEndIndexInput(e);
  },
  
  // 关闭计算得分弹窗
  closeScoreCalculator() {
    this.setData({
      showScoreCalculator: false,
      hasCalculated: false  // 重置状态
    });
  },

  // 保存得分范围
  saveScoreRange() {
    const { startQuestionIndex, endQuestionIndex, questionnaire, hasCalculated } = this.data;
    
    if (!hasCalculated) {
      wx.showToast({
        title: '请先点击确定',
        icon: 'none'
      });
      return;
    }
    
    if (!questionnaire || !questionnaire.questions) {
      wx.showToast({
        title: '问卷数据异常',
        icon: 'none'
      });
      return;
    }

    // 获取当前用户信息
    const userInfo = wx.getStorageSync('userInfo') || {};
    const userId = userInfo.email || userInfo.nickname || 'anonymous';
    // derive masterId and answerUserId from questionnaire.id or explicit fields
    const __rawId = String(questionnaire.id || '');
    const __masterId = questionnaire.masterId || (__rawId.includes('_') ? __rawId.split('_')[0] : __rawId);
    const __answerUserId = questionnaire.userId || (__rawId.includes('_') ? __rawId.split('_')[1] : '');
    const __finishedId = questionnaire.finishedId || __rawId;


    // 检查是否已经存在该区间
    try {
      const scoreStorage = wx.getStorageSync('questionnaireScores') || {};
      const scoreKey = `${userId}_${__masterId}_${__answerUserId}_${startQuestionIndex}_${endQuestionIndex}`;
      
      if (scoreStorage[scoreKey]) {
        wx.showToast({
          title: '已经存在该区间',
          icon: 'none'
        });
        return;
      }
    } catch (error) {
      console.error('检查区间失败:', error);
    }

    // 计算总分
    const scoreSum = this.calculateScoreSum(startQuestionIndex, endQuestionIndex);
    
    // 构建得分数据
    const scoreData = [];
    for (let i = startQuestionIndex; i <= endQuestionIndex; i++) {
      if (i >= 0 && i < questionnaire.questions.length) {
        const question = questionnaire.questions[i];
        scoreData.push({
            questionNumber: i,
            questionTitle: question.title || `第${i + 1}题`,
            score: question.score !== undefined && question.score !== null ? parseFloat(question.score) : 0,
            moduleIndex: question.moduleIndex !== undefined ? question.moduleIndex : -1
          });
      }
    }

    // 保存到本地存储
    try {
      const scoreStorage = wx.getStorageSync('questionnaireScores') || {};
      const scoreKey = `${userId}_${__masterId}_${__answerUserId}_${startQuestionIndex}_${endQuestionIndex}`;
      
      scoreStorage[scoreKey] = {
      questionnaireId: __masterId,
      finishedId: __finishedId,
      answerUserId: __answerUserId,
      answerUserEmail: questionnaire.userEmail || '',
      answerUserNickname: questionnaire.userNickname || '',

        questionnaireName: questionnaire.name,
        startQuestion: startQuestionIndex + 1, // 转换为1-based题号
        endQuestion: endQuestionIndex + 1,   // 转换为1-based题号
        scoreData: scoreData,
        totalScore: scoreSum,
        savedAt: new Date().toISOString(),
        userId: userId,
        judgedByNickname: userInfo.nickname || '',
        judgedByEmail: userInfo.email || ''
      };
      
      wx.setStorageSync('questionnaireScores', scoreStorage);
      
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
      
      // 发送事件通知得分页面更新数据
      const pages = getCurrentPages();
      const scorePage = pages.find(page => page.route === 'pages/common/score/score');
      if (scorePage && scorePage.loadAllScoreRecords) {
        // 如果得分页面已打开，直接调用其更新方法
        scorePage.loadAllScoreRecords(questionnaire.id);
      } else {
        // 使用事件总线通知
        const eventChannel = this.getOpenerEventChannel();
        if (eventChannel && eventChannel.emit) {
          eventChannel.emit('scoreUpdated', {
            questionnaireId: __masterId,
            answerUserId: __answerUserId
          });
        }
      }
      
      // 关闭弹窗
      this.setData({
        showScoreCalculator: false,
        hasCalculated: false  // 重置状态
      });
      
    } catch (error) {
      console.error('保存得分失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },
  
  // 输入得分
  onScoreInput(e) {
    let val = (e.detail && e.detail.value != null) ? String(e.detail.value) : '';
    const prev = this.data.lastValidScore || '';
    const idx = this.data.currentQuestionIndex;
    const updatePath = 'questionnaire.questions[' + idx + '].score';

    // 仅允许数字与一个小数点
    let filtered = val.replace(/[^\d.]/g, '');
    const firstDot = filtered.indexOf('.');
    if (firstDot !== -1) {
      filtered = filtered.slice(0, firstDot + 1) + filtered.slice(firstDot + 1).replace(/\./g, '');
    }
    if (filtered.startsWith('.')) {
      filtered = '0' + filtered;
    }

    if (filtered !== val) {
      if (val !== '') {
        wx.showToast({ title: '只能输入数字和小数点', icon: 'none' });
      }
      if (filtered === '') filtered = prev;
    }

    if (filtered !== '') {
      const num = Number(filtered);
      if (!isNaN(num)) {
        if (num > 100) {
          filtered = '100';
          wx.showToast({ title: '得分范围为 0-100', icon: 'none' });
        } else if (num < 0) {
          filtered = '0';
          wx.showToast({ title: '得分范围为 0-100', icon: 'none' });
        }
      }
    }

    this.setData({
      [updatePath]: filtered,
      questionScore: filtered,
      lastValidScore: filtered
    }, () => {
      // 当得分更改时，立即更新所有相关得分记录
      if (filtered !== prev && filtered !== '') {
        const scoreValue = parseFloat(filtered) || 0;
        this.updateQuestionScoresInRecords(idx, scoreValue);
        
        // 通知得分页面更新数据
        try {
          const pages = getCurrentPages();
          const scorePage = pages.find(page => page.route === 'pages/common/score/score');
          if (scorePage && typeof scorePage.loadAllScoreRecords === 'function') {
            scorePage.loadAllScoreRecords(this.data.questionnaire.id);
          }
        } catch (e) {
          console.error('同步更新得分详情页面失败:', e);
        }
      }
    });
  },
  
  // 深拷贝
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  },

  // 在答题页也用相同的合并策略：以 master 为蓝本，把 finished 的答案字段贴上去
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
        if (aQ.hasOwnProperty('selectedOption')) newQ.selectedOption = aQ.selectedOption;
        if (aQ.hasOwnProperty('selectedOptions')) newQ.selectedOptions = Array.isArray(aQ.selectedOptions) ? aQ.selectedOptions.slice() : [];
        if (aQ.hasOwnProperty('answer')) newQ.answer = aQ.answer;
        if (aQ.hasOwnProperty('blanks')) newQ.blanks = Array.isArray(aQ.blanks) ? aQ.blanks.slice() : aQ.blanks;
        if (aQ.hasOwnProperty('drawingData')) newQ.drawingData = aQ.drawingData;
        if (aQ.hasOwnProperty('labels')) newQ.labels = Array.isArray(aQ.labels) ? aQ.labels.slice() : aQ.labels;
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
        if (aQ.hasOwnProperty('hour') && !newQ.hasOwnProperty('hour')) newQ.hour = aQ.hour;
        if (aQ.hasOwnProperty('minute') && !newQ.hasOwnProperty('minute')) newQ.minute = aQ.minute;
        if (aQ.hasOwnProperty('timeRelation') && !newQ.hasOwnProperty('timeRelation')) newQ.timeRelation = aQ.timeRelation;
        if (aQ.hasOwnProperty('showOutline') && !newQ.hasOwnProperty('showOutline')) newQ.showOutline = aQ.showOutline;
        if (aQ.hasOwnProperty('showNumbers') && !newQ.hasOwnProperty('showNumbers')) newQ.showNumbers = aQ.showNumbers;
        if (aQ.hasOwnProperty('showHands') && !newQ.hasOwnProperty('showHands')) newQ.showHands = aQ.showHands;
      } else {
        if (newQ.type === 'multiple' && !Array.isArray(newQ.selectedOptions)) newQ.selectedOptions = [];
        if (newQ.type === 'blank' && !Array.isArray(newQ.blanks)) newQ.blanks = newQ.blanks || [];
      }
      return newQ;
    });

    // 保留状态/完成时间（若有）
    clonedMaster.status = ans.status || clonedMaster.status;
    clonedMaster.finishedAt = ans.finishedAt || clonedMaster.finishedAt;

    return clonedMaster;
  },

  onLoad(options) {
    // 同时支持id和fid参数
    const targetId = options.fid || options.id;
    const finishedQuestionnaires = wx.getStorageSync('finishedQuestionnaires') || [];
    // 先尝试通过fid或id精确匹配
    let questionnaire = finishedQuestionnaires.find(q => q && (
      q.id === targetId || 
      String(q.id) === String(targetId) ||
      q.finishedId === targetId ||
      String(q.finishedId) === String(targetId)
    ));
    
    // 如果没有精确匹配，尝试通过masterId匹配（处理复合ID情况）
    if (!questionnaire && targetId) {
      const questionnaires = wx.getStorageSync('questionnaires') || [];
      const masterQuestionnaire = questionnaires.find(q => q && (
        q.id === targetId || 
        String(q.id) === String(targetId)
      ));
      
      // 如果找到了master问卷，尝试找到对应的finished问卷
      if (masterQuestionnaire) {
        questionnaire = finishedQuestionnaires.find(q => q && (
          q.masterId === masterQuestionnaire.id ||
          String(q.masterId) === String(masterQuestionnaire.id)
        ));
      }
      
      // 如果还是没有找到，尝试解析复合ID格式 (问卷ID_用户ID)
      if (!questionnaire && typeof targetId === 'string' && targetId.includes('_')) {
        const parts = targetId.split('_');
        const masterId = parts[0];
        const userId = parts[1];
        
        // 尝试通过masterId和userId查找
        questionnaire = finishedQuestionnaires.find(q => q && (
          String(q.masterId) === masterId &&
          String(q.userId) === userId
        ));
        
        // 如果还没有找到，只通过masterId查找
        if (!questionnaire) {
          questionnaire = finishedQuestionnaires.find(q => q && (
            String(q.masterId) === masterId
          ));
        }
      }
    }

    // 如果没有在 finished 中找到，再检查 previewQuestionnaire
    if (!questionnaire) {
      let preview = wx.getStorageSync('previewQuestionnaire');
      if (preview && (preview.id == targetId || preview.id === targetId)) {
        // 但如果 preview 来自 finish（有标记），则可以使用；否则我们仍验证 finished 是否存在以防展示被删数据
        questionnaire = preview;
      }
    }

    // 最后尝试从 master questionnaires 中读取（用于用户直接打开 master 或 master 已更新但已删除 finished）
    if (!questionnaire) {
      const questionnaires = wx.getStorageSync('questionnaires') || [];
      const master = questionnaires.find(q => q && (q.id == targetId || q.id === targetId));
      if (master) {
        // master 存在但没有 finished 答案，直接使用 master（空答案）
        questionnaire = this.deepClone(master);
        // 初始化答案字段
        questionnaire.questions = (questionnaire.questions || []).map(q => {
          if (q.type === 'multiple' && !Array.isArray(q.selectedOptions)) q.selectedOptions = [];
          if (q.type === 'blank' && !Array.isArray(q.blanks)) q.blanks = q.blanks || [];
          // 初始化得分字段，如果不存在则设置为空字符串
          if (q.score === undefined) q.score = '';
          return q;
        });
      }
    }

    // 如果仍然没有找到问卷数据，显示错误提示
    if (!questionnaire) {
      setTimeout(() => {
        this.setData({
          loading: false,
          questionnaire: null
        });
        wx.showToast({
          title: '未找到预览数据或问卷已删除',
          icon: 'none',
          duration: 2000
        });
        // 3秒后返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      }, 500);
      return;
    }

    if (questionnaire) {
      questionnaire = JSON.parse(JSON.stringify(questionnaire));

      questionnaire.questions.forEach(question => {
        if (question.type === 'multiple' && !Array.isArray(question.selectedOptions)) {
          question.selectedOptions = [];
        }
        if (question.type === 'blank' && !Array.isArray(question.blanks)) {
          question.blanks = question.blanks || [];
        }
      });
      // 构建多选题的索引集合与字母数组，便于渲染高亮与文本展示
      if (Array.isArray(questionnaire.questions)) {
        
    // —— 兼容：若 normalizeMultipleSelection 未注入，使用本地函数避免报错 ——
    const __normalizeMultipleSelection = (this && typeof this.normalizeMultipleSelection === 'function')
      ? this.normalizeMultipleSelection.bind(this)
      : (q => {
          try {
            if (!q || q.type !== 'multiple') return q;
            const letters = this && this.data && this.data.letters ? this.data.letters : ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
            const arr = Array.isArray(q.selectedOptions) ? q.selectedOptions.slice() : [];
            const set = {}; const lettersArr = [];
            for (let i = 0; i < arr.length; i++) {
              const v = arr[i];
              if (typeof v === 'number') { set[v] = true; lettersArr.push(letters[v] || v); }
              else { const idx = letters.indexOf(v); if (idx !== -1) set[idx] = true; lettersArr.push(v); }
            }
            q._selectedIndexSet = set;
            q.selectedOptionsLetters = lettersArr;
          } catch (e) {}
          return q;
        });
questionnaire.questions = questionnaire.questions.map(q => __normalizeMultipleSelection(q));
      }


      const selectedOption = questionnaire.questions[0] ? questionnaire.questions[0].selectedOption || null : null;
      const selectedOptions = questionnaire.questions[0] ? questionnaire.questions[0].selectedOptions || [] : [];
      // 获取第一个题目的得分（如果有）
      const questionScore = questionnaire.questions[0] ? questionnaire.questions[0].score || '' : '';

      // 检查问卷是否已批阅，如果是则设置submitted为true
      const isAlreadyJudged = questionnaire.status === '已批阅';

      setTimeout(() => {
        this.setData({
          questionnaire: questionnaire,
          loading: false,
          selectedOption: selectedOption,
          selectedOptions: selectedOptions,
          questionScore: questionScore,
          submitted: isAlreadyJudged,
          judgeComplete: isAlreadyJudged
        }, () => {
          if (this.isDrawingQuestion()) {
            this.initCanvas();
          }
          if (this.data.questionnaire.questions[this.data.currentQuestionIndex] && this.data.questionnaire.questions[this.data.currentQuestionIndex].type === 'matrix') {
            this.initMatrixScrollSync();
          }
        });
      }, 200);
    } else {
      this.setData({ loading: false });
      wx.showToast({
        title: '未找到预览数据或问卷已被删除',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 保存批阅
  saveJudging() {
    const questionnaire = this.data.questionnaire;
    
    if (!questionnaire) return;

    // 保存当前状态但不修改状态为已批阅
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (questionnaire) {
      questionnaire.judgedByNickname = userInfo.nickname || questionnaire.judgedByNickname;
      questionnaire.judgedByEmail = userInfo.email || questionnaire.judgedByEmail;
    }
    const finishedQuestionnaires = wx.getStorageSync('finishedQuestionnaires') || [];
    const updatedFinished = finishedQuestionnaires.map(q => {
      if (q.id === questionnaire.id) {
        return this.deepClone(questionnaire);
      }
      return q;
    });

    wx.setStorageSync('finishedQuestionnaires', updatedFinished);

    // 同步保存所有题目的得分数据到得分存储
    this.saveAllQuestionScores();

    wx.showToast({
      title: '批阅已保存',
      icon: 'success'
    });
  
    // 通知得分页面刷新（若在栈中）或通过事件总线告知
    this.notifyScoreUpdate();
  },

  // 通知得分页面更新
  notifyScoreUpdate() {
    try {
      const questionnaire = this.data.questionnaire;
      if (!questionnaire) return;

      const pages = getCurrentPages();
      const scorePage = pages.find(page => page.route === 'pages/common/score/score');
      if (scorePage && typeof scorePage.loadAllScoreRecords === 'function') {
        scorePage.loadAllScoreRecords(questionnaire.id);
      } else {
        const evt = this.getOpenerEventChannel && this.getOpenerEventChannel();
        if (evt && evt.emit) {
          evt.emit('scoreUpdated', { questionnaireId: questionnaire.id });
        }
      }
      
      // 通过事件总线广播更新事件，确保所有相关页面都能收到
      try {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.scoreUpdated = {
            questionnaireId: questionnaire.id,
            timestamp: Date.now()
          };
        }
      } catch (e) {
        console.warn('设置全局数据失败:', e);
      }
    } catch (e) {
      console.error('同步更新得分详情存储失败:', e);
    }
  },

  // 保存所有题目的得分数据到得分存储
  saveAllQuestionScores() {
    const questionnaire = this.data.questionnaire;
    if (!questionnaire || !questionnaire.questions) return;

    // 获取当前用户信息
    const userInfo = wx.getStorageSync('userInfo') || {};
    const userId = userInfo.email || userInfo.nickname || 'anonymous';
    const __rawId3 = String(questionnaire.id || '');
    const __masterId3 = questionnaire.masterId || (__rawId3.includes('_') ? __rawId3.split('_')[0] : __rawId3);
    const __answerUserId3 = questionnaire.userId || (__rawId3.includes('_') ? __rawId3.split('_')[1] : '');

    const __rawId2 = String(questionnaire.id || '');
    const __masterId2 = questionnaire.masterId || (__rawId2.includes('_') ? __rawId2.split('_')[0] : __rawId2);
    const __answerUserId2 = questionnaire.userId || (__rawId2.includes('_') ? __rawId2.split('_')[1] : '');


    try {
      const scoreStorage = wx.getStorageSync('questionnaireScores') || {};
      const allKeys = Object.keys(scoreStorage);
      
      // 找出该用户该问卷的所有得分记录
      const questionnaireKeys = allKeys.filter(key => {
        const parts = key.split('_');
        return (parts.length >= 5 && String(parts[0]) === String(userId) && String(parts[1]) === String(__masterId2) && String(parts[2]) === String(__answerUserId2)) ||
               (parts.length >= 4 && String(parts[0]) === String(userId) && String(parts[1]) === String(__masterId2) && scoreStorage[key] && scoreStorage[key].answerUserId && String(scoreStorage[key].answerUserId) === String(__answerUserId2));
      });

      // 创建全范围的最新得分数据
      const fullRangeScoreData = [];
      let fullRangeTotalScore = 0;
      
      for (let i = 0; i < questionnaire.questions.length; i++) {
        const question = questionnaire.questions[i];
        const score = question.score !== undefined && question.score !== null ? parseFloat(question.score) : 0;
        const validScore = isNaN(score) ? 0 : score;
        
        fullRangeScoreData.push({
          questionNumber: i,
          questionTitle: question.title || `第${i + 1}题`,
          score: validScore,
          moduleIndex: question.moduleIndex !== undefined ? question.moduleIndex : -1
        });
        
        fullRangeTotalScore += validScore;
      }

      // 更新所有现有的得分记录
      questionnaireKeys.forEach(key => {
        const record = scoreStorage[key];
        if (record && Array.isArray(record.scoreData)) {
          const parts = key.split('_');
          const startIndex = parseInt(parts[parts.length - 2]) || 0;
          const endIndex = parseInt(parts[parts.length - 1]) || 0;
          
          // 更新该记录范围内的所有题目得分
          let newTotal = 0;
          const updatedScoreData = fullRangeScoreData
            .filter(item => item.questionNumber >= startIndex && item.questionNumber <= endIndex)
            .map(item => {
              newTotal += item.score;
              return {
                ...item,
                questionTitle: questionnaire.questions[item.questionNumber]?.title || item.questionTitle
              };
            });
          
          // 更新记录中的每个题目得分，并添加moduleIndex
          record.scoreData = updatedScoreData.map(item => ({
            ...item,
            moduleIndex: questionnaire.questions[item.questionNumber]?.moduleIndex !== undefined ? 
              questionnaire.questions[item.questionNumber].moduleIndex : -1
          }));
          record.totalScore = newTotal;
          record.savedAt = new Date().toISOString();
        }
      });

      // 同时确保全范围记录也存在
      const fullRangeKey = `${userId}_${__masterId2}_${__answerUserId2}_0_${questionnaire.questions.length - 1}`;
      scoreStorage[fullRangeKey] = {
        questionnaireId: __masterId2,
        answerUserId: __answerUserId2,

        questionnaireName: questionnaire.name,
        startQuestion: 1,
        endQuestion: questionnaire.questions.length,
        scoreData: fullRangeScoreData,
        totalScore: fullRangeTotalScore,
        savedAt: new Date().toISOString(),
        userId: userId,
        judgedByNickname: userInfo.nickname || '',
        judgedByEmail: userInfo.email || ''
      };
      
      wx.setStorageSync('questionnaireScores', scoreStorage);
    } catch (error) {
      console.error('保存得分数据失败:', error);
    }
  },

  // 更新指定题目的得分到所有相关得分记录
  updateQuestionScoresInRecords(questionIndex, newScore) {
    const questionnaire = this.data.questionnaire;
    if (!questionnaire || !questionnaire.questions) return;

    // 获取当前用户信息
    const userInfo = wx.getStorageSync('userInfo') || {};
    const userId = userInfo.email || userInfo.nickname || 'anonymous';

    // 定义问卷ID和答题用户ID
    const __rawId2 = String(questionnaire.id || '');
    const __masterId2 = questionnaire.masterId || (__rawId2.includes('_') ? __rawId2.split('_')[0] : __rawId2);
    const __answerUserId2 = questionnaire.userId || (__rawId2.includes('_') ? __rawId2.split('_')[1] : '');

    try {
      const scoreStorage = wx.getStorageSync('questionnaireScores') || {};
      const allKeys = Object.keys(scoreStorage);
      
      // 找出该用户该问卷的所有得分记录
      const questionnaireKeys = allKeys.filter(key => {
        const parts = key.split('_');
        return (parts.length >= 5 && String(parts[0]) === String(userId) && String(parts[1]) === String(__masterId2) && String(parts[2]) === String(__answerUserId2)) ||
               (parts.length >= 4 && String(parts[0]) === String(userId) && String(parts[1]) === String(__masterId2) && scoreStorage[key] && scoreStorage[key].answerUserId && String(scoreStorage[key].answerUserId) === String(__answerUserId2));
      });

      // 更新包含该题目的所有记录
      questionnaireKeys.forEach(key => {
        const record = scoreStorage[key];
        if (record && Array.isArray(record.scoreData)) {
          const parts = key.split('_');
          const startIndex = parseInt(parts[parts.length - 2]) || 0;
          const endIndex = parseInt(parts[parts.length - 1]) || 0;
          
          // 检查该题目是否在这个记录范围内
          if (questionIndex >= startIndex && questionIndex <= endIndex) {
            // 找到对应的题目并更新分数
            const questionData = record.scoreData.find(item => item.questionNumber === questionIndex);
            if (questionData) {
              questionData.score = newScore;
            }
            
            // 重新计算总分
            let newTotal = 0;
            record.scoreData.forEach(item => {
              newTotal += parseFloat(item.score) || 0;
            });
            record.totalScore = newTotal;
            record.savedAt = new Date().toISOString();
          }
        }
      });

      wx.setStorageSync('questionnaireScores', scoreStorage);
    } catch (error) {
      console.error('更新得分记录失败:', error);
    }
  },

  // 完成批阅
  completeJudging() {
    const questionnaire = this.data.questionnaire;
    
    if (!questionnaire) return;

    // 先保存完整的问卷数据（包括分数）
    this.saveJudging();

    // 更新问卷状态为已批阅
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (questionnaire) {
      questionnaire.judgedByNickname = userInfo.nickname || questionnaire.judgedByNickname;
      questionnaire.judgedByEmail = userInfo.email || questionnaire.judgedByEmail;
    }
    const finishedQuestionnaires = wx.getStorageSync('finishedQuestionnaires') || [];
    const updatedFinished = finishedQuestionnaires.map(q => {
      if (q.id === questionnaire.id) {
        return {
          ...q,
          status: '已批阅'
        };
      }
      return q;
    });

    wx.setStorageSync('finishedQuestionnaires', updatedFinished);

    this.setData({
      judgeComplete: true,
      submitted: true // 标记为已提交，禁止修改得分
    });

    wx.showToast({
      title: '批阅完成',
      icon: 'success'
    });

    // 延迟返回
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  
    // 通知得分页面刷新（若在栈中）或通过事件总线告知
    this.notifyScoreUpdate();
  },

  // 是否为画图题
  isDrawingQuestion() {
    const { questionnaire, currentQuestionIndex } = this.data;
    if (!questionnaire || !questionnaire.questions || !questionnaire.questions[currentQuestionIndex]) {
      return false;
    }
    return questionnaire.questions[currentQuestionIndex].type === 'draw';
  },

  // 初始化画布
  initCanvas() {
    const { currentQuestionIndex, questionnaire } = this.data;
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    
    if (!currentQuestion || currentQuestion.type !== 'draw') return;
    
    // 获取canvas实例
    const query = wx.createSelectorQuery();
    query.select('#drawCanvas')
      .fields({
        node: true,
        size: true
      })
      .exec((res) => {
        if (!res || !res[0]) return;
        
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        let dpr = 1;
        try {
          const win = wx.getWindowInfo ? wx.getWindowInfo() : null;
          dpr = (win && win.pixelRatio) ? win.pixelRatio : (wx.getSystemInfoSync ? wx.getSystemInfoSync().pixelRatio : 1);
        } catch (e) { try { dpr = wx.getSystemInfoSync ? (wx.getSystemInfoSync().pixelRatio || 1) : 1; } catch (_) { dpr = 1; } }
        
        // 设置canvas尺寸
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        
        
        if (canvas && canvas.style) { canvas.style.width = res[0].width + 'px'; canvas.style.height = res[0].height + 'px'; }
// 如果有drawingData，加载并显示用户的画图答案
        if (currentQuestion.drawingData) {
          const img = canvas.createImage();
          img.onload = () => {
            // 清空并绘制图片
            ctx.clearRect(0, 0, res[0].width, res[0].height);
            ctx.drawImage(img, 0, 0, res[0].width, res[0].height);
          };
          img.onerror = () => {
            console.error('Failed to load drawing data');
          };
          img.src = currentQuestion.drawingData;
        }
        
        // 对于连线题：如果没有 drawingData，才叠加标签，避免重影
        if (currentQuestion.subType === 'connect' && (!currentQuestion.drawingData) && Array.isArray(currentQuestion.labels) && currentQuestion.labels.length > 0) {
          setTimeout(() => {
            this.drawLabels(ctx, currentQuestion.labels, res[0].width, res[0].height);
          }, 0);
        }
        });
  },
  
  // 绘制标签
  drawLabels(ctx, labels, canvasWidth, canvasHeight) {
    try { if (typeof ctx.resetTransform === 'function') { const __dpr = (wx.getWindowInfo?wx.getWindowInfo().pixelRatio:(wx.getSystemInfoSync?wx.getSystemInfoSync().pixelRatio:1))||1; ctx.resetTransform(); ctx.scale(__dpr, __dpr); } } catch(e){}

    if (!ctx || !labels || !labels.length) return;
    
    labels.forEach(label => {
      ctx.save();
      ctx.beginPath();
      
      // 使用标签对象中自带的样式属性，没有则使用默认值
      const radius = label.radius !== undefined ? label.radius : 20;
      const fillStyle = label.fillStyle || '#FFFFFF';
      const strokeStyle = label.strokeStyle || '#000000';
      const lineWidth = label.lineWidth !== undefined ? label.lineWidth : 1;
      const fontSize = label.fontSize || 14;
      const fontColor = label.fontColor || '#000000';
      
      // 绘制圆形背景
      ctx.arc(label.x, label.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fillStyle;
      ctx.fill();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      
      // 绘制文本
      ctx.fillStyle = fontColor;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.text, label.x, label.y);
      
      ctx.restore();
    });
  },

  // 初始化矩阵题滚动同步（可以根据需要实现）
  initMatrixScrollSync() {
    // 这里可以添加矩阵题滚动同步逻辑
    console.log('Initializing matrix scroll sync');
  },

  // 上一题
  prevQuestion() {
    if (this.data.currentQuestionIndex > 0) {
      const prevIndex = this.data.currentQuestionIndex - 1;
      // 加载上一题的得分（如果有）
      const prevScore = this.data.questionnaire.questions[prevIndex].score || '';
      
      this.setData({
        currentQuestionIndex: prevIndex,
        selectedOption: this.data.questionnaire.questions[prevIndex].selectedOption || null,
        selectedOptions: this.data.questionnaire.questions[prevIndex].selectedOptions || [],
        questionScore: prevScore,
        lastValidScore: prevScore
      }, () => {
        // 检查新的当前题目是否为画图题，如果是则重新初始化画布
        if (this.isDrawingQuestion()) {
          this.initCanvas();
        }
        // 检查是否为矩阵题
        if (this.data.questionnaire.questions[this.data.currentQuestionIndex] && 
            this.data.questionnaire.questions[this.data.currentQuestionIndex].type === 'matrix') {
          this.initMatrixScrollSync();
        }
      });
    }
  },

  // 下一题
  nextQuestion() {
    if (this.data.currentQuestionIndex < this.data.questionnaire.questions.length - 1) {
      const nextIndex = this.data.currentQuestionIndex + 1;
      // 加载下一题的得分（如果有）
      const nextScore = this.data.questionnaire.questions[nextIndex].score || '';
      
      this.setData({
        currentQuestionIndex: nextIndex,
        selectedOption: this.data.questionnaire.questions[nextIndex].selectedOption || null,
        selectedOptions: this.data.questionnaire.questions[nextIndex].selectedOptions || [],
        questionScore: nextScore,
        lastValidScore: nextScore
      }, () => {
        // 检查新的当前题目是否为画图题，如果是则重新初始化画布
        if (this.isDrawingQuestion()) {
          this.initCanvas();
        }
        // 检查是否为矩阵题
        if (this.data.questionnaire.questions[this.data.currentQuestionIndex] && 
            this.data.questionnaire.questions[this.data.currentQuestionIndex].type === 'matrix') {
          this.initMatrixScrollSync();
        }
      });
    }
  },

  // 跳转到指定题目
  jumpToQuestion(e) {
    const index = e.currentTarget.dataset.index;
    if (index >= 0 && index < this.data.questionnaire.questions.length) {
      // 加载指定题目的得分（如果有）
      const questionScore = this.data.questionnaire.questions[index].score || '';
      
      this.setData({
        currentQuestionIndex: index,
        selectedOption: this.data.questionnaire.questions[index].selectedOption || null,
        selectedOptions: this.data.questionnaire.questions[index].selectedOptions || [],
        questionScore: questionScore,
        lastValidScore: questionScore
      }, () => {
        // 检查新的当前题目是否为画图题，如果是则重新初始化画布
        if (this.isDrawingQuestion()) {
          this.initCanvas();
        }
        // 检查是否为矩阵题
        if (this.data.questionnaire.questions[this.data.currentQuestionIndex] && 
            this.data.questionnaire.questions[this.data.currentQuestionIndex].type === 'matrix') {
          this.initMatrixScrollSync();
        }
      });
    }
  },

  // 显示题目选择器
  showQuestionSelector() {
    this.setData({
      showQuestionSelector: true
    });
  },

  // 隐藏题目选择器
  hideQuestionSelector() {
    this.setData({
      showQuestionSelector: false
    });
  },

  // 选择题目
  selectQuestion(e) {
    const index = e.currentTarget.dataset.index;
    if (index >= 0 && index < this.data.questionnaire.questions.length) {
      // 加载选择题目的得分（如果有）
      const questionScore = this.data.questionnaire.questions[index].score || '';
      
      this.setData({
        currentQuestionIndex: index,
        selectedOption: this.data.questionnaire.questions[index].selectedOption || null,
        selectedOptions: this.data.questionnaire.questions[index].selectedOptions || [],
        questionScore: questionScore,
        lastValidScore: questionScore,
        showQuestionSelector: false
      }, () => {
        // 检查新的当前题目是否为画图题，如果是则重新初始化画布
        if (this.isDrawingQuestion()) {
          this.initCanvas();
        }
        // 检查是否为矩阵题
        if (this.data.questionnaire.questions[this.data.currentQuestionIndex] && 
            this.data.questionnaire.questions[this.data.currentQuestionIndex].type === 'matrix') {
          this.initMatrixScrollSync();
        }
      });
    }
  },

  // 返回上一页
  navigateBack() {
    wx.navigateBack();
  }
});