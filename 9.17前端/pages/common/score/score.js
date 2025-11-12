// pages/common/score/score.js
Page({
  data: {
    questionnaireName: '',
    questionnaireDescription: '',
    questionnaireId: '',
    answerUserId: '',
    scoreRecords: [], // 存储多个得分记录
    selectedRecord: null, // 当前选中的记录
    scoreData: [],
    totalScore: 0,
    startQuestion: 0,
    endQuestion: 0,
    modules: [], // 问卷的模块列表
    moduleScores: [], // 各模块的得分情况
    expandedModules: {}, // 存储各模块的展开状态
    moduleQuestionsMap: {} // 存储每个模块对应的问题列表
  },

  onLoad(options) {
    console.log('得分页面参数:', options);
    
    // 获取传递的参数
    const questionnaireName = options.questionnaireName ? decodeURIComponent(options.questionnaireName) : '未知问卷';
    const startQuestion = parseInt(options.startQuestion) || 0;
    const endQuestion = parseInt(options.endQuestion) || 0;
    const questionnaireId = options.questionnaireId || '';
    const answerUserId = options.answerUserId || '';
    
    // 获取问卷描述和模块信息
    let questionnaireDescription = '';
    let modules = [];
    try {
      // 优先从finishedQuestionnaires中获取（包含用户提交的问卷）
      const finishedQuestionnaires = wx.getStorageSync('finishedQuestionnaires') || [];
      let questionnaire = finishedQuestionnaires.find(q => {
        // 匹配masterId或直接匹配id
        const isMatch = q.masterId === questionnaireId || q.id === questionnaireId;
        // 如果指定了answerUserId，还要匹配用户ID
        return !answerUserId || isMatch && q.userId === answerUserId;
      });
      
      // 如果在finishedQuestionnaires中没找到，再从questionnaires中找
      if (!questionnaire) {
        const questionnaires = wx.getStorageSync('questionnaires') || [];
        questionnaire = questionnaires.find(q => q.id == questionnaireId);
      }
      
      questionnaireDescription = questionnaire ? (questionnaire.description || '') : '';
      modules = questionnaire ? (questionnaire.modules || []) : [];
    } catch (error) {
      console.error('获取问卷描述失败:', error);
    }
    
    this.setData({
      questionnaireName,
      questionnaireDescription,
      questionnaireId,
      answerUserId,
      modules
    });

    // 加载该问卷的所有得分记录
    this.loadAllScoreRecords(questionnaireId);

    // 监听数据更新事件
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('scoreUpdated', (data) => {
        console.log('收到得分更新事件:', data);
        if (data.questionnaireId === this.data.questionnaireId && (!data.answerUserId || data.answerUserId === this.data.answerUserId)) {
          this.loadAllScoreRecords(data.questionnaireId);
        }
      });
    }
  },

  // 页面返回/显示时自动刷新最新得分（解决批阅保存后不自动更新的问题）
  onShow() {
    const { questionnaireId } = this.data || {};
    if (questionnaireId) {
      try {
        this.loadAllScoreRecords(questionnaireId);
        
        // 检查是否有全局的得分更新
        try {
          const app = getApp();
          if (app && app.globalData && app.globalData.scoreUpdated) {
            const { questionnaireId: updatedId, timestamp } = app.globalData.scoreUpdated;
            if (updatedId === questionnaireId && 
                (!this.lastUpdateTime || timestamp > this.lastUpdateTime)) {
              this.lastUpdateTime = timestamp;
              this.loadAllScoreRecords(questionnaireId);
            }
          }
        } catch (e) {
          console.warn('检查全局更新失败:', e);
        }
      } catch (e) {
        console.error('onShow 刷新得分失败:', e);
      }
    }
  },

  // 加载该问卷的所有得分记录
  loadAllScoreRecords(questionnaireId) {
    try {
      // 获取当前用户信息
      const userInfo = wx.getStorageSync('userInfo') || {};
      const userId = userInfo.email || userInfo.nickname || 'anonymous';

      // 迁移旧数据
      // 没有指定作答用户ID时，不展示任何记录（避免串显所有用户）
      if (!this.data.answerUserId) {
        this.setData({
          scoreRecords: [],
          selectedRecord: null,
          scoreData: [],
          totalScore: 0,
          startQuestion: 0,
          endQuestion: 0
        });
        return;
      }

      this.migrateOldData(userId, questionnaireId);

      const scoreStorage = wx.getStorageSync('questionnaireScores') || {};
      const allKeys = Object.keys(scoreStorage);
      
      // 筛选出该用户该问卷的所有得分记录
      const questionnaireScores = allKeys
        .filter(key => {
          const parts = key.split('_');
          // 仅展示：批阅者 + 问卷 + 作答用户 三重匹配的记录
          if (parts.length >= 5) {
            return String(parts[0]) === String(userId) && String(parts[1]) === String(questionnaireId) && String(parts[2]) === String(this.data.answerUserId);
          }
          // 兼容旧格式：只有当记录对象里带有 answerUserId 且匹配时才展示
          if (parts.length >= 4) {
            const rec = scoreStorage[key];
            return String(parts[0]) === String(userId) && String(parts[1]) === String(questionnaireId) && rec && rec.answerUserId && String(rec.answerUserId) === String(this.data.answerUserId);
          }
          return false;
        })
        .map(key => {
          const scoreData = scoreStorage[key];
          // 解析key获取题号范围（新的key格式：userId_questionnaireId_start_end）
          const parts = key.split('_');
          return {
            ...scoreData,
            key: key,
            startQuestion: scoreData.startQuestion || (parts.length >= 5 ? (parseInt(parts[3]) || 0) : (parseInt(parts[2]) || 0)),
            endQuestion: scoreData.endQuestion || (parts.length >= 5 ? (parseInt(parts[4]) || 0) : (parseInt(parts[3]) || 0))
          };
        })
        .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0)); // 按时间倒序排序

      if (questionnaireScores.length > 0) {
        // 默认显示最新的记录
        console.log('加载的得分记录:', questionnaireScores);
        
        // 确保当前选中的记录仍然有效，如果无效则选择第一条
        let selectedRecord = this.data.selectedRecord;
        if (!selectedRecord || !questionnaireScores.find(r => r.key === selectedRecord.key)) {
          selectedRecord = questionnaireScores[0];
        }
        
        // 计算模块得分和问题列表
        const { moduleScores, moduleQuestionsMap } = this.calculateModuleScores(selectedRecord.scoreData || [], this.data.modules);
        
        this.setData({
          scoreRecords: questionnaireScores,
          selectedRecord: selectedRecord,
          scoreData: selectedRecord.scoreData || [],
          totalScore: selectedRecord.totalScore || 0,
          startQuestion: selectedRecord.startQuestion || 0,
          endQuestion: selectedRecord.endQuestion || 0,
          moduleScores: moduleScores,
          moduleQuestionsMap: moduleQuestionsMap
        });
      } else {
        this.setData({
          scoreRecords: [],
          selectedRecord: null,
          scoreData: [],
          totalScore: 0
        });
      }
    } catch (error) {
      console.error('加载得分记录失败:', error);
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      });
    }
  },

  // 选择不同的得分记录
  selectRecord(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.scoreRecords[index];
    
    // 计算各模块的得分和问题列表
    const { moduleScores, moduleQuestionsMap } = this.calculateModuleScores(record.scoreData || [], this.data.modules);
    
    // 重置展开状态
    const expandedModules = {};
    
    this.setData({
      selectedRecord: record,
      scoreData: record.scoreData || [],
      totalScore: record.totalScore || 0,
      startQuestion: record.startQuestion || 0,
      endQuestion: record.endQuestion || 0,
      moduleScores: moduleScores,
      moduleQuestionsMap: moduleQuestionsMap,
      expandedModules: expandedModules
    });
  },
  
  // 处理模块点击事件，切换展开/收起状态
  toggleModule(e) {
    const moduleIndex = e.currentTarget.dataset.moduleIndex;
    const moduleKey = `module_${moduleIndex}`;
    
    // 切换模块的展开状态
    const newExpandedModules = {
      ...this.data.expandedModules,
      [moduleKey]: !this.data.expandedModules[moduleKey]
    };
    
    this.setData({
      expandedModules: newExpandedModules
    });
  },
  
  // 计算各模块的得分
  calculateModuleScores(scoreData, modules) {
    if (!scoreData || scoreData.length === 0 || !modules || modules.length === 0) {
      return { moduleScores: [], moduleQuestionsMap: {} };
    }
    
    // 创建模块得分数组
    const moduleScores = modules.map(module => ({
      moduleName: module.name,
      score: 0,
      questionCount: 0,
      moduleIndex: modules.indexOf(module)
    }));
    
    // 创建模块问题映射
    const moduleQuestionsMap = {};
    modules.forEach((module, index) => {
      moduleQuestionsMap[index] = [];
    });
    
    // 遍历得分数据，按模块统计得分和问题
    scoreData.forEach(scoreItem => {
      let targetModuleIndex = -1;
      
      // 优先使用直接存储的moduleIndex
      if (scoreItem.moduleIndex !== undefined && scoreItem.moduleIndex >= 0 && scoreItem.moduleIndex < modules.length) {
        targetModuleIndex = scoreItem.moduleIndex;
      } else {
        // 兼容旧数据：尝试使用questionNumber或questionIndex
        const questionIndex = scoreItem.questionNumber !== undefined ? scoreItem.questionNumber : (scoreItem.questionIndex || 0);
        
        // 查找问题所属的模块
        for (let i = modules.length - 1; i >= 0; i--) {
          if (modules[i].startIndex !== undefined && questionIndex >= modules[i].startIndex) {
            targetModuleIndex = i;
            break;
          }
        }
        
        // 如果没有找到，尝试另一种方式：检查每个模块的问题范围
        if (targetModuleIndex === -1) {
          for (let i = 0; i < modules.length; i++) {
            const module = modules[i];
            if (module.startIndex !== undefined && module.endIndex !== undefined) {
              if (questionIndex >= module.startIndex && questionIndex <= module.endIndex) {
                targetModuleIndex = i;
                break;
              }
            }
          }
        }
      }
      
      // 统计得分和添加问题到对应模块
      if (targetModuleIndex >= 0) {
        moduleScores[targetModuleIndex].score += scoreItem.score || 0;
        moduleScores[targetModuleIndex].questionCount++;
        moduleQuestionsMap[targetModuleIndex].push(scoreItem);
      }
    });
    
    return { moduleScores, moduleQuestionsMap };
  },

  // 迁移旧数据（兼容旧格式）
  migrateOldData(userId, questionnaireId) {
    try {
      const scoreStorage = wx.getStorageSync('questionnaireScores') || {};
      const allKeys = Object.keys(scoreStorage);
      
      // 查找旧格式的数据（没有用户ID前缀）
      const oldKeys = allKeys.filter(key => {
        const parts = key.split('_');
        return parts.length === 3 && String(parts[0]) === String(questionnaireId);
      });

      if (oldKeys.length > 0) {
        console.log('发现旧格式数据，开始迁移...', oldKeys);
        
        oldKeys.forEach(oldKey => {
          const oldData = scoreStorage[oldKey];
          const parts = oldKey.split('_');
          const startIndex = parseInt(parts[1]) || 0;
          const endIndex = parseInt(parts[2]) || 0;
          
          // 创建新格式的key
          const newKey = `${userId}_${questionnaireId}_${startIndex}_${endIndex}`;
          
          // 如果新key不存在，则迁移数据
          if (!scoreStorage[newKey]) {
            scoreStorage[newKey] = {
              ...oldData,
              userId: userId,
              judgedByNickname: oldData.judgedByNickname || '',
              judgedByEmail: oldData.judgedByEmail || ''
            };
            
            // 删除旧数据
            delete scoreStorage[oldKey];
            
            console.log(`迁移数据: ${oldKey} -> ${newKey}`);
          }
        });
        
        wx.setStorageSync('questionnaireScores', scoreStorage);
        console.log('数据迁移完成');
      }
    } catch (error) {
      console.error('数据迁移失败:', error);
    }
  },

  // 删除得分记录
  deleteRecord(e) {
    const key = e.currentTarget.dataset.key;
    const index = e.currentTarget.dataset.index;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条得分记录吗？此操作不可恢复。',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          try {
            const scoreStorage = wx.getStorageSync('questionnaireScores') || {};
            
            // 删除记录
            if (scoreStorage[key]) {
              delete scoreStorage[key];
              wx.setStorageSync('questionnaireScores', scoreStorage);
              
              // 更新本地数据
              const newScoreRecords = [...this.data.scoreRecords];
              newScoreRecords.splice(index, 1);
              
              if (newScoreRecords.length > 0) {
                // 如果删除的是当前选中的记录，选择第一条
                const newSelectedRecord = this.data.selectedRecord.key === key ? 
                  newScoreRecords[0] : this.data.selectedRecord;
                
                this.setData({
                  scoreRecords: newScoreRecords,
                  selectedRecord: newSelectedRecord,
                  scoreData: newSelectedRecord.scoreData || [],
                  totalScore: newSelectedRecord.totalScore || 0,
                  startQuestion: newSelectedRecord.startQuestion || 0,
                  endQuestion: newSelectedRecord.endQuestion || 0
                });
              } else {
                // 没有记录时清空数据
                this.setData({
                  scoreRecords: [],
                  selectedRecord: null,
                  scoreData: [],
                  totalScore: 0
                });
              }
              
              wx.showToast({
                title: '删除成功',
                icon: 'success',
                duration: 1500
              });
            }
          } catch (error) {
            console.error('删除记录失败:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});