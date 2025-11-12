// pages/medical-researcher/questionnaire/preview/preview.js
Page({
  // 生成选项字母 (A, B, C, ...)
  getOptionLetter(index) {
    console.log('getOptionLetter called with index:', index);
    return String.fromCharCode(65 + index);
  },

  data: {
    questionnaire: null,
    currentQuestionIndex: 0,
    loading: true,
    showQuestionSelector: false,
    letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    scrollLeft: 0,
    scrollTop: 0,
    selectedCells: []
  },
  // —— 仅用于预览连线题：把标签渲染成一张 SVG 图片，避免显示作答的连线 ——
  __makeConnectLabelOnly(question) {
    try {
      const width = question?.canvasWidth || 600;
      const height = question?.canvasHeight || 400;
      const labels = Array.isArray(question?.labels) ? question.labels : [];
      const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`];
      for (const l of labels) {
        const cx = Number(l?.x ?? 0);
        const cy = Number(l?.y ?? 0);
        const r = Number(l?.radius ?? 20);
        const fill = l?.fillStyle || '#FFFFFF';
        const stroke = l?.strokeStyle || '#000000';
        const lw = (l?.lineWidth !== undefined) ? Number(l.lineWidth) : 1;
        const fs = Number(l?.fontSize ?? 14);
        const color = l?.fontColor || '#000000';
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`);
        parts.push(`<text x="${cx}" y="${cy}" font-size="${fs}" fill="${color}" dominant-baseline="middle" text-anchor="middle">${esc(l?.text)}</text>`);
      }
      parts.push(`</svg>`);
      const svg = parts.join('');
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    } catch (e) {
      return '';
    }
  },
  __prepareConnectPreview(q) {
    try {
      const copy = JSON.parse(JSON.stringify(q || {}));
      if (Array.isArray(copy.questions)) {
        copy.questions = copy.questions.map(qq => {
          if (qq && qq.type === 'draw' && qq.subType === 'connect') {
            const url = this.__makeConnectLabelOnly(qq);
            return Object.assign({}, qq, { drawingData: url, paths: [] });
          }
          return qq;
        });
      }
      return copy;
    } catch (e) {
      return q;
    }
  },


  onLoad(options) {
    // 首先尝试从previewQuestionnaire获取预览数据
    let questionnaire = wx.getStorageSync('previewQuestionnaire');
    
    // 如果没有previewQuestionnaire，尝试从questionnaires中查找
    if (!questionnaire || questionnaire.id != options.id) {
      const questionnaires = wx.getStorageSync('questionnaires') || [];
      questionnaire = questionnaires.find(q => q.id == options.id);
    }
    
    if (questionnaire) {
      // 初始化勾选题选中状态二维数组
      let selectedCells = [];
      if (questionnaire.questions && questionnaire.questions.length > 0) {
        const currentQuestion = questionnaire.questions[0];
        if (currentQuestion.type === 'matrix' && currentQuestion.matrix) {
          selectedCells = this.initSelectedCells(currentQuestion.matrix.rowHeaders.length, currentQuestion.matrix.colHeaders.length, currentQuestion.matrix.selectedCells);
        }
      }
      
      setTimeout(() => {
        this.setData({ questionnaire: this.__prepareConnectPreview(questionnaire),
          loading: false,
          selectedCells: selectedCells
        });
        
        // 初始化滚动同步
        this.initMatrixScrollSync();
      }, 500);
    } else {
      wx.showToast({
        title: '未找到预览数据',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },
  
  // 初始化勾选题选中状态二维数组
  initSelectedCells(rows, cols, selectedKeys) {
    const cells = Array(rows).fill().map(() => Array(cols).fill(false));
    
    if (selectedKeys && selectedKeys.length > 0) {
      selectedKeys.forEach(key => {
        const [rowIndex, colIndex] = key.split('-').map(Number);
        if (!isNaN(rowIndex) && !isNaN(colIndex) && rowIndex < rows && colIndex < cols) {
          cells[rowIndex][colIndex] = true;
        }
      });
    }
    
    return cells;
  },
  
  // 初始化滚动同步
  initMatrixScrollSync() {
    // 这里可以添加初始化逻辑
  },
  
  // 列标题滚动事件
  onHeaderScroll(e) {
    this.setData({
      scrollLeft: e.detail.scrollLeft
    });
  },
  
  // 单元格区域滚动事件
  onCellsScroll(e) {
    this.setData({
      scrollLeft: e.detail.scrollLeft
    });
  },
  
  // 行内容滚动事件
  onBodyScroll(e) {
    this.setData({
      scrollTop: e.detail.scrollTop
    });
  },
  
  // 当切换题目时重新初始化选中状态
  onQuestionChange() {
    const currentQuestion = this.data.questionnaire.questions[this.data.currentQuestionIndex];
    if (currentQuestion.type === 'matrix' && currentQuestion.matrix) {
      const selectedCells = this.initSelectedCells(
        currentQuestion.matrix.rowHeaders.length,
        currentQuestion.matrix.colHeaders.length,
        currentQuestion.matrix.selectedCells
      );
      this.setData({
        selectedCells: selectedCells
      });
    }
  },

  

  prevQuestion() {
    if (this.data.currentQuestionIndex > 0) {
      this.setData({
        currentQuestionIndex: this.data.currentQuestionIndex - 1
      });
      this.onQuestionChange();
    } else {
      wx.showToast({
        title: '已经是第一题',
        icon: 'none',
        duration: 800
      });
    }
  },

  nextQuestion() {
    if (this.data.currentQuestionIndex < this.data.questionnaire.questions.length - 1) {
      this.setData({
        currentQuestionIndex: this.data.currentQuestionIndex + 1
      });
      this.onQuestionChange();
    } else {
      wx.showToast({
        title: '已经是最后一题',
        icon: 'none',
        duration: 800
      });
    }
  },

  finishPreview() {
    wx.navigateBack();
  },

  // 显示选题弹窗
  showQuestionSelector() {
    this.setData({
      showQuestionSelector: true
    });
  },

  // 隐藏选题弹窗
  hideQuestionSelector() {
    this.setData({
      showQuestionSelector: false
    });
  },

  // 选择题目
  selectQuestion(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentQuestionIndex: index,
      showQuestionSelector: false
    });
  },

  // 编辑当前题目
  editCurrentQuestion() {
    const { questionnaire, currentQuestionIndex } = this.data;
    wx.navigateTo({
      url: `/pages/medical-researcher/questionnaire/create/create?id=${questionnaire.id}&questionIndex=${currentQuestionIndex}`
    });
  },

});