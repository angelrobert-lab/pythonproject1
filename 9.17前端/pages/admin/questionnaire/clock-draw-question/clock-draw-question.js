Page({
  data: {
    questionIndex: -1,
    moduleIndex: -1,
    question: {
      type: 'draw',
      subType: 'clock',
      subTypeName: '画钟表',
      title: '',
      drawingData: '',
      // 提示句相关数据
      hour: '',
      minute: '',
      timeRelation: '过', // 过或差
      showOutline: true,
      showNumbers: true,
      showHands: true
    },
    isNew: true,
    context: null,
    canvas: null,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    currentColor: '#000000',
    currentLineWidth: 5,
    paths: [], // 存储所有路径
    history: [], // 存储历史操作
    currentPath: null // 当前正在绘制的路径
  },

  onLoad(options) {
    const { index, moduleIndex } = options;
    if (index !== undefined) {
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      const question = prevPage.data.questions[index];
      this.setData({
        questionIndex: parseInt(index),
        question: { ...question },
        isNew: false,
        imageUrl: question.exampleImage || ''
      });
    } else {
      this.setData({
        isNew: true
      });
    }
    
    // 保存模块索引
    if (moduleIndex !== undefined) {
      this.setData({
        moduleIndex: parseInt(moduleIndex)
      });
    }

    // 初始化画布
    wx.createSelectorQuery()
      .select('#myCanvas')
      .fields({
        node: true,
        size: true
      })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        this.setData({
          canvas: canvas,
          context: ctx
        });
        // 如果是编辑已有问题，加载已有的绘制数据
        if (!this.data.isNew && this.data.question.drawingData) {
          this.loadDrawingData(this.data.question.drawingData);
        }
      });
  },

  onTitleInput(e) {
    this.setData({
      'question.title': e.detail.value
    });
  },



  // 提示句相关方法
  onHourInput(e) {
    this.setData({
      'question.hour': e.detail.value
    });
  }
,
  onMinuteInput(e) {
    this.setData({
      'question.minute': e.detail.value
    });
  }
,
  selectRelation(e) {
    const relation = e.currentTarget.dataset.relation;
    this.setData({
      'question.timeRelation': relation
    });
  }
,
  toggleOutline() {
    this.setData({
      'question.showOutline': !this.data.question.showOutline
    });
  }
,
  toggleNumbers() {
    this.setData({
      'question.showNumbers': !this.data.question.showNumbers
    });
  }
,
  toggleHands() {
    this.setData({
      'question.showHands': !this.data.question.showHands
    });
  }
,
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
      history: history,
      currentPath: null
    });

    this.saveDrawingData();
  },

  selectColor(e) {
    try {
      // 1) 从点击的色块上获取颜色值（推荐在 WXML 的色块上写 data-color）
      const colorFromEvent =
        (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.color) ||
        (e && e.target && e.target.dataset && e.target.dataset.color) ||
        null;
  
      if (colorFromEvent) {
        // 2) 更新画笔颜色（常见命名：strokeStyle/penColor/currentColor 等）
        // 尽量不改动变量命名，如你的数据字段不同，可将下面两行字段名对齐
        this.setData({
          currentColor: colorFromEvent,
          strokeStyle: colorFromEvent
        });
        // 同步到 2D context（若存在）
        if (this.data && this.data.context && typeof this.data.context.setStrokeStyle === 'function') {
          this.data.context.setStrokeStyle(colorFromEvent);
        } else if (this.data && this.data.context) {
          // 标准 CanvasRenderingContext2D 场景
          try { this.data.context.strokeStyle = colorFromEvent; } catch (err) {}
        }
      }
  
      // 3) 仅用数据驱动的方式更新“激活态”索引（可选）
      // 如果你的数据中有 colorList（如 ['#000','#f00',...] 或 [{value:'#000'}, ...]）
      // 则尝试定位当前颜色对应的索引，供 WXML 以 class 绑定：
      // class="{{index === activeColorIndex ? 'active' : ''}}"
      if (Array.isArray(this.data && this.data.colorList) && colorFromEvent) {
        const list = this.data.colorList;
        let idx = -1;
        for (let i = 0; i < list.length; i++) {
          const v = typeof list[i] === 'string' ? list[i] : (list[i] && (list[i].value || list[i].color));
          if (v && v.toLowerCase && v.toLowerCase() === String(colorFromEvent).toLowerCase()) {
            idx = i; break;
          }
        }
        if (idx >= 0) {
          this.setData({ activeColorIndex: idx });
        }
      }
  
      // 4) 绝不直接访问 querySelectorAll，避免在小程序运行时抛错
      // 若你原先用它来切换样式，请改为 WXML 数据绑定方式（见第 3 步）。
    } catch (err) {
      // 兜底：任何情况下都不抛出到外层，保证绘制流程不中断
      console.warn('[clock-draw-question] selectColor safe error:', err);
    }
  },
  

  selectLineWidth(e) {
    const width = e.currentTarget.dataset.width;
    this.setData({
      currentLineWidth: parseInt(width)
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

  loadDrawingData(dataUrl) {
    const canvas = this.data.canvas;
    const ctx = this.data.context;
    // 获取画布显示尺寸
    const dpr = wx.getSystemInfoSync().pixelRatio;
    const displayWidth = canvas.width / dpr;
    const displayHeight = canvas.height / dpr;
    const img = canvas.createImage();
    img.onload = () => {
      // 使用显示尺寸绘制图像
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      // 清空paths数组，因为我们现在是从图像加载，不是从路径
      this.setData({
        paths: [],
        history: []
      });
    };
    img.src = dataUrl;
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
    
    // 保存模块索引
    this.setData({
      'question.moduleIndex': this.data.moduleIndex
    });

    const pages = getCurrentPages();
    console.log('页面栈长度:', pages.length);
    console.log('当前页面:', pages[pages.length - 1].route);

    // 查找创建问卷页面
    let createPage = null;
    for (let i = pages.length - 1; i >= 0; i--) {
      if (pages[i].route === 'pages/admin/questionnaire/create/create') {
        createPage = pages[i];
        break;
      }
    }

    if (createPage) {
      console.log('找到创建问卷页面:', createPage.route);
      // 检查questions是否存在且可迭代
      const questions = Array.isArray(createPage.data.questions) ? [...createPage.data.questions] : [];
      console.log('问题列表长度(更新前):', questions.length);
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
        // 确保questionIndex有效
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
        console.log('问题列表更新成功，新长度:', createPage.data.questions.length);
        // 计算需要返回的页面数
        const backCount = pages.length - 1 - pages.indexOf(createPage);
        console.log('需要返回的页面数:', backCount);
        // 返回到问卷创建页面
        wx.navigateBack({ delta: backCount });
      });
    } else {
      console.error('未找到创建问卷页面');
      wx.showToast({
        title: '保存失败，未找到问卷页面',
        icon: 'none'
      });
    }

    // 调试信息
    console.log('问题已保存:', this.data.question);
  }
});