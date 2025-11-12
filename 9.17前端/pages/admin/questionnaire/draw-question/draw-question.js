Page({
  data: {
    questionIndex: -1,
    moduleIndex: -1,
    question: {
      type: 'draw',
      subType: 'pattern',
      subTypeName: '画图案',
      title: '',
      exampleImage: '',
      drawingData: ''
    },
    isNew: true,
    imageUrl: '',
    context: null,
    canvas: null,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    currentColor: '#000000',
    currentLineWidth: 5,
    paths: [], // 存储所有路径
    history: [], // 存储历史操作
    canvasScale: 1 // 画布缩放比例
  },

  onLoad(options) {
    const { index, moduleIndex } = options;
    const systemInfo = wx.getSystemInfoSync();
    const canvasScale = systemInfo.pixelRatio;
    
    this.setData({
      canvasScale: canvasScale
    });
    
    // 保存模块索引
    if (moduleIndex !== undefined) {
      this.setData({
        moduleIndex: parseInt(moduleIndex)
      });
    }

    if (index !== undefined) {
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      const question = prevPage.data.questions[index];
      this.setData({
        questionIndex: parseInt(index),
        question: { 
          ...question,
          canvasScale: canvasScale
        },
        isNew: false,
        imageUrl: question.exampleImage || ''
      });
    } else {
      this.setData({
        isNew: true
      });
    }

    // 初始化画布
    this.initCanvas();
  },
  
  // 初始化画布
  initCanvas() {
    wx.createSelectorQuery()
      .select('#myCanvas')
      .fields({
        node: true,
        size: true
      })
      .exec((res) => {
        if (!res[0]) return;
        
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const width = res[0].width;
        const height = res[0].height;
        const scale = this.data.canvasScale;
        
        // 设置画布尺寸
        canvas.width = width * scale;
        canvas.height = height * scale;
        ctx.scale(scale, scale);
        
        this.setData({
          canvas: canvas,
          context: ctx,
          'question.canvasWidth': width,
          'question.canvasHeight': height
        });
        
        // 如果是编辑已有问题，加载并显示已有的绘制内容
        if (!this.data.isNew && this.data.question.drawingData) {
          // 创建图像对象来加载drawingData
          const img = canvas.createImage();
          img.onload = () => {
            // 清除画布
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 绘制图像 - 使用显示尺寸而非物理尺寸
            ctx.drawImage(img, 0, 0, width, height);
            // 保存当前画布状态到paths
            this.saveDrawingData();
          };
          img.src = this.data.question.drawingData;
        }
      });
  },

  onTitleInput(e) {
    this.setData({
      'question.title': e.detail.value
    });
  },

  uploadImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        // 上传图片到服务器或转换为base64
        wx.getFileSystemManager().readFile({
          filePath: tempFilePath,
          encoding: 'base64',
          success: (res) => {
            const base64Image = `data:image/png;base64,${res.data}`;
            this.setData({
              imageUrl: tempFilePath,
              'question.exampleImage': base64Image
            });
          }
        });
      }
    });
  },

  touchStart(e) {
    const touch = e.touches[0];
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

  touchMove(e) {
    if (!this.data.isDrawing) return;
    const touch = e.touches[0];
    const ctx = this.data.context;
    const currentPath = this.data.currentPath;

    // 绘制当前线段
    ctx.beginPath();
    ctx.moveTo(this.data.lastX, this.data.lastY);
    ctx.lineTo(touch.x, touch.y);
    ctx.strokeStyle = currentPath.color;
    ctx.lineWidth = currentPath.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 添加点到当前路径
    currentPath.points.push({x: touch.x, y: touch.y});
    
    this.setData({
      lastX: touch.x,
      lastY: touch.y,
      currentPath: currentPath
    });
  },

  touchEnd() {
    if (!this.data.isDrawing) return;
    
    const currentPath = this.data.currentPath;
    const history = [...this.data.history, {
      type: 'addPath',
      data: currentPath
    }];
    
    this.setData({
      isDrawing: false,
      paths: [...this.data.paths, currentPath],
      history: history
    });
    
    this.saveDrawingData();
  },

  selectColor(e) {
    const color = e.currentTarget.dataset.color;
    this.setData({
      currentColor: color
    });
  },

  selectLineWidth(e) {
    const width = e.currentTarget.dataset.width;
    this.setData({
      currentLineWidth: parseInt(width)
    });
  },
  
  // 重绘整个画布
  redrawCanvas() {
    const ctx = this.data.context;
    const canvas = this.data.canvas;
    
    if (!ctx || !canvas) return;

    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制所有路径
    this.data.paths.forEach(path => {
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
  },

  clearCanvas() {
    const ctx = this.data.context;
    const canvas = this.data.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 记录历史
    const history = [...this.data.history, {
      type: 'clear',
      data: {
        paths: [...this.data.paths]
      }
    }];
    
    this.setData({
      paths: [],
      history: history
    });
    
    this.saveDrawingData();
  },
  
  // 撤销操作
  undo() {
    const history = this.data.history;
    if (history.length === 0) return;
    
    const lastAction = history.pop();
    
    switch (lastAction.type) {
      case 'addPath':
        // 移除最后一条路径
        const paths = this.data.paths.slice(0, -1);
        this.setData({
          paths: paths,
          history: [...history]
        });
        break;
        
      case 'clear':
        // 恢复清除的路径
        this.setData({
          paths: lastAction.data.paths,
          history: [...history]
        });
        break;
    }
    
    this.redrawCanvas();
  },

  saveDrawingData() {
    const canvas = this.data.canvas;
    // 转换为base64数据
    const drawingData = canvas.toDataURL('image/png');
    this.setData({
      'question.drawingData': drawingData
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

    // 确保保存最新的绘制数据
    this.saveDrawingData();

    // 保存画布尺寸信息和模块索引
    this.setData({
      'question.canvasWidth': this.data.question.canvasWidth,
      'question.canvasHeight': this.data.question.canvasHeight,
      'question.canvasScale': this.data.canvasScale,
      'question.moduleIndex': this.data.moduleIndex
    });

    const pages = getCurrentPages();
    
    // 查找创建问卷页面
    let createPage = null;
    for (let i = pages.length - 1; i >= 0; i--) {
      if (pages[i].route === 'pages/admin/questionnaire/create/create') {
        createPage = pages[i];
        break;
      }
    }

    if (createPage) {
      const questions = Array.isArray(createPage.data.questions) ? [...createPage.data.questions] : [];
      const question = {...this.data.question};
      let modules = [...createPage.data.modules];

      // 确保问题包含模块名称信息
      if (question.moduleIndex !== undefined && question.moduleIndex >= 0 && createPage.data.modules && createPage.data.modules[question.moduleIndex]) {
        question.moduleName = createPage.data.modules[question.moduleIndex].name;
      }

      if (this.data.isNew) {
        questions.push(question);
        // 更新模块的问题计数
        if (question.moduleIndex !== undefined && question.moduleIndex >= 0 && modules) {
          if (!modules[question.moduleIndex].questionCount) {
            modules[question.moduleIndex].questionCount = 0;
          }
          modules[question.moduleIndex].questionCount++;
        }
      } else {
        if (this.data.questionIndex >= 0 && this.data.questionIndex < questions.length) {
          questions[this.data.questionIndex] = question;
        } else {
          questions.push(question);
        }
      }

      createPage.setData({
        questions: questions,
        modules: modules
      }, () => {
        // 计算需要返回的页面数
        const backCount = pages.length - 1 - pages.indexOf(createPage);
        // 返回到问卷创建页面
        wx.navigateBack({ delta: backCount });
      });
    } else {
      wx.showToast({
        title: '保存失败，未找到问卷页面',
        icon: 'none'
      });
    }
  }
});