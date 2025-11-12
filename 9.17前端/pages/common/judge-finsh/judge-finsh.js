// pages/common/judge-finsh/judge-finsh.js
Page({
  // === 每用户隔离存储Key工具 ===
  getFinishedKey(userId) {
    return userId ? `finishedQuestionnaires_${userId}` : 'finishedQuestionnaires';
  },
  data: {
    questionnaires: [], // 用于显示（合并后的）
    originalQuestionnaires: [], // 原始问卷列表，用于重置搜索
    searchValue: '',
    showEmpty: false
  },

  onLoad() {
    this.loadJudgedQuestionnaires();
  },

  onShow() {
    // 每次显示页面都刷新，保证能跟随后台/其他用户的修改/删除而更新
    this.loadJudgedQuestionnaires();
  },

  // 深拷贝工具
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  },

  // 根据主问卷和已填写问卷合并答案（优先用 question.id 匹配，降级用 title，再降级用索引）
  mergeMasterWithFinished(master, finished) {
    const merged = this.deepClone(master);

    // 保留状态与完成时间（若有）
    if (finished && typeof finished === 'object') {
      merged.userId = finished.userId || merged.userId;
      merged.userNickname = finished.userNickname || merged.userNickname;
      merged.userEmail = finished.userEmail || merged.userEmail;
      merged.judgedByNickname = finished.judgedByNickname || merged.judgedByNickname;
      merged.judgedByEmail = finished.judgedByEmail || merged.judgedByEmail;
      merged.status = finished.status || merged.status || '';
      merged.finishedAt = finished.finishedAt || merged.finishedAt || '';
    }

    // 如果 finished 中没有 questions，直接返回 master（仍保留 status/finishedAt）
    if (!finished || !Array.isArray(finished.questions) || finished.questions.length === 0) {
      // 确保初始化必要字段
      merged.questions = merged.questions || [];
      merged.questions.forEach(q => {
        if (q.type === 'multiple' && !Array.isArray(q.selectedOptions)) q.selectedOptions = [];
        if (q.type === 'blank' && !Array.isArray(q.blanks)) q.blanks = q.blanks || [];
      });
      return merged;
    }

    // 辅助找对应问题
    const findFinishedQuestion = (mQ, idx) => {
      // 1. 尝试按 id 匹配
      if (mQ && (mQ.id !== undefined && mQ.id !== null)) {
        const q = finished.questions.find(fq => fq && (fq.id === mQ.id || fq.id == mQ.id));
        if (q) return q;
      }
      // 2. 按 title 匹配
      if (mQ && mQ.title) {
        const q = finished.questions.find(fq => fq && fq.title === mQ.title);
        if (q) return q;
      }
      // 3. 按索引回退
      return finished.questions[idx] || null;
    };

    merged.questions = (merged.questions || []).map((mQ, idx) => {
      const fq = findFinishedQuestion(mQ, idx);
      const newQ = this.deepClone(mQ);

      if (fq) {
        // 复制常见的用户答案字段（兼容多种题型）
        if (fq.hasOwnProperty('selectedOption')) newQ.selectedOption = fq.selectedOption;
        if (fq.hasOwnProperty('selectedOptions')) newQ.selectedOptions = Array.isArray(fq.selectedOptions) ? fq.selectedOptions.slice() : [];
        if (fq.hasOwnProperty('answer')) newQ.answer = fq.answer;
        if (fq.hasOwnProperty('blanks')) newQ.blanks = Array.isArray(fq.blanks) ? fq.blanks.slice() : fq.blanks;
        if (fq.hasOwnProperty('drawingData')) newQ.drawingData = fq.drawingData;
        if (fq.hasOwnProperty('labels')) newQ.labels = Array.isArray(fq.labels) ? fq.labels.slice() : fq.labels;
        // 矩阵题兼容 selectedCells
        if (fq.matrix && fq.matrix.selectedCells) {
          newQ.matrix = newQ.matrix || {};
          newQ.matrix.selectedCells = fq.matrix.selectedCells.map(row => row.slice());
        } else if (fq.selectedCells) {
          newQ.matrix = newQ.matrix || {};
          newQ.matrix.selectedCells = fq.selectedCells.map(row => row.slice());
        }
        if (fq.hasOwnProperty('score')) newQ.score = fq.score;
      } else {
        // 没有已填答案：确保数组字段初始化，避免页面渲染 undefined
        if (newQ.type === 'multiple' && !Array.isArray(newQ.selectedOptions)) newQ.selectedOptions = [];
        if (newQ.type === 'blank' && !Array.isArray(newQ.blanks)) newQ.blanks = [];
      }

      return newQ;
    });

    return merged;
  },

  // 加载已批阅的问卷
  loadJudgedQuestionnaires() {
    const finishedQuestionnaires = wx.getStorageSync('finishedQuestionnaires') || [];
    const masterList = wx.getStorageSync('questionnaires') || [];

    const cleanedFinished = [];
    const displayList = [];

    // 筛选出已批阅的问卷
    finishedQuestionnaires.forEach(finished => {
      const master = masterList.find(m => m.id === finished.masterId || m.id == finished.masterId || m.name === finished.name);
      
      if (master) {
        const merged = this.mergeMasterWithFinished(master, finished);
        merged.finishedId = finished.id; // 记录复合ID用于跳转与删除
        // 只显示已批阅的问卷
        if (merged.status === '已批阅') {
          displayList.push(merged);
        }
        cleanedFinished.push(finished);
      }
    });

    // 按完成时间倒序排列
    displayList.sort((a, b) => {
      return new Date(b.finishedAt || '').getTime() - new Date(a.finishedAt || '').getTime();
    });

    this.setData({
      questionnaires: displayList,
      originalQuestionnaires: this.deepClone(displayList),
      showEmpty: displayList.length === 0
    });

    // 保存清理后的已完成问卷列表
    wx.setStorageSync('finishedQuestionnaires', cleanedFinished);
  },

  // 搜索功能
  onSearch(e) {
    const searchValue = e.detail.value;
    this.setData({ searchValue });
    this.filterQuestionnaires(searchValue);
  },

  // 触发搜索
  triggerSearch() {
    this.filterQuestionnaires(this.data.searchValue);
  },

  // 筛选问卷
  filterQuestionnaires(keyword) {
    if (!keyword.trim()) {
      // 无关键词，重置为原始列表
      this.setData({
        questionnaires: this.deepClone(this.data.originalQuestionnaires),
        showEmpty: this.data.originalQuestionnaires.length === 0
      });
      return;
    }

    const filtered = this.data.originalQuestionnaires.filter(q => 
      q.name && q.name.includes(keyword)
    );

    this.setData({
      questionnaires: filtered,
      showEmpty: filtered.length === 0
    });
  },

  // 查看已批阅问卷
    viewJudgedQuestionnaire(e) {
    const id = e.currentTarget.dataset.fid || e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/common/judge-answer/questionnaire-detail?id=${id}&viewing=true`
    });
  },

  // 查看得分情况
  viewScore(e) {
    const fid = e.currentTarget.dataset.fid || e.currentTarget.dataset.id;
    const questionnaire = (this.data.questionnaires || []).find(q =>
      (q.finishedId && q.finishedId === fid) || q.id === fid || ((q.id + '_' + (q.userId || '')) === fid)
    );
    if (!questionnaire) {
      wx.showToast({ title: '问卷数据异常', icon: 'none' });
      return;
    }
    try {
      const scoreStorage = wx.getStorageSync('questionnaireScores') || {};
      const allKeys = Object.keys(scoreStorage);
      
      // 使用问卷的原始ID（master ID）来检查得分记录
      // 因为在questionnaire-detail.js中保存得分时使用的就是这个ID
      const questionnaireId = questionnaire.id; // 使用master问卷ID
      const judgeInfo = wx.getStorageSync('userInfo') || {};
      const judgeId = judgeInfo.email || judgeInfo.nickname || judgeInfo.id || 'anonymous';
      const rawId = String(questionnaire.finishedId || questionnaire.id || '');
      const answerUserId = questionnaire.userId || (rawId.includes('_') ? rawId.split('_')[1] : '');
      
      // 严格检查是否有有效的得分记录
      // 键格式应该是: questionnaireId_startIndex_endIndex
      const hasRecord = allKeys.some(k => {
        const parts = k.split('_');
        if (parts.length >= 5) {
          return String(parts[0]) === String(judgeId) && String(parts[1]) === String(questionnaireId) && String(parts[2]) === String(answerUserId);
        }
        if (parts.length >= 4) {
          const rec = scoreStorage[k];
          return String(parts[0]) === String(judgeId) && String(parts[1]) === String(questionnaireId) && rec && rec.answerUserId && String(rec.answerUserId) === String(answerUserId);
        }
        return false;
      });
      
      if (hasRecord) {
        // 强制更新全局数据标记，确保页面刷新
        try {
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.scoreUpdated = {
              questionnaireId: questionnaireId,
              timestamp: Date.now()
            };
          }
        } catch (e) {
          console.warn('设置全局更新失败:', e);
        }
        
        wx.navigateTo({
          url: `/pages/common/score/score?questionnaireId=${questionnaireId}&answerUserId=${encodeURIComponent(answerUserId)}&questionnaireName=${encodeURIComponent(questionnaire.name || '')}`,
          success: (res) => {
            try {
              res.eventChannel.emit('scoreUpdated', { questionnaireId, answerUserId });
            } catch (e) { console.warn('emit scoreUpdated failed', e); }
          }
        });
      } else {
        wx.showToast({ title: '暂无得分记录', icon: 'none' });
      }
    } catch (e) {
      console.error('检查得分记录失败:', e);
      wx.showToast({ title: '检查失败', icon: 'none' });
    }
  },

  // 删除问卷
  deleteQuestionnaire(e) {
    const id = e.currentTarget.dataset.fid || e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这份问卷吗？删除后将无法恢复。',
      success: (res) => {
        if (res.confirm) {
          // 1) 从全局桶删除（批阅列表的数据源）
          const finishedQuestionnaires = wx.getStorageSync('finishedQuestionnaires') || [];
          const toDel = finishedQuestionnaires.find(q => q && (q.id === id || q.id == id));
          const updatedFinished = finishedQuestionnaires.filter(q => q && (q.id !== id && q.id != id));
          wx.setStorageSync('finishedQuestionnaires', updatedFinished);
          
          // 2) 同步从对应用户桶删除
          try {
            if (toDel && toDel.userId) {
              const userKey = this.getFinishedKey(toDel.userId);
              const userList = wx.getStorageSync(userKey) || [];
              const newUserList = userList.filter(q => q && (q.id !== toDel.masterId && q.id != toDel.masterId));
              // 说明：用户桶里存的 id 是原问卷的 id（masterId），而非复合 id
              wx.setStorageSync(userKey, newUserList);
            }
          } catch (err) {
            console.warn('同步删除用户个人桶失败：', err);
          }

          // 更新列表
          this.loadJudgedQuestionnaires();
          
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  }
});