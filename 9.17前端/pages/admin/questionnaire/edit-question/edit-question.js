Page({
  getOptionLetter(index) {
    console.log('getOptionLetter called with index:', index);
    return 'C';
  },

  data: {
    questionIndex: -1,
    question: {
      type: 'single',
      title: '',
      options: [],
      answer: '',
      blanks: [],
      imageUrl: '',
      matrix: {
        rows: 2,
        cols: 2,
        rowHeaders: ['', ''],
        colHeaders: ['', ''],
        selectedCells: [[false, false], [false, false]]
      }
    },
    isNew: true,
    testLetter: 'B',
    letters: [],
    scrollLeft: 0,    // 横向滚动位置
    scrollTop: 0,     // 纵向滚动位置
  },

  uploadImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.getFileSystemManager().readFile({
          filePath: tempFilePath,
          encoding: 'base64',
          success: (res) => {
            const base64Image = `data:image/png;base64,${res.data}`;
            this.setData({
              'question.imageUrl': base64Image
            });
          }
        });
      }
    });
  },

  onAnswerInput(e) {
    this.setData({
      'question.answer': e.detail.value
    });
  },

  onLoad(options) {
    this.setData({
      letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
      scrollLeft: 0,
      scrollTop: 0
    });
    
    const { index, type, moduleIndex } = options;
    this.moduleIndex = moduleIndex !== undefined ? parseInt(moduleIndex) : -1;
    if (index !== undefined) {
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      const question = prevPage.data.questions[index];
      
      if (question.type === 'matrix' && !question.matrix.selectedCells) {
        const rows = question.matrix.rowHeaders.length;
        const cols = question.matrix.colHeaders.length;
        question.matrix.selectedCells = Array(rows).fill().map(() => Array(cols).fill(false));
      }
      
      this.setData({
        questionIndex: parseInt(index),
        question: { ...question, blanks: question.blanks || [] },
        isNew: false
      });
    } else if (type) {
      let defaultOptions = [];
      let defaultAnswer = '';
      let defaultBlanks = [];
      let defaultMatrix = {
        rows: 2,
        cols: 2,
        rowHeaders: ['', ''],
        colHeaders: ['', ''],
        selectedCells: [[false, false], [false, false]]
      };
      
      if (type === 'single' || type === 'multiple') {
        defaultOptions = ['', '', ''];
      } else if (type === 'text') {
        defaultAnswer = '';
      } else if (type === 'blank') {
        defaultBlanks = [];
      } else if (type === 'matrix') {
        // 勾选题型默认设置
      }
      
      this.setData({
        question: {
          type: type,
          title: '',
          options: defaultOptions,
          answer: defaultAnswer,
          blanks: defaultBlanks,
          imageUrl: '',
          matrix: defaultMatrix
        },
        isNew: true
      });
    }
  },
  
  insertBlank() {
    const blanks = [...this.data.question.blanks];
    const newBlankIndex = blanks.length + 1;
    blanks.push('');
    
    const questionTitle = this.data.question.title;
    const newQuestionTitle = questionTitle + `【${newBlankIndex}】`;
    
    this.setData({
      'question.title': newQuestionTitle,
      'question.blanks': blanks
    });
  },
  
  onBlankInput(e) {
    const { index } = e.currentTarget.dataset;
    const blanks = [...this.data.question.blanks];
    blanks[index] = e.detail.value;
    
    this.setData({
      'question.blanks': blanks
    });
  },
  
  deleteBlank(e) {
    const { index } = e.currentTarget.dataset;
    const blanks = [...this.data.question.blanks];
    blanks.splice(index, 1);
    
    let questionTitle = this.data.question.title;
    questionTitle = questionTitle.replace(/【\d+】/g, '');
    for (let i = 0; i < blanks.length; i++) {
      questionTitle += `【${i + 1}】`;
    }
    
    this.setData({
      'question.title': questionTitle,
      'question.blanks': blanks
    });
  },

  onTitleInput(e) {
    this.setData({
      'question.title': e.detail.value
    });
  },

  onOptionInput(e) {
    const { index } = e.currentTarget.dataset;
    const options = [...this.data.question.options];
    options[index] = e.detail.value;
    
    this.setData({
      'question.options': options
    });
  },

  addOption() {
    const options = [...this.data.question.options];
    options.push("");
    
    this.setData({
      'question.options': options
    });
  },

  deleteOption(e) {
    const { index } = e.currentTarget.dataset;
    const options = [...this.data.question.options];
    options.splice(index, 1);
    
    this.setData({
      'question.options': options
    });
  },
  
  // 矩阵题相关方法
  checkMatrixContainerStyle() {
    // 不再需要此方法，因为使用了滚动区域
  },
  
  // 同步列标题和单元格的水平滚动
  onHeaderScroll(e) {
    this.setData({
      scrollLeft: e.detail.scrollLeft
    });
  },

  // 当单元格区域滚动时同步表头
  onCellsScroll(e) {
    this.setData({
      scrollLeft: e.detail.scrollLeft
    });
  },
  
  // 同步行标题和单元格的垂直滚动
  onBodyScroll(e) {
    this.setData({
      scrollTop: e.detail.scrollTop
    });
  },
  
  addRow() {
    const matrix = {...this.data.question.matrix};
    matrix.rows += 1;
    matrix.rowHeaders.push('');
    
    const newRow = Array(matrix.cols).fill(false);
    matrix.selectedCells.push(newRow);
    
    this.setData({
      'question.matrix': matrix
    });
  },
  
  addCol() {
    const matrix = {...this.data.question.matrix};
    matrix.cols += 1;
    matrix.colHeaders.push('');
    
    matrix.selectedCells.forEach(row => {
      row.push(false);
    });
    
    this.setData({
      'question.matrix': matrix
    });
  },
  
  deleteRow(e) {
    const { index } = e.currentTarget.dataset;
    const matrix = {...this.data.question.matrix};

    if (matrix.rows < 3) {
      wx.showToast({
        title: '至少保留两行',
        icon: 'none'
      });
      return;
    }
    
    matrix.rows -= 1;
    matrix.rowHeaders.splice(index, 1);
    matrix.selectedCells.splice(index, 1);
    
    this.setData({
      'question.matrix': matrix
    });
  },
  
  deleteCol(e) {
    const { index } = e.currentTarget.dataset;
    const matrix = {...this.data.question.matrix};

    if (matrix.cols < 3) {
      wx.showToast({
        title: '至少保留两列',
        icon: 'none'
      });
      return;
    }
    
    matrix.cols -= 1;
    matrix.colHeaders.splice(index, 1);
    matrix.selectedCells.forEach(row => {
      row.splice(index, 1);
    });
    
    this.setData({
      'question.matrix': matrix
    });
  },
  
  // 切换矩阵单元格选中状态
  toggleMatrixCell(e) {
    const { rowIndex, colIndex } = e.currentTarget.dataset;
    const matrix = { ...this.data.question.matrix };
    matrix.selectedCells[rowIndex][colIndex] = !matrix.selectedCells[rowIndex][colIndex];
    this.setData({
      'question.matrix': matrix
    });
  },

  onRowHeaderInput(e) {
    const { index } = e.currentTarget.dataset;
    const value = e.detail.value;
    const matrix = {...this.data.question.matrix};
    matrix.rowHeaders[index] = value;
    
    this.setData({
      'question.matrix': matrix
    });
  },
  
  onColHeaderInput(e) {
    const { index } = e.currentTarget.dataset;
    const value = e.detail.value;
    const matrix = {...this.data.question.matrix};
    matrix.colHeaders[index] = value;
    
    this.setData({
      'question.matrix': matrix
    });
  },

  saveQuestion() {
    if (!this.data.question.title.trim()) {
      wx.showToast({
        title: '请输入问题标题',
        icon: 'none'
      });
      return;
    }

    if (this.data.question.options.length === 0 && 
        (this.data.question.type === 'single' || this.data.question.type === 'multiple')) {
      wx.showToast({
        title: '请添加至少一个选项',
        icon: 'none'
      });
      return;
    }

    if (this.data.question.type === 'blank' && this.data.question.blanks.length === 0) {
      wx.showToast({
        title: '请添加至少一个填空',
        icon: 'none'
      });
      return;
    }

    if (this.data.question.type === 'matrix') {
      if (this.data.question.matrix.rows < 1 || this.data.question.matrix.cols < 1) {
        wx.showToast({
          title: '行列数不能为0',
          icon: 'none'
        });
        return;
      }

      const hasEmptyRowHeader = this.data.question.matrix.rowHeaders.some(header => !header.trim());
      if (hasEmptyRowHeader) {
        wx.showToast({
          title: '行标题不能为空',
          icon: 'none'
        });
        return;
      }

      const hasEmptyColHeader = this.data.question.matrix.colHeaders.some(header => !header.trim());
      if (hasEmptyColHeader) {
        wx.showToast({
          title: '列标题不能为空',
          icon: 'none'
        });
        return;
      }
    }

    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    const questions = [...prevPage.data.questions];

    if (this.data.isNew) {
      const question = {...this.data.question};
      // 获取模块信息
      const prevPage = pages[pages.length - 2];
      if (this.moduleIndex >= 0 && prevPage.data.modules && prevPage.data.modules[this.moduleIndex]) {
        question.moduleIndex = this.moduleIndex;
        question.moduleName = prevPage.data.modules[this.moduleIndex].name;
      }
      questions.push(question);
      
      // 更新模块的问题计数
      if (this.moduleIndex >= 0 && prevPage.data.modules) {
        const modules = [...prevPage.data.modules];
        if (!modules[this.moduleIndex].questionCount) {
          modules[this.moduleIndex].questionCount = 0;
        }
        modules[this.moduleIndex].questionCount++;
        prevPage.setData({
          modules: modules
        });
      }
    } else {
      const question = {...this.data.question};
      // 确保编辑现有问题时也包含模块信息
      const prevPage = pages[pages.length - 2];
      if (question.moduleIndex !== undefined && question.moduleIndex >= 0 && prevPage.data.modules && prevPage.data.modules[question.moduleIndex]) {
        question.moduleName = prevPage.data.modules[question.moduleIndex].name;
      }
      questions[this.data.questionIndex] = question;
    }

    prevPage.setData({
      questions: questions
    });

    wx.navigateBack();
  }
});